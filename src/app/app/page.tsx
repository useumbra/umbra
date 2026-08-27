import { ChatClient } from "@/components/ChatClient";
import { WorkspaceShell } from "@/components/WorkspaceShell";
export default function AppPage() {
  return (
    <WorkspaceShell>
      <ChatClient />
    </WorkspaceShell>
  );
}
