import { LeakChecker } from "@/components/LeakChecker";
import { WorkspaceShell } from "@/components/WorkspaceShell";
export default function LeakCheckPage() {
  return (
    <WorkspaceShell>
      <LeakChecker />
    </WorkspaceShell>
  );
}
