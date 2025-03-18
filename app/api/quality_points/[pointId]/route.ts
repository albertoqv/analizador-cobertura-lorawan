// app/api/quality_points/[pointId]/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { NextRequest } from "next/server";

// Aquí se define correctamente el tipo de los parámetros
export async function GET(request: NextRequest, { params }: { params: { pointId: string } }) {
  const supabase = await createClient();
  const { pointId } = params; // Accedemos a params desde context

  try {
    // Obtener las mediciones de calidad para un punto
    const { data: measurements, error } = await supabase
      .from("quality_measurements")
      .select("id, quality, created_at, gateway_id, point_id")
      .eq("point_id", pointId);

    if (error) {
      console.error("❌ Error al obtener mediciones:", error);
      return NextResponse.json(
        { error: "Error al obtener mediciones" },
        { status: 500 }
      );
    }

    // Si no hay mediciones, devolver un mensaje predeterminado
    if (!measurements || measurements.length === 0) {
      return NextResponse.json(
        { message: "No recibió conexión de ningún gateway" },
        { status: 404 }
      );
    }

    // Formatear los datos para incluir los gateways y la calidad
    const formattedData = measurements.map((measurement) => ({
      ...measurement,
      gateways: [
        { gateway_id: measurement.gateway_id, quality: measurement.quality },
      ],
      formatted_date: new Date(measurement.created_at).toLocaleString(),
    }));

    // Responder con las mediciones y los gateways
    return NextResponse.json(formattedData, { status: 200 });
  } catch (err) {
    console.error("❌ Error en el servidor:", err);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
