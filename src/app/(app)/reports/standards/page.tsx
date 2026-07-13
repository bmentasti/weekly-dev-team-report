import { BackButton } from "@/components/back-button";
import { StandardsEditor } from "@/components/standards-editor";
import { AlertRulesManager } from "@/components/alert-rules-manager";
import { getT } from "@/lib/i18n/server";

export const metadata = {
  title: "Umbrales de salud · DevMetrics",
};

export default function StandardsPage() {
  const { t } = getT();
  return (
    <div className="space-y-4">
      <BackButton label={t("rep2.backToReports")} />
      <StandardsEditor />
      <div className="mx-auto max-w-5xl">
        <AlertRulesManager />
      </div>
    </div>
  );
}
