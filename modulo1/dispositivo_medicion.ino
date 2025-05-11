/*
* Trabajo Fin de Grado: Analizador de cobertura LoRaWAN
* Alberto Quesada Valle
* 
* dispositivo_medicion
* 
* RESUMEN DEL FUNCIONAMIENTO
*     1) Al iniciar: configura GPS, conecta a LoRaWAN y queda en espera (LED verde)
*     2) Al pulsar botón: obtiene posición GPS y la envía a TTN (LED amarillo durante proceso)
*     3) Tras enviar: vuelve a estado de espera (LED verde)
*     4) En caso de error: muestra error (LED rojo) y vuelve a estado de espera
* - La posición se codifica en 6 bytes (3 para latitud, 3 para longitud) para optimizar envío
* - Incluye modo de bajo consumo tras envío (modem.sleep())
* 
* INDICADORES LED
* - LED Amarillo (pin 6): Encendido durante setup() y al procesar medición/envío
* - LED Verde (pin 7): Encendido cuando el sistema está listo para nueva medición
* - LED Rojo (pin 8): Encendido unos segundos al producirse un error
* 
* (Nota: Requiere archivo arduino_secrets.h con credenciales TTN: appEui y appKey)
*/
#include <TinyGPS++.h>
#include <MKRWAN.h>
#include "arduino_secrets.h"  // appEui y appKey

// --------------------------------------------------------------
// Definición de pines
// --------------------------------------------------------------
#define debugSerial Serial
#define gpsSerial   Serial1
#define loraSerial  Serial2

#define BUTTON_PIN      5
#define LED_AMARILLO    6
#define LED_VERDE       7
#define LED_ROJO        8

// Objeto módem LoRa
_lora_band region = EU868;   
LoRaModem modem(loraSerial);

// GPS
TinyGPSPlus gps;
#define PMTK_SET_NMEA_UPDATE_1HZ "$PMTK220,1000*1F"

unsigned long last_update = 0;     // Marca de tiempo del último envío
uint8_t txBuffer[6];              // Buffer que contendrá los datos a enviar (solo lat, lon)
uint32_t latitudeBinary, longitudeBinary;

// --------------------------------------------------------------
// Estados para mostrar con LEDs
// --------------------------------------------------------------
enum LedState {
  STATE_SETUP,      // Se está configurando el sistema
  STATE_READY,      // Listo para enviar nueva medición
  STATE_PROCESSING  // Midiendo y enviando
};

LedState currentState = STATE_SETUP;  

// Control para saber si estamos esperando pulsación
bool esperandoPulsacion = false;

// --------------------------------------------------------------
// Prototipos de funciones
// --------------------------------------------------------------
void setLedsSetup();
void setLedsReady();
void setLedsProcessing();
void showError();
void endProcess();
void MeasureAndSendGPS();
void buildPacket();
void displayGpsInfo();

// --------------------------------------------------------------
// setup()
// --------------------------------------------------------------
void setup() {
  debugSerial.begin(115200);
  gpsSerial.begin(9600);
  
  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_AMARILLO, OUTPUT);
  pinMode(LED_VERDE,    OUTPUT);
  pinMode(LED_ROJO,     OUTPUT);

  // Al inicio: LED Amarillo encendido (estado de SETUP)
  // LED Verde y LED Rojo apagados
  setLedsSetup();
  

  unsigned long startWait = millis();
  while (!debugSerial && (millis() - startWait < 5000)) {}

  debugSerial.println("Inicializando el sistema...");
  
  // Configurar GPS a 1 Hz
  gpsSerial.println(F(PMTK_SET_NMEA_UPDATE_1HZ));
  debugSerial.println("GPS configurado a 1 Hz.");

  // Iniciar módem LoRa
  if (!modem.begin(region)) {
    debugSerial.println("Error al iniciar el módulo LoRa.");
    showError();    // LED Rojo encendido
    while (true);      // Error fatal
  }
  debugSerial.println("Módulo LoRa inicializado.");

  // Unirse a TTN (OTAA)
  debugSerial.println("Uniéndose a TTN...");
  int connected = modem.joinOTAA(appEui, appKey);
  if (!connected) {
    debugSerial.println("Fallo al unirse a TTN.");
    showError();    // LED Rojo encendido
    while (true);      
  }
  debugSerial.println("Unido a TTN correctamente.");
  
  // Configurar ADR y DR para optimizar transmisión
  modem.setADR(true);
  modem.dataRate(5);  

  // Al terminar el setup, sistema listo => LED Verde
  setLedsReady();
  esperandoPulsacion = true;

  debugSerial.println("Sistema listo. Pulsa el botón para medir y enviar.");
}

// --------------------------------------------------------------
// loop()
// --------------------------------------------------------------
void loop() {
  // Solo hace algo si está en READY y esperando pulsación
  if (esperandoPulsacion && currentState == STATE_READY) {
    if (digitalRead(BUTTON_PIN) == LOW) {
      delay(50); // Anti-rebote
      if (digitalRead(BUTTON_PIN) == LOW) {
        debugSerial.println("Botón pulsado. Midiendo y enviando...");
        esperandoPulsacion = false;

        // Pasamos a STATE_PROCESSING => LED Amarillo ON, Verde OFF
        setLedsProcessing();

        MeasureAndSendGPS();
      }
    }
  }
}

