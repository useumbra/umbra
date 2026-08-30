import { ModelsClient } from "@/components/ModelsClient";
import { WorkspaceShell } from "@/components/WorkspaceShell";
import { availableModels } from "@/lib/providers/select";

export default function ModelsPage() {
  return (
    <WorkspaceShell>
      <ModelsClient models={availableModels()} />
    </WorkspaceShell>
  );
}
