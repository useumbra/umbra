import { CouncilClient } from "@/components/CouncilClient";
import { WorkspaceShell } from "@/components/WorkspaceShell";

export default function CouncilPage() {
  return (
    <WorkspaceShell>
      <CouncilClient />
    </WorkspaceShell>
  );
}
