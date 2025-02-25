import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: Request) {
    try {
        const bodyStr = await request.text();
        const bodyObj = JSON.parse(bodyStr);

        // Extraer decoded_payload y rx_metadata
        const payload = bodyObj.uplink_message.decoded_payload;
        const rxMetadata = bodyObj.uplink_message.rx_metadata;

        console.log("📡 Datos recibidos:", payload);

        if (!Array.isArray(rxMetadata) || rxMetadata.length === 0) {
            console.error("❌ Error: rxMetadata no es un array válido o está vacío.");
            return NextResponse.json({ error: "rxMetadata inválido" }, { status: 400 });
        }

        // Conectar con Supabase
        const supabase = await createClient();

        // Insertar el punto geográfico y obtener su ID
        const { data: pointData, error: pointError } = await supabase.from("geo_points").insert([
            {
                latitude: payload.lat,
                longitude: payload.lon
            }
        ]).select("id").single();

        if (pointError) {
            console.error('❌ Error al insertar el punto geográfico en Supabase:', pointError);
            return NextResponse.json({ error: "Error en Supabase" }, { status: 500 });
        }

        const pointId = pointData.id;

        // Procesar todos los gateways presentes en rx_metadata
        const measurements = rxMetadata.map(gatewayData => {
            const gatewayId = gatewayData.gateway_ids?.gateway_id || "desconocido";
            const rssi = typeof gatewayData.rssi === "number" ? gatewayData.rssi : -120;
            const snr = typeof gatewayData.snr === "number" ? gatewayData.snr : -10;

            // Calcular calidad basada en RSSI
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

        console.log("📡 Datos a insertar:", measurements);

        // Insertar las mediciones de cobertura asociadas al punto geográfico
        const { data, error } = await supabase.from("quality_measurements").insert(measurements);

        if (error) {
            console.error('❌ Error al insertar en Supabase:', error);
            return NextResponse.json({ error: "Error en Supabase" }, { status: 500 });
        }

        console.log('✅ Datos insertados en Supabase:', data);
        return NextResponse.json({ success: true, inserted: measurements.length }, { status: 200 });
    } catch (error) {
        console.error("❌ Error procesando la solicitud:", error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}