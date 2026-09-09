import { NextRequest, NextResponse } from "next/server";

// Protege todas las rutas salvo /login y las de la propia autenticación.
// La cookie "site_auth" la establece app/api/login/route.ts tras validar
// la contraseña en el servidor (nunca en el navegador).
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicPath =
    pathname === "/login" ||
    pathname.startsWith("/api/login") ||
    pathname.startsWith("/api/quality_points") || // lo consume el propio mapa autenticado
    pathname.startsWith("/uplink-webhook"); // lo llama TTN, no un navegador

  if (isPublicPath) {
    return NextResponse.next();
  }

  const sitePassword = process.env.SITE_PASSWORD;
  const authCookie = request.cookies.get("site_auth")?.value;

  if (!sitePassword || authCookie !== sitePassword) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
