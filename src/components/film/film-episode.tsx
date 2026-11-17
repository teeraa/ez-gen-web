"use client";
// Opens one episode of a film story: its elements, shots and per-shot videos (film API).
import { FilmWorkspace } from "./film-workspace";

export function FilmEpisode({ seriesId, episodeId }: { seriesId: string; episodeId: string }) {
  return <FilmWorkspace seriesId={seriesId} episodeId={episodeId} />;
}
