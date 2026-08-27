import { ModelsClient } from "@/components/ModelsClient";
import { WorkspaceShell } from "@/components/WorkspaceShell";

export default function ModelsPage() {
  return (
    <WorkspaceShell>
      <ModelsClient />
    </WorkspaceShell>
  );
}
