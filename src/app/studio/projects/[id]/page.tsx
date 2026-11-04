import { Suspense } from "react";
import { ProductionWorkspace } from "@/components/production/workspace";
async function Project({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ProductionWorkspace projectId={id} />;
}
export default function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<p>กำลังเปิดพื้นที่สร้างวิดีโอ…</p>}>
      <Project params={params} />
    </Suspense>
  );
}
