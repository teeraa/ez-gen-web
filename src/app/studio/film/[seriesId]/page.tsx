import { Suspense } from "react";
import { FilmSeries } from "@/components/film/film-series";

export const metadata = { title: "ภาพยนตร์ — ตอนทั้งหมด" };

async function Series({ params }: { params: Promise<{ seriesId: string }> }) {
  const { seriesId } = await params;
  return <FilmSeries id={seriesId} />;
}

export default function FilmSeriesPage({ params }: { params: Promise<{ seriesId: string }> }) {
  return (
    <Suspense fallback={<p role="status">กำลังเปิดเรื่อง…</p>}>
      <Series params={params} />
    </Suspense>
  );
}
