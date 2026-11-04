// Pure transcript -> subtitle text-layer mapping. No runtime imports (node tests load this file directly).
export type SubtitleTranscript = {
  assetId: string;
  segments: { start: number; end: number; text: string }[];
  refinement?: { segments: { segmentIndex: number; text: string; uncertain: boolean }[] } | null;
};
export type SubtitleVideoSegment = { asset: string; start: number; end: number; at: number; speed?: number };
export type SubtitleLayer = { id: string; text: string; start: number; end: number; x: number; y: number; fontSize: number; color: string; align: "center" };

// Text-layer ids must be UUIDs, so generated subtitles carry a fixed marker in the node group.
const MARK = "5ab71e";
export function subtitleId(random: string) { return `${random.slice(0, 24)}${MARK}${random.slice(30, 36)}`; }
export function isSubtitleId(id: string) { return id.length === 36 && id.slice(24, 30).toLowerCase() === MARK; }

export const SUBTITLE_STYLE = { x: .5, y: .86, fontSize: 44, color: "#FFFFFF", align: "center" as const, linesPerCard: 2 };
const MIN_DURATION = .2;
const round = (value: number) => Math.round(value * 1000) / 1000;

/** Preferred segment text: refined unless uncertain (then original). */
export function transcriptSegmentText(transcript: SubtitleTranscript, index: number) {
  const refined = transcript.refinement?.segments.find(item => item.segmentIndex === index);
  const text = refined && !refined.uncertain && refined.text.trim() ? refined.text : transcript.segments[index]?.text ?? "";
  // Same rejected set as tracks.ts sanitizeText (kept local: this file has no runtime imports).
  return text.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\u2028\u2029\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g, " ").replace(/\s+/g, " ").trim();
}

/** Characters per line that fit a frame with aspect ratio `ratio` (w/h) at the 1080 reference height. */
export function lineCharsFor(ratio: number, fontSize = SUBTITLE_STYLE.fontSize) {
  return Math.max(10, Math.min(42, Math.floor(1080 * ratio * .9 / (fontSize * .6))));
}

type SegmenterCtor = new (locale: string, options: { granularity: "word" | "grapheme" }) => { segment(input: string): Iterable<{ segment: string }> };
const Segmenter = (Intl as unknown as { Segmenter?: SegmenterCtor }).Segmenter;
const wordSegmenter = Segmenter && new Segmenter("th", { granularity: "word" });
const graphemeSegmenter = Segmenter && new Segmenter("th", { granularity: "grapheme" });

/** User-perceived characters: Thai vowels/tone marks stay attached to their base consonant. */
export function graphemes(text: string): string[] {
  if (graphemeSegmenter) return Array.from(graphemeSegmenter.segment(text), part => part.segment);
  // Fallback without Intl.Segmenter: attach combining/spacing marks (Thai vowels/tones, SARA AM, ZWJ) to the previous cluster.
  return Array.from(text).reduce<string[]>((clusters, char) => { if (clusters.length && /[\p{M}\u0E33\u0EB3\u200D]/u.test(char)) clusters[clusters.length - 1] += char; else clusters.push(char); return clusters; }, []);
}
function tokens(text: string): string[] {
  return wordSegmenter ? Array.from(wordSegmenter.segment(text), part => part.segment) : text.split(/(\s+)/);
}

/** Greedy wrap on Thai-aware word boundaries; words longer than a line split on grapheme boundaries. */
export function wrapLines(text: string, lineChars: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const token of tokens(text)) {
    const clusters = graphemes(token);
    const parts = clusters.length > lineChars ? clusters.reduce<string[]>((chunks, cluster, index) => { if (index % lineChars === 0) chunks.push(""); chunks[chunks.length - 1] += cluster; return chunks; }, []) : [token];
    for (const part of parts) {
      if (graphemes(line + part).length > lineChars && line.trim()) { lines.push(line.trim()); line = part.trimStart(); }
      else line += part;
    }
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

/** Split one caption across cards of ≤linesPerCard lines, dividing the time proportionally to characters. */
export function captionCards(text: string, start: number, end: number, lineChars: number, linesPerCard = SUBTITLE_STYLE.linesPerCard) {
  const lines = wrapLines(text, lineChars);
  const cards: string[] = [];
  for (let index = 0; index < lines.length; index += linesPerCard) cards.push(lines.slice(index, index + linesPerCard).join("\n"));
  const weights = cards.map(card => Array.from(card.replace(/\n/g, "")).length || 1);
  const sum = weights.reduce((total, weight) => total + weight, 0);
  let cursor = start;
  return cards.map((card, index) => {
    const cardEnd = index === cards.length - 1 ? end : cursor + (end - start) * weights[index] / sum;
    const item = { text: card, start: round(cursor), end: round(cardEnd) };
    cursor = cardEnd;
    return item;
  });
}

/**
 * Map transcript segments (source seconds of `assetId`) onto the timeline through every video segment that
 * uses the asset: [segStart,segEnd] ∩ [segment.start,segment.end] → segment.at + (t - segment.start) / speed.
 */
export function mapTranscriptsToTimeline(transcripts: SubtitleTranscript[], timeline: SubtitleVideoSegment[]) {
  const cues: { text: string; start: number; end: number }[] = [];
  for (const transcript of transcripts) {
    transcript.segments.forEach((spoken, index) => {
      const text = transcriptSegmentText(transcript, index);
      if (!text) return;
      for (const segment of timeline) {
        if (segment.asset !== transcript.assetId) continue;
        const from = Math.max(spoken.start, segment.start), to = Math.min(spoken.end, segment.end);
        if (to - from < MIN_DURATION) continue;
        const speed = segment.speed && segment.speed > 0 ? segment.speed : 1;
        cues.push({ text, start: segment.at + (from - segment.start) / speed, end: segment.at + (to - segment.start) / speed });
      }
    });
  }
  return cues.sort((left, right) => left.start - right.start || left.end - right.end);
}

export function buildSubtitleLayers(transcripts: SubtitleTranscript[], timeline: SubtitleVideoSegment[], options: { ratio: number; capacity: number; makeId: () => string; maxTimeline?: number }) {
  const maxTimeline = options.maxTimeline ?? 1200;
  const lineChars = lineCharsFor(options.ratio);
  const layers: SubtitleLayer[] = [];
  let dropped = 0;
  for (const cue of mapTranscriptsToTimeline(transcripts, timeline)) {
    for (const card of captionCards(cue.text, cue.start, Math.min(cue.end, maxTimeline), lineChars)) {
      if (card.end - card.start < .1 || card.start >= maxTimeline) continue;
      if (layers.length >= options.capacity) { dropped++; continue; }
      layers.push({ id: subtitleId(options.makeId()), text: Array.from(card.text).slice(0, 500).join(""), start: card.start, end: card.end, x: SUBTITLE_STYLE.x, y: SUBTITLE_STYLE.y, fontSize: SUBTITLE_STYLE.fontSize, color: SUBTITLE_STYLE.color, align: SUBTITLE_STYLE.align });
    }
  }
  return { layers, dropped };
}

/** True when at least one transcript has a non-blank segment of a timeline asset. */
export function hasUsableTranscript(transcripts: SubtitleTranscript[], timeline: SubtitleVideoSegment[]) {
  return mapTranscriptsToTimeline(transcripts, timeline).length > 0;
}
