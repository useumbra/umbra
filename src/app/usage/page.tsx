import { UsageClient } from "@/components/UsageClient";
import { WorkspaceShell } from "@/components/WorkspaceShell";

export default function UsagePage() {
  return (
    <WorkspaceShell>
      <UsageClient />
    </WorkspaceShell>
  );
}
