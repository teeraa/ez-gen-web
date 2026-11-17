// Pure server-sent-event framing for the AI chat stream. No imports, so node --test loads it directly.

/** Splits a text/event-stream buffer into JSON events with a string type; the unfinished tail is returned as rest and malformed frames are skipped. */
export function parseSseFrames<T extends {type: string}>(buffer: string): {events: T[]; rest: string} {
  const events: T[] = [];
  const frames = buffer.split(/\r?\n\r?\n/);
  const rest = frames.pop() ?? "";
  for (const frame of frames) {
    const data = frame.split(/\r?\n/).filter(line => line.startsWith("data:")).map(line => line.slice(5).trimStart()).join("\n");
    if (!data) continue;
    try {
      const event = JSON.parse(data) as unknown;
      if (event && typeof event === "object" && typeof (event as {type?: unknown}).type === "string") events.push(event as T);
    } catch {/* skip a broken frame */}
  }
  return {events, rest};
}
