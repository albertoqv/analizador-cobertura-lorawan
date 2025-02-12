import { NextResponse } from 'next/server'
 
export async function POST(request: Request) {
    console.log("📡 Datos del cuerpo:", JSON.stringify(request.body, null, 2))
    return NextResponse.json({ hola: 'Hola' }, { status: 200 })
}