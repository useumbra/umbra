import { MediaGenerator } from "@/components/MediaGenerator";
import { WorkspaceShell } from "@/components/WorkspaceShell";

export default function VideoPage() {
  return (
    <WorkspaceShell>
      <MediaGenerator kind="video" />
    </WorkspaceShell>
  );
}
