import { HelpCenter } from "@/components/help-center";
import { getT } from "@/lib/i18n/server";

export function generateMetadata() {
  const { t } = getT();
  return {
    title: t("mc.help.metaTitle"),
    description: t("mc.help.metaDesc"),
  };
}

export default function HelpPage() {
  return <HelpCenter />;
}
