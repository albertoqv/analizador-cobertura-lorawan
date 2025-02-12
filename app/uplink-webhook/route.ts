import { NextResponse } from 'next/server'
 
export async function POST(request: Request) {
    console.log("📡 Datos del cuerpo:", request.text)
    return NextResponse.json({ hola: 'Hola' }, { status: 200 })
}