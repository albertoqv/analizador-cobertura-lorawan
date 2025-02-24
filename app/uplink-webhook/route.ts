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

        // Verificar si rxMetadata es un array antes de usar .find()
        if (!Array.isArray(rxMetadata)) {
            console.error("❌ Error: rxMetadata no es un array o es undefined.");
            return NextResponse.json({ error: "rxMetadata inválido" }, { status: 400 });
        }

        // Buscar el gateway con ID "enlace-alberto"
        const gatewayData = rxMetadata.find(gw => gw.gateway_id === "enlace-alberto");

        if (!gatewayData) {
            console.error("❌ No se encontró el gateway 'enlace-alberto'");
            return NextResponse.json({ error: "Gateway no encontrado" }, { status: 400 });
        }

        // Extraer valores de RSSI y SNR
        const rssi = typeof gatewayData.rssi === "number" ? gatewayData.rssi : -120;
        const snr = typeof gatewayData.snr === "number" ? gatewayData.snr : -10;

        // Calcular calidad (quality) con -30 dBm como referencia
        let quality = Math.max(0, 100 + (rssi + 120) / 2 + snr * 5);
        quality = Math.min(100, parseFloat(quality.toFixed(2))); // Límite máximo de 100

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