// --------------------------------------------------------------
// MeasureAndSendGPS(): Lee GPS, envía a TTN, 
// --------------------------------------------------------------
void MeasureAndSendGPS() {
  // Limpiar buffer GPS
  while (gpsSerial.available() > 0) {
    gpsSerial.read();
  }

  // Intentar obtener fix en 30s
  unsigned long start = millis();
  bool fixOk = false;
  while (millis() - start < 30000) {  
    while (gpsSerial.available() > 0) {
      if (gps.encode(gpsSerial.read())) {
        if (gps.location.isValid() && gps.location.age() < 1000) {
          fixOk = true;
          break;
        }
      }
    }
    if (fixOk) break;
  }

  if (!fixOk) {
    debugSerial.println("No se obtuvo fix GPS completo. Abortando envío.");
    showError();    // LED Rojo unos segundos
    endProcess();   // Vuelve a LED Verde (READY)
    return;
  }

  // Construir paquete
  buildPacket();

  debugSerial.println("Fix GPS OK. Enviando datos a TTN...");

  // Enviamos directamente sin verificar errores
  modem.beginPacket();
  modem.write(txBuffer, sizeof(txBuffer));
  modem.endPacket(false);  // transmisión no confirmada (envío asegurado)
  
  debugSerial.println("Mensaje enviado.");
  displayGpsInfo();

  // Módem sleep
  modem.sleep();
  debugSerial.println("Módem en sleep. Fin de proceso, esperando a otro envío.\n");

  delay(3000);
  // Regresar a estado READY
  endProcess();
}

// --------------------------------------------------------------
// buildPacket(): Construye 6 bytes con lat y lon
// --------------------------------------------------------------
void buildPacket() {
  // Latitud 24 bits
  latitudeBinary  = ((gps.location.lat() +  90) / 180.0) * 16777215;
  // Longitud 24 bits
  longitudeBinary = ((gps.location.lng() + 180) / 360.0) * 16777215;

  // Llenamos txBuffer con latitud y longitud (24 bits cada una)
  txBuffer[0] = (latitudeBinary  >> 16) & 0xFF;
  txBuffer[1] = (latitudeBinary  >> 8)  & 0xFF;
  txBuffer[2] =  latitudeBinary         & 0xFF;

  txBuffer[3] = (longitudeBinary >> 16) & 0xFF;
  txBuffer[4] = (longitudeBinary >> 8)  & 0xFF;
  txBuffer[5] =  longitudeBinary        & 0xFF;
}

// --------------------------------------------------------------
// displayGpsInfo(): Muestra datos GPS
// --------------------------------------------------------------
void displayGpsInfo() {
  debugSerial.print("Ubicacion: ");
  if (gps.location.isValid()) {
    debugSerial.print(gps.location.lat(), 6);
    debugSerial.print(", ");
    debugSerial.print(gps.location.lng(), 6);
  } else {
    debugSerial.print("NO VALIDA");
  }

  debugSerial.print("  Fecha/Hora: ");
  if (gps.date.isValid()) {
    debugSerial.print(gps.date.month());
    debugSerial.print("/");
    debugSerial.print(gps.date.day());
    debugSerial.print("/");
    debugSerial.print(gps.date.year());
  } else {
    debugSerial.print("NO VALIDA");
  }

  debugSerial.print(" ");
  if (gps.time.isValid()) {
    if (gps.time.hour() < 10) debugSerial.print("0");
    debugSerial.print(gps.time.hour());
    debugSerial.print(":");
    if (gps.time.minute() < 10) debugSerial.print("0");
    debugSerial.print(gps.time.minute());
    debugSerial.print(":");
    if (gps.time.second() < 10) debugSerial.print("0");
    debugSerial.print(gps.time.second());
    debugSerial.print(".");
    if (gps.time.centisecond() < 10) debugSerial.print("0");
    debugSerial.print(gps.time.centisecond());
  } else {
    debugSerial.print("NO VALIDA");
  }
  debugSerial.println();
}

// --------------------------------------------------------------
// Manejo de estados (LEDs)
// --------------------------------------------------------------
void setLedsSetup() {
  currentState = STATE_SETUP;
  digitalWrite(LED_AMARILLO, HIGH);  // Amarillo encendido (configurando)
  digitalWrite(LED_VERDE,    LOW);
  digitalWrite(LED_ROJO,     LOW);
}

void setLedsReady() {
  currentState = STATE_READY;
  digitalWrite(LED_AMARILLO, LOW);
  digitalWrite(LED_VERDE,    HIGH);  // Verde encendido (listo)
  digitalWrite(LED_ROJO,     LOW);
}

void setLedsProcessing() {
  currentState = STATE_PROCESSING;
  digitalWrite(LED_AMARILLO, HIGH);  // Amarillo encendido (procesando)
  digitalWrite(LED_VERDE,    LOW);
  digitalWrite(LED_ROJO,     LOW);
}

// --------------------------------------------------------------
// showError(): enciende LED_ROJO unos segundos y restaura estado
// --------------------------------------------------------------
void showError() {
  // Guardamos el estado actual para restaurarlo después
  LedState oldState = currentState;

  // Apagamos Amarillo y Verde, encendemos Rojo
  digitalWrite(LED_AMARILLO, LOW);
  digitalWrite(LED_VERDE,    LOW);
  digitalWrite(LED_ROJO,     HIGH);

  // Espera 5 segundos 
  delay(5000);

  // Apagamos LED Rojo
  digitalWrite(LED_ROJO, LOW);

  // Restaurar el estado anterior
  switch (oldState) {
    case STATE_SETUP:
      setLedsSetup();
      break;
    case STATE_READY:
      setLedsReady();
      break;
    case STATE_PROCESSING:
      setLedsProcessing();
      break;
  }
}

// --------------------------------------------------------------
// endProcess(): Se llama al terminar la medición/envío
// --------------------------------------------------------------
void endProcess() {
  setLedsReady();          // Volver a "listo"
  esperandoPulsacion = true;
}