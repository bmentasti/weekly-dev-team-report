"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  FileBarChart2,
  Plug,
  Users,
  Settings,
  FolderKanban,
  LifeBuoy,
  Menu,
  X,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { NotificationsBell } from "@/components/notifications-bell";
import { ProjectSwitcher } from "@/components/project-switcher";
import { DialogProvider } from "@/components/ui/dialog-provider";
import { PLANS, type PlanTierName } from "@/lib/plans";
import { can, type AccessRole, type Capability } from "@/lib/permissions";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  /** Capacidad requerida para ver el ítem (si no, se oculta). */
  requires?: Capability;
}

const NAV: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Proyectos", href: "/projects", icon: FolderKanban },
  { label: "Reportes", href: "/reports", icon: FileBarChart2 },
  {
    label: "Integraciones",
    href: "/integrations",
    icon: Plug,
    requires: "connectIntegrations",
  },
  { label: "Equipos", href: "/teams", icon: Users },
  { label: "Ajustes", href: "/settings", icon: Settings },
  { label: "Ayuda", href: "/help", icon: LifeBuoy },
];

function SidebarContent({
  pathname,
  onNavigate,
  plan,
  trialDaysLeft = 0,
  role = null,
}: {
  pathname: string;
  onNavigate?: () => void;
  plan?: string;
  trialDaysLeft?: number;
  role?: AccessRole | null;
}) {
  const planLabel = plan ? (PLANS[plan as PlanTierName]?.name ?? "Free") : "Free";
  const nav = NAV.filter((item) => !item.requires || can(role, item.requires));
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 py-5">
        <Logo className="text-white" iconClassName="h-8 w-8" />
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {nav.map((item) => {
          const base = item.href.split("#")[0];
          const active =
            !item.disabled &&
            base !== "#" &&
            (pathname === base || pathname.startsWith(`${base}/`));
          const Icon = item.icon;
          if (item.disabled) {
            return (
              <span
                key={item.label}
                className="flex items-center gap-3 rounded-button px-3 py-2.5 text-sm text-white/40"
              >
                <Icon className="h-5 w-5" />
                {item.label}
                <span className="ml-auto rounded-full bg-white/10 px-2 py-0.5 text-[10px]">
                  Pronto
                </span>
              </span>
            );
          }
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-button px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-white"
                  : "text-white/70 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-3">
        <Link
          href="/settings"
          onClick={onNavigate}
          className="block rounded-card bg-white/5 p-4 text-white transition-colors hover:bg-white/10"
        >
          <p className="text-sm font-semibold">Plan {planLabel}</p>
          <p className="mt-0.5 text-xs text-white/60">
            {trialDaysLeft > 0
              ? `Prueba Pro · ${trialDaysLeft} día${trialDaysLeft === 1 ? "" : "s"} restantes`
              : "Gestionar plan"}
          </p>
        </Link>
      </div>
    </div>
  );
}

export function AppShell({
  userName,
  workspaceName,
  plan,
  trialDaysLeft = 0,
  role = null,
  children,
}: {
  userName?: string | null;
  workspaceName?: string | null;
  plan?: string | null;
  trialDaysLeft?: number;
  role?: AccessRole | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <DialogProvider>
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 bg-navy lg:block">
        <SidebarContent
          pathname={pathname}
          plan={plan ?? undefined}
          trialDaysLeft={trialDaysLeft}
          role={role}
        />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-navy/50"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-64 bg-navy">
            <button
              className="absolute right-3 top-4 text-white/70"
              onClick={() => setOpen(false)}
              aria-label="Cerrar menú"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent
              pathname={pathname}
              onNavigate={() => setOpen(false)}
              plan={plan ?? undefined}
              trialDaysLeft={trialDaysLeft}
              role={role}
            />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-white px-4 sm:px-6">
          <button
            className="text-foreground lg:hidden"
            onClick={() => setOpen(true)}
            aria-label="Abrir menú"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="hidden sm:block">
            <ProjectSwitcher />
          </div>
          <div className="lg:hidden">
            <Logo showText={false} iconClassName="h-7 w-7 text-navy" />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <NotificationsBell />
            {userName && (
              <span className="hidden text-sm font-medium sm:inline">
                {userName}
              </span>
            )}
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
              {(userName ?? "U").charAt(0).toUpperCase()}
            </span>
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Salir
            </button>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
    </DialogProvider>
  );
}
