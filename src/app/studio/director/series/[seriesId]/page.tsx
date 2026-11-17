import { Suspense } from "react";
import { DirectorSeries } from "@/components/director/director-series";

async function Series({ params }: { params: Promise<{ seriesId: string }> }) {
  const { seriesId } = await params;
  return <DirectorSeries id={seriesId} />;
}

export default function DirectorSeriesPage({ params }: { params: Promise<{ seriesId: string }> }) {
  return (
    <Suspense fallback={<p role="status">กำลังเปิดโปรเจกต์…</p>}>
      <Series params={params} />
    </Suspense>
  );
}
