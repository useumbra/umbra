import { ConnectorsClient } from "@/components/ConnectorsClient";
import { WorkspaceShell } from "@/components/WorkspaceShell";

export default function ConnectorsPage() {
  return (
    <WorkspaceShell>
      <ConnectorsClient />
    </WorkspaceShell>
  );
}
