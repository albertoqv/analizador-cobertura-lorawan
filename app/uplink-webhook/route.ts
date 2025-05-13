import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

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

    // 1) Comprobar si ya existe un punto con estas coordenadas
    const { data: existingPoints, error: existingPointError } = await supabase
      .from("geo_points")
      .select("id")
      .eq("latitude", payload.lat)
      .eq("longitude", payload.lon);

    if (existingPointError) {
      console.error("❌ Error consultando geo_points:", existingPointError);
      return NextResponse.json({ error: "Error consultando geo_points" }, { status: 500 });
    }

    // 2) Si existe, primero borramos las mediciones asociadas y luego el geo_point
    if (existingPoints && existingPoints.length > 0) {
      const oldPointId = existingPoints[0].id;
      console.log(`ℹ️ Borrando antiguo geo_point con ID = ${oldPointId} (lat: ${payload.lat}, lon: ${payload.lon})...`);

      // 2.1) Borrar mediciones en quality_measurements asociadas
      const { error: deleteMeasurementsError } = await supabase
        .from("quality_measurements")
        .delete()
        .eq("point_id", oldPointId);

      if (deleteMeasurementsError) {
        console.error("❌ Error al borrar mediciones anteriores:", deleteMeasurementsError);
        return NextResponse.json({ error: "Error borrando mediciones anteriores" }, { status: 500 });
      }

      // 2.2) Borrar el registro de geo_points
      const { error: deletePointError } = await supabase
        .from("geo_points")
        .delete()
        .eq("id", oldPointId);

      if (deletePointError) {
        console.error("❌ Error al borrar geo_point anterior:", deletePointError);
        return NextResponse.json({ error: "Error borrando geo_point anterior" }, { status: 500 });
      }
      console.log("🗑️ Se borró por completo el geo_point anterior y sus mediciones asociadas.");
    }

    // 3) Crear un nuevo punto (esto generará un nuevo ID y nuevo created_at)
    const { data: pointData, error: pointError } = await supabase
      .from("geo_points")
      .insert([
        {
          latitude: payload.lat,
          longitude: payload.lon,
          best_quality: null
          // created_at se generará automáticamente si tienes DEFAULT now()
        }
      ])
      .select("id")
      .single();

    if (pointError) {
      console.error("❌ Error al insertar nuevo punto geográfico:", pointError);
      return NextResponse.json({ error: "Error al insertar en geo_points" }, { status: 500 });
    }

    const pointId = pointData.id;
    console.log(`✅ Creado nuevo geo_point con ID = ${pointId} (lat: ${payload.lat}, lon: ${payload.lon}).`);

    // 4) Filtrar y descartar el gateway "enlace-alberto"
    const filteredMetadata = rxMetadata.filter((gatewayData) => {
      const gatewayId = gatewayData.gateway_ids?.gateway_id || "desconocido";
      return gatewayId !== "enlace-alberto";
    });

    // 5) Si no quedan gateways válidos, no insertamos mediciones
    if (filteredMetadata.length === 0) {
      console.log("ℹ️ Solo se recibió el gateway 'enlace-alberto'. No se insertan mediciones, best_quality se mantiene en null.");
      return NextResponse.json(
        {
          success: true,
          point_id: pointId,
          best_measurement_id: null,
        },
        { status: 200 }
      );
    }

    // 6) Construir arreglo de mediciones
    const measurements = filteredMetadata.map((gatewayData) => {
      const gatewayId = gatewayData.gateway_ids?.gateway_id || "desconocido";
      const rssi = typeof gatewayData.rssi === "number" ? gatewayData.rssi : -120;
      const snr = typeof gatewayData.snr === "number" ? gatewayData.snr : -10;

      // Cálculo de la calidad
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
        rssi,
        snr,
        quality: parseFloat(quality.toFixed(2))
      };
    });

    console.log("📡 Insertando nuevas mediciones:", measurements);

    // 7) Insertar las mediciones
    const { data: insertedMeasurements, error: measurementError } = await supabase
      .from("quality_measurements")
      .insert(measurements)
      .select("*");

    if (measurementError) {
      console.error("❌ Error al insertar mediciones:", measurementError);
      return NextResponse.json({ error: "Error al insertar mediciones" }, { status: 500 });
    }

    // 8) Determinar la medición con mayor quality
    let bestMeasurement = insertedMeasurements[0];
    for (const meas of insertedMeasurements) {
      if (meas.quality > bestMeasurement.quality) {
        bestMeasurement = meas;
      }
    }

    // 9) Actualizar el campo best_quality en geo_points
    const { error: updateError } = await supabase
      .from("geo_points")
      .update({
        best_quality: bestMeasurement.id
      })
      .eq("id", pointId);

    if (updateError) {
      console.error("❌ Error al actualizar best_quality:", updateError);
      return NextResponse.json({ error: "Error actualizando best_quality" }, { status: 500 });
    }

    console.log("✅ Punto y mediciones creados con un nuevo ID, best_quality actualizado.");

    // Respuesta final
    return NextResponse.json(
      {
        success: true,
        point_id: pointId,
        best_measurement_id: bestMeasurement.id,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error procesando la solicitud:", error);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}