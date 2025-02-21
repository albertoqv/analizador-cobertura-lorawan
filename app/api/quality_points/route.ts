// app/api/hex-data/route.ts
import { NextResponse } from "next/server";
import { createClient } from '@/utils/supabase/server';


export async function GET() {
    // 🔹 Consultar los datos desde Supabase
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("quality_measure")
    .select("latitude, longitude, quality");

  if (error) {
    console.error("❌ Error obteniendo datos de Supabase:", error);
    return NextResponse.json({ error: "Error obteniendo datos" }, { status: 500 });
  }

  // 🔹 Transformar los datos para Deck.gl
  const formattedData = data
    .filter((item) => item.latitude && item.longitude) // 🔹 Filtrar valores nulos
    .map((item) => ({
      COORDINATES: [item.longitude, item.latitude], // 🔹 Formato compatible con HexagonLayer
      SCORE: (item.quality ? parseInt(item.quality, 10) || 0 : 0), // 🔹 Convertir quality a número
    }));

  return NextResponse.json(formattedData);
}
