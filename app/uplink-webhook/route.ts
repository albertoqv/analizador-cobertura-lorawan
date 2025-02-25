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

        if (!Array.isArray(rxMetadata)) {
            console.error("❌ Error: rxMetadata no es un array o es undefined.");
            return NextResponse.json({ error: "rxMetadata inválido" }, { status: 400 });
        }

        // Buscar el gateway con ID "enlace-alberto"
        const gatewayData = rxMetadata.find(gw => gw.gateway_ids.gateway_id === "enlace-alberto");

        if (!gatewayData) {
            console.error("❌ No se encontró el gateway 'enlace-alberto'");
            return NextResponse.json({ error: "Gateway no encontrado" }, { status: 400 });
        }

        // Extraer valores de RSSI y SNR
        const rssi = typeof gatewayData.rssi === "number" ? gatewayData.rssi : -120;
        const snr = typeof gatewayData.snr === "number" ? gatewayData.snr : -10;

        // Mapear RSSI a un rango de calidad basado en la imagen
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

        quality = parseFloat(quality.toFixed(2));

        console.log(`📶 RSSI: ${rssi} dBm | 🔊 SNR: ${snr} dB | 🏆 Quality: ${quality}`);

        // Conectar con Supabase y almacenar los datos
        const supabase = await createClient();
        const { data, error } = await supabase.from("quality_measure").insert([
            {
                latitude: payload.lat,
                longitude: payload.lon,
                quality: quality
            }
        ]);

        if (error) {
            console.error('❌ Error al insertar en Supabase:', error);
            return NextResponse.json({ error: "Error en Supabase" }, { status: 500 });
        }

        console.log('✅ Datos insertados en Supabase:', data);
        return NextResponse.json({ success: true, quality: quality }, { status: 200 });

    } catch (error) {
        console.error("❌ Error procesando la solicitud:", error);
        return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
    }
}
