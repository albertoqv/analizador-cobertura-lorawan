import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

const appId = "tfg-analizador";  
const deviceId = "tfg-analizador-alberto";  

async function scheduleDownlink(payloadStr: string) {
  try {
    console.log("📤 Intentando programar downlink...");
    const payloadB64 = Buffer.from(payloadStr, 'utf8').toString('base64');
    const downlinkBody = {
      downlinks: [
        {
          f_port: 3,
          frm_payload: payloadB64,
          priority: "NORMAL"
        }
      ]
    };
    const url = `https://eu1.cloud.thethings.network/api/v3/as/applications/${appId}/devices/${deviceId}/down/push`;
    const TTN_API_KEY = process.env.TTN_API_KEY;
    if (!TTN_API_KEY) {
      console.error("❌ Falta la variable de entorno TTN_API_KEY");
      return;
    }
    console.log("🔑 TTN API Key detectada.");
    console.log("📝 Payload que se enviará:", JSON.stringify(downlinkBody, null, 2));
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

export async function POST(request: Request) {
  try {
    const bodyStr = await request.text();
    const bodyObj = JSON.parse(bodyStr);
    const payload = bodyObj.uplink_message.decoded_payload;
    const rxMetadata = bodyObj.uplink_message.rx_metadata;
    console.log("📡 Datos recibidos:", payload);

    if (!Array.isArray(rxMetadata) || rxMetadata.length === 0) {
      console.error("❌ Error: rxMetadata no es un array válido o está vacío.");
      return NextResponse.json({ error: "rxMetadata inválido" }, { status: 400 });
    }

    // Conectar con Supabase
    const supabase = await createClient();

    // Insertar el punto geográfico con best_quality a null
    const { data: pointData, error: pointError } = await supabase
      .from("geo_points")
      .insert([
        {
          latitude: payload.lat,
          longitude: payload.lon,
          best_quality: null
        }
      ])
      .select("id")
      .single();

    if (pointError) {
      console.error('❌ Error al insertar el punto geográfico:', pointError);
      return NextResponse.json({ error: "Error al insertar en geo_points" }, { status: 500 });
    }

    const pointId = pointData.id;

    // Filtrar para descartar el gateway "enlace-alberto"
    const filteredMetadata = rxMetadata.filter(gatewayData => {
      const gatewayId = gatewayData.gateway_ids?.gateway_id || "desconocido";
      return gatewayId !== "enlace-alberto";
    });

    if (filteredMetadata.length === 0) {
      console.log("ℹ️ Solo se recibió el gateway 'enlace-alberto'. Best_quality se mantendrá en null.");
      // Programar downlink indicando "recibido" (o se podría ajustar el mensaje según la lógica de la aplicación)
      await scheduleDownlink("recibido");
      return NextResponse.json({
        success: true,
        point_id: pointId,
        best_measurement_id: null
      }, { status: 200 });
    }

    // Construir arreglo de mediciones con los gateways restantes
    const measurements = filteredMetadata.map(gatewayData => {
      const gatewayId = gatewayData.gateway_ids?.gateway_id || "desconocido";
      const rssi = typeof gatewayData.rssi === "number" ? gatewayData.rssi : -120;
      const snr = typeof gatewayData.snr === "number" ? gatewayData.snr : -10;
      let quality = 0;
      if (rssi > -100) {
        quality = 100;
      } else if (rssi > -105) {
        quality = 80 + ((rssi + 105) / 5) * 20;
      } else if (rssi > -110) {
        quality = 60 + ((rssi + 110) / 5) * 20;
      } else if (rssi > -115) {
        quality = 40 + ((rssi + 115) / 5) * 20;
      } else if (rssi > -120) {
        quality = 20 + ((rssi + 120) / 5) * 20;
      } else {
        quality = 0;
      }
      return {
        point_id: pointId,
        gateway_id: gatewayId,
        rssi: rssi,
        snr: snr,
        quality: parseFloat(quality.toFixed(2))
      };
    });

    console.log("📡 Datos a insertar en quality_measurements:", measurements);

    // Insertar las mediciones en la tabla quality_measurements
    const { data: insertedMeasurements, error: measurementError } = await supabase
      .from("quality_measurements")
      .insert(measurements)
      .select("*");

    if (measurementError) {
      console.error('❌ Error al insertar measurements:', measurementError);
      return NextResponse.json({ error: "Error en quality_measurements" }, { status: 500 });
    }

    // Encontrar la medición con mayor "quality"
    let bestMeasurement = insertedMeasurements[0];
    for (const meas of insertedMeasurements) {
      if (meas.quality > bestMeasurement.quality) {
        bestMeasurement = meas;
      }
    }

    // Actualizar el geo_point con el ID de la mejor medición
    const { error: updateError } = await supabase
      .from("geo_points")
      .update({ best_quality: bestMeasurement.id })
      .eq("id", pointId);

    if (updateError) {
      console.error('❌ Error al actualizar best_quality en geo_points:', updateError);
      return NextResponse.json({ error: "Error actualizando best_quality" }, { status: 500 });
    }

    console.log('✅ Punto y mediciones insertados correctamente.');

    // Enviar downlink con "recibido"
    console.log("🚀 Programando downlink con mensaje 'recibido'...");
    await scheduleDownlink("recibido");

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
