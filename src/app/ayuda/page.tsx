import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { HelpCenter } from "@/components/help-center";
import { getT } from "@/lib/i18n/server";

export function generateMetadata() {
  const { t } = getT();
  return {
    title: t("mc.ayuda.metaTitle"),
    description: t("mc.ayuda.metaDesc"),
  };
}

export default async function PublicHelpPage() {
  const { t } = getT();
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
              {t("mc.ayuda.navProduct")}
            </Link>
            <Link href="/#reportes" className="hover:text-foreground">
              {t("mc.ayuda.navReports")}
            </Link>
            <Link href="/#precios" className="hover:text-foreground">
              {t("mc.ayuda.navPricing")}
            </Link>
            <Link href="/#contacto" className="hover:text-foreground">
              {t("mc.ayuda.navContact")}
            </Link>
          </nav>
          <div className="flex items-center gap-2">
            {session ? (
              <Button asChild>
                <Link href="/dashboard">{t("mc.ayuda.dashboard")}</Link>
              </Button>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/login">{t("mc.ayuda.login")}</Link>
                </Button>
                <Button asChild>
                  <Link href="/register">{t("mc.ayuda.tryFree")}</Link>
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
            {t("mc.ayuda.backHome")}
          </Link>
          <span>© {new Date().getFullYear()} DevMetrics</span>
        </div>
      </footer>
    </div>
  );
}
