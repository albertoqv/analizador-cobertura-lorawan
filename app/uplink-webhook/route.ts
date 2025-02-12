import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server';
 
export async function POST(request: Request) {
    const bodyStr = await request.text()
    const bodyObj = JSON.parse(bodyStr)
    const payload = bodyObj.uplink_message.decoded_payload
    console.log("📡 Datos del cuerpo:", payload)
    const supabase = await createClient();
    const { data: notes } = await supabase.from("quality_measure").insert(
        {
            latitude: payload.lat,
            longitud: payload.lon,
            quality: "100"
        }
    );
    return NextResponse.json({ success: true }, { status: 200 })
}
