import { Logo } from "@/components/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Brand panel */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-navy px-8 py-10 text-white lg:w-1/2 lg:px-14 lg:py-14">
        <div className="pointer-events-none absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative">
          <Logo className="text-white" iconClassName="h-9 w-9" />
        </div>
        <div className="relative mt-10 max-w-md lg:mt-0">
          <span className="inline-block rounded-full bg-primary px-3 py-1 text-xs font-semibold">
            Engineering Intelligence
          </span>
          <h1 className="mt-6 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            Convertí los datos de ingeniería en decisiones
          </h1>
          <p className="mt-4 text-sm text-white/70 sm:text-base">
            Reportes en tiempo real de Jira, GitHub y más para entregar con
            confianza y sin armar nada a mano.
          </p>
        </div>
        <div className="relative mt-10 hidden items-center gap-3 text-sm text-white/70 lg:flex">
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20">
            🔒
          </span>
          <div>
            <p className="font-medium text-white">Seguridad enterprise</p>
            <p className="text-xs text-white/60">
              Tus datos están encriptados y nunca se comparten.
            </p>
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-white px-6 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
