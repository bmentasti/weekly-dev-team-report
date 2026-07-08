import { BackButton } from "@/components/back-button";
import { StandardsEditor } from "@/components/standards-editor";
import { AlertRulesManager } from "@/components/alert-rules-manager";

export const metadata = {
  title: "Umbrales de salud · DevMetrics",
};

export default function StandardsPage() {
  return (
    <div className="space-y-4">
      <BackButton label="Volver a Reportes" />
      <StandardsEditor />
      <div className="mx-auto max-w-5xl">
        <AlertRulesManager />
      </div>
    </div>
  );
}
