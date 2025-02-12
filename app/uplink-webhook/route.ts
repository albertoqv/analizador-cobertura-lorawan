import { NextResponse } from 'next/server'
 
export async function POST(request: Request) {
    console.log("📡 Datos del cuerpo:", await request.text())
    return NextResponse.json({ hola: 'Hola' }, { status: 200 })
}