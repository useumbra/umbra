import { MediaGenerator } from "@/components/MediaGenerator";
import { WorkspaceShell } from "@/components/WorkspaceShell";

export default function ImagePage() {
  return (
    <WorkspaceShell>
      <MediaGenerator kind="image" />
    </WorkspaceShell>
  );
}
