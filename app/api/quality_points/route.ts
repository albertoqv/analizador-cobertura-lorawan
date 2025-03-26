// app/api/quality_points/route.ts

import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
  const supabase = await createClient();

  try {
    // 1. Obtener todos los puntos con su best_quality
    const { data: geoPoints, error: geoError } = await supabase
      .from("geo_points")
      .select("id, latitude, longitude, created_at, best_quality");

    if (geoError) {
      console.error("❌ Error obteniendo geo_points:", geoError);
      return NextResponse.json(
        { error: "Error obteniendo datos de geo_points" },
        { status: 500 }
      );
    }

    // 2. Para cada punto, si tiene best_quality, buscamos la quality correspondiente
    const formattedData = [];

    for (const point of geoPoints) {
      if (!point.latitude || !point.longitude) {
        // Saltamos los que no tengan coords
        continue;
      }

      let score = 0; // valor por defecto

      if (point.best_quality) {
        // Consulta a quality_measurements para el ID de best_quality
        const { data: measurement, error: measureError } = await supabase
          .from("quality_measurements")
          .select("quality")
          .eq("id", point.best_quality)
          .single();

        if (measureError) {
          console.error(
            `❌ Error obteniendo measurement con ID=${point.best_quality}:`,
            measureError
          );
        } else {
          // Si todo va bien, measurement?.quality será el valor que necesitamos
          score = measurement?.quality ?? 0;
        }
      }

    
      formattedData.push({
        COORDINATES: [point.longitude, point.latitude],
        SCORE: score,
        ID: point.id,
        DATE:point.created_at, 
        
      });
    }

    // 3. Respuesta final
    return NextResponse.json(formattedData, { status: 200 });
  } catch (err) {
    console.error("❌ Error interno del servidor:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
