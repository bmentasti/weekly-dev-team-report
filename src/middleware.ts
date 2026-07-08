export { default } from "next-auth/middleware";

// Protege toda el área autenticada (route group (app)). Sin sesión se redirige
// a /login (authOptions.pages). La defensa real también vive en el layout
// server-side; esto agrega protección en el edge. /ayuda y marketing son
// públicas a propósito. (H7)
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/onboarding/:path*",
    "/workspace/:path*",
    "/projects/:path*",
    "/reports/:path*",
    "/integrations/:path*",
    "/teams/:path*",
    "/people/:path*",
    "/settings/:path*",
  ],
};
