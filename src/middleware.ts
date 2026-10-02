import { NextRequest, NextResponse } from "next/server";

// Protege el panel /admin y sus descargas con usuario y contraseña.
export const config = { matcher: ["/admin/:path*", "/api/admin/:path*"] };

export function middleware(req: NextRequest) {
  const user = process.env.ADMIN_USER || "admin";
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    return new NextResponse("Configura ADMIN_PASSWORD en Vercel para usar el panel.", { status: 503 });
  }

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const [u, ...rest] = atob(header.slice(6)).split(":");
      if (u === user && rest.join(":") === password) return NextResponse.next();
    } catch {
      /* encabezado inválido */
    }
  }

  return new NextResponse("Acceso restringido", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Panel subasta", charset="UTF-8"' },
  });
}
