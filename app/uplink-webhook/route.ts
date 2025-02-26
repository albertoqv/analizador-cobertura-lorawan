// app/uplink-webhook/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
    try {
        const bodyStr = await request.text();
        const bodyObj = JSON.parse(bodyStr);

        // 1. Extraer decoded_payload y rx_metadata
        const payload = bodyObj.uplink_message.decoded_payload;
        const rxMetadata = bodyObj.uplink_message.rx_metadata;

        console.log("📡 Datos recibidos:", payload);

        if (!Array.isArray(rxMetadata) || rxMetadata.length === 0) {
            console.error("❌ Error: rxMetadata no es un array válido o está vacío.");
            return NextResponse.json({ error: "rxMetadata inválido" }, { status: 400 });
        }

        // 2. Conectar con Supabase
        const supabase = await createClient();

        // 3. Insertar el punto geográfico con best_quality a null
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

        // 4. Construir arreglo de mediciones
        const measurements = rxMetadata.map(gatewayData => {
            const gatewayId = gatewayData.gateway_ids?.gateway_id || "desconocido";
            const rssi = typeof gatewayData.rssi === "number" ? gatewayData.rssi : -120;
            const snr = typeof gatewayData.snr === "number" ? gatewayData.snr : -10;

            // Cálculo de calidad (idéntico al que tenías)
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

        // 5. Insertar las mediciones en la tabla quality_measurements
        //    (usamos .select("*") para poder recibir los IDs de cada fila)
        const { data: insertedMeasurements, error: measurementError } = await supabase
            .from("quality_measurements")
            .insert(measurements)
            .select("*");

        if (measurementError) {
            console.error('❌ Error al insertar measurements:', measurementError);
            return NextResponse.json({ error: "Error en quality_measurements" }, { status: 500 });
        }

        // 6. Encontrar la medición con mayor "quality"
        let bestMeasurement = insertedMeasurements[0];
        for (const meas of insertedMeasurements) {
            if (meas.quality > bestMeasurement.quality) {
                bestMeasurement = meas;
            }
        }

        // 7. Actualizar el geo_point con el ID del measurement que tenga la mejor quality
        const { error: updateError } = await supabase
            .from("geo_points")
            .update({ best_quality: bestMeasurement.id })
            .eq("id", pointId);

        if (updateError) {
            console.error('❌ Error al actualizar best_quality en geo_points:', updateError);
            return NextResponse.json({ error: "Error actualizando best_quality" }, { status: 500 });
        }

        console.log('✅ Punto y mediciones insertados correctamente.');
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
