import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background px-6 text-center">
      <Logo iconClassName="h-9 w-9 text-navy" />
      <div>
        <p className="text-5xl font-bold tracking-tight text-navy">404</p>
        <p className="mt-2 text-muted-foreground">
          No encontramos la página que buscabas.
        </p>
      </div>
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/">Volver al inicio</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">Ir al dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
