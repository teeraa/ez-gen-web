import { Suspense } from "react";
import { DirectorExperiments } from "@/components/director/director-experiments";

async function Experiments({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DirectorExperiments id={id} />;
}

export default function DirectorExperimentsPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p role="status">กำลังโหลดผลทดลอง…</p>}>
      <Experiments params={params} />
    </Suspense>
  );
}
