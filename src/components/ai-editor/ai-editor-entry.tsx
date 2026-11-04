"use client";

import { useSearchParams } from "next/navigation";
import { AiEditor } from "./ai-editor";
import { ProjectHub } from "./project-hub";

export function AiEditorEntry() {
  // Unkeyed on purpose: the editor rewrites ?project= with replaceState and must not remount when it does.
  const projectId = useSearchParams().get("project");
  return projectId ? <AiEditor projectId={projectId} /> : <ProjectHub />;
}
