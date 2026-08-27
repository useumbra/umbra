import { CodeGenerator } from "@/components/CodeGenerator";
import { WorkspaceShell } from "@/components/WorkspaceShell";

export default function CodePage() {
  return (
    <WorkspaceShell>
      <CodeGenerator />
    </WorkspaceShell>
  );
}
