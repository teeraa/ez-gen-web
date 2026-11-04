import { Suspense } from "react";
import { AiEditorEntry } from "@/components/ai-editor/ai-editor-entry";
import { ProjectHubSkeleton } from "@/components/ai-editor/project-hub";

export const metadata = { title: "AI ตัดต่อ · AGENT STUDIO" };

export default function AiEditorPage() {
  // useSearchParams needs a Suspense boundary under Cache Components.
  return <Suspense fallback={<ProjectHubSkeleton />}><AiEditorEntry /></Suspense>;
}
