import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

interface Params {
  params: {
    pointId: string; // El ID del punto
  };
}

export async function GET(request: Request, { params }: Params) {
  const supabase = await createClient();
  const { pointId } = params;

  try {
    // Obtener las mediciones de calidad para un punto
    const { data: measurements, error } = await supabase
      .from("quality_measurements")
      .select("id, quality, created_at, gateway_id, point_id") // Obtenemos los gateway_id y la calidad de la medición
      .eq("point_id", pointId);  // Usamos point_id que está relacionado con geo_point_id

    if (error) {
      console.error("❌ Error al obtener mediciones:", error);
      return NextResponse.json({ error: "Error al obtener mediciones" }, { status: 500 });
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
      ], // Aquí puedes agregar más gateways si tienes más de uno asociado
      formatted_date: new Date(measurement.created_at).toLocaleString(), // Formateamos la fecha
    }));

    // Responder con las mediciones y los gateways
    return NextResponse.json(formattedData, { status: 200 });
  } catch (err) {
    console.error("❌ Error en el servidor:", err);
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}