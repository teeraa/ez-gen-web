import { Suspense } from "react";
import { ProjectList } from "@/components/production/project-list";
export default function ProjectsPage() {
  return (
    <Suspense fallback={<p>กำลังเปิดโปรเจกต์…</p>}>
      <ProjectList />
    </Suspense>
  );
}
