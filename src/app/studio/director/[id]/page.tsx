import { Suspense } from "react";
import { DirectorProject } from "@/components/director/director-project";

async function Project({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DirectorProject id={id} />;
}

export default function DirectorProjectPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p role="status">กำลังเปิดโปรเจกต์…</p>}>
      <Project params={params} />
    </Suspense>
  );
}
