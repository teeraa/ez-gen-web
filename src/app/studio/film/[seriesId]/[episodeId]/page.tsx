import { Suspense } from "react";
import { FilmEpisode } from "@/components/film/film-episode";

export const metadata = { title: "สร้างหนัง — EZ-Gen" };

async function Episode({ params }: { params: Promise<{ seriesId: string; episodeId: string }> }) {
  const { seriesId, episodeId } = await params;
  return <FilmEpisode seriesId={seriesId} episodeId={episodeId} />;
}

export default function FilmEpisodePage({ params }: { params: Promise<{ seriesId: string; episodeId: string }> }) {
  return (
    <Suspense fallback={<p role="status">กำลังเปิดตอน…</p>}>
      <Episode params={params} />
    </Suspense>
  );
}
