import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

// 1️⃣ Función para enviar un DOWNLINK a TTN
async function scheduleDownlink(appId: string, deviceId: string, payloadStr: string) {
  try {
    console.log("📤 Intentando programar downlink...");

    // a) Convertir el mensaje a Base64 (TTN requiere base64 en downlinks)
    const payloadB64 = Buffer.from(payloadStr, 'utf8').toString('base64');

    // b) Construir el body JSON del downlink
    const downlinkBody = {
      downlinks: [
        {
          f_port: 3,  // Usamos el puerto 3 para los downlinks
          frm_payload: payloadB64, // Payload convertido a Base64
          priority: "NORMAL"
        }
      ]
    };

    // c) Definir la URL de TTN para programar el downlink
    const url = `https://eu1.cloud.thethings.network/api/v3/as/applications/${appId}/devices/${deviceId}/down/push`;

    // d) Leer la API Key de TTN desde variables de entorno en Vercel
    const TTN_API_KEY = process.env.TTN_API_KEY;
    if (!TTN_API_KEY) {
      console.error("❌ Falta la variable de entorno TTN_API_KEY");
      return;
    }

    console.log("🔑 TTN API Key detectada.");
    console.log("📝 Payload que se enviará:", JSON.stringify(downlinkBody, null, 2));

    // e) Enviar la petición a TTN
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${TTN_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(downlinkBody)
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error('❌ Error al programar downlink en TTN:', resp.status, errText);
    } else {
      console.log('✅ Downlink programado en TTN con payload:', payloadStr);
    }
  } catch (error) {
    console.error("❌ Error en `scheduleDownlink`:", error);
  }
}

// 2️⃣ Endpoint que recibe el uplink desde TTN
export async function POST(request: Request) {
  try {
    const bodyStr = await request.text();
    const bodyObj = JSON.parse(bodyStr);

    // Extraer IDs de la aplicación y dispositivo
    const deviceId = bodyObj?.end_device_ids?.device_id || "desconocido";
    const appId = bodyObj?.end_device_ids?.application_ids?.application_id || "app-desconocida";

    console.log("📡 Uplink recibido desde TTN para dispositivo:", deviceId);

    // Extraer el payload del uplink
    const payload = bodyObj.uplink_message?.decoded_payload;
    const rxMetadata = bodyObj.uplink_message?.rx_metadata;

    console.log("📡 Datos del uplink:", JSON.stringify(payload, null, 2));

    if (!payload || !rxMetadata || !Array.isArray(rxMetadata) || rxMetadata.length === 0) {
      console.error("❌ Error: El uplink no tiene datos válidos.");
      return NextResponse.json({ error: "Uplink inválido" }, { status: 400 });
    }

    // Conectar con Supabase
    const supabase = await createClient();

    // Insertar en geo_points
    const { data: pointData, error: pointError } = await supabase
      .from("geo_points")
      .insert([{ latitude: payload.lat, longitude: payload.lon, best_quality: null }])
      .select("id")
      .single();

    if (pointError) {
      console.error('❌ Error al insertar en geo_points:', pointError);
      return NextResponse.json({ error: "Error en geo_points" }, { status: 500 });
    }

    const pointId = pointData.id;
    console.log(`🗺️ Punto insertado en geo_points con ID: ${pointId}`);

    // Construir datos de quality_measurements
    const measurements = rxMetadata.map(gatewayData => {
      const gatewayId = gatewayData.gateway_ids?.gateway_id || "desconocido";
      const rssi = typeof gatewayData.rssi === "number" ? gatewayData.rssi : -120;
      const snr = typeof gatewayData.snr === "number" ? gatewayData.snr : -10;

      let quality = 0;
      if (rssi > -100) quality = 100;
      else if (rssi > -105) quality = 80 + ((rssi + 105) / 5) * 20;
      else if (rssi > -110) quality = 60 + ((rssi + 110) / 5) * 20;
      else if (rssi > -115) quality = 40 + ((rssi + 115) / 5) * 20;
      else if (rssi > -120) quality = 20 + ((rssi + 120) / 5) * 20;

      return { point_id: pointId, gateway_id: gatewayId, rssi, snr, quality: parseFloat(quality.toFixed(2)) };
    });

    console.log("📊 Datos a insertar en quality_measurements:", measurements);

    // Insertar en quality_measurements
    const { data: insertedMeasurements, error: measurementError } = await supabase
      .from("quality_measurements")
      .insert(measurements)
      .select("*");

    if (measurementError) {
      console.error('❌ Error en quality_measurements:', measurementError);
      return NextResponse.json({ error: "Error en quality_measurements" }, { status: 500 });
    }

    console.log("✅ Mediciones insertadas correctamente.");

    // Encontrar la mejor calidad
    let bestMeasurement = insertedMeasurements[0];
    for (const meas of insertedMeasurements) {
      if (meas.quality > bestMeasurement.quality) bestMeasurement = meas;
    }

    // Actualizar best_quality en geo_points
    const { error: updateError } = await supabase
      .from("geo_points")
      .update({ best_quality: bestMeasurement.id })
      .eq("id", pointId);

    if (updateError) {
      console.error('❌ Error en best_quality de geo_points:', updateError);
      return NextResponse.json({ error: "Error en geo_points" }, { status: 500 });
    }

    console.log('✅ Punto y mediciones actualizados correctamente.');

    // Enviar downlink con "recibido"
    console.log("🚀 Programando downlink con mensaje 'recibido'...");
    await scheduleDownlink(appId, deviceId, "recibido");

    // Responder a TTN
    return NextResponse.json({
      success: true,
      point_id: pointId,
      best_measurement_id: bestMeasurement.id
    }, { status: 200 });

  } catch (error) {
    console.error("❌ Error procesando la solicitud:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
