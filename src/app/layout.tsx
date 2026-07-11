import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { I18nProvider } from "@/components/i18n-provider";
import { getLocale } from "@/lib/i18n/server";
import { DICTIONARIES } from "@/lib/i18n/dictionaries";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DevMetrics — Clear engineering reports in one click",
  description:
    "Convertí los datos de ingeniería en decisiones. Reportes en tiempo real de Jira, GitHub y más: avance, bloqueos, PRs, riesgos y recomendaciones.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = getLocale();
  return (
    <html lang="es" suppressHydrationWarning className={inter.variable}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{if(localStorage.getItem('theme')==='dark'){document.documentElement.classList.add('dark');}}catch(e){}})();",
          }}
        />
      </head>
      <body className="font-sans">
        <I18nProvider locale={locale} dict={DICTIONARIES[locale]}>
          <Providers>{children}</Providers>
        </I18nProvider>
      </body>
    </html>
  );
}
