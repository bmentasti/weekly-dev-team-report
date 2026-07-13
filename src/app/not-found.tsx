import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { getT } from "@/lib/i18n/server";

export default function NotFound() {
  const { t } = getT();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6 text-center">
      <Logo iconClassName="h-9 w-9 text-navy" />
      <div>
        <p className="text-5xl font-bold tracking-tight text-navy">404</p>
        <p className="mt-2 text-muted-foreground">
          {t("mc.notFound.desc")}
        </p>
      </div>
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/">{t("mc.notFound.home")}</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">{t("mc.notFound.dashboard")}</Link>
        </Button>
      </div>
    </div>
  );
}
