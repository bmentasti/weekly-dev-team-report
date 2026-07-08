import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { HelpCenter } from "@/components/help-center";

export const metadata = {
  title: "Centro de Ayuda · DevMetrics",
  description:
    "Resolvé tus dudas sobre DevMetrics: qué es, integraciones, reportes, métricas, seguridad y planes.",
};

export default async function PublicHelpPage() {
  const session = await getServerSession(authOptions);

  return (
    <div className="min-h-screen bg-white text-foreground">
      {/* Header público */}
      <header className="sticky top-0 z-30 border-b bg-white/90 backdrop-blur">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/">
            <Logo iconClassName="h-8 w-8 text-navy" />
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <Link href="/#producto" className="hover:text-foreground">
              Producto
            </Link>
            <Link href="/#reportes" className="hover:text-foreground">
              Reportes
            </Link>
            <Link href="/#precios" className="hover:text-foreground">
              Precios
            </Link>
            <Link href="/#contacto" className="hover:text-foreground">
              Contacto
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            {session ? (
              <Button asChild>
                <Link href="/dashboard">Ir al dashboard</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/login">Iniciar sesión</Link>
                </Button>
                <Button asChild>
                  <Link href="/register">Probar gratis</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="container py-10">
        <HelpCenter />
      </main>

      {/* Footer simple */}
      <footer className="border-t bg-muted/40">
        <div className="container flex flex-col items-center justify-between gap-3 py-8 text-sm text-muted-foreground sm:flex-row">
          <Link href="/" className="hover:text-foreground">
            ← Volver al inicio
          </Link>
          <span>© {new Date().getFullYear()} DevMetrics</span>
        </div>
      </footer>
    </div>
  );
}
