// Keeps a hidden <audio> element in step with the studio playhead.
//
// The playhead comes from the video player and moves every frame. Seeking an audio element every
// frame stalls it (each seek drops its buffer), so the element is only moved when it is told to
// seek or drifts audibly away, and play() is not asked again while an earlier one is still starting.
// A signed URL that expired (the page stayed open past its hour) is swapped for the newest one.

const DRIFT = 0.3;

interface State { starting: boolean; url: string; failed: string }
const states = new WeakMap<HTMLMediaElement, State>();

function stateOf(a: HTMLMediaElement): State {
  let s = states.get(a);
  if (!s) {
    s = { starting: false, url: a.src, failed: "" };
    states.set(a, s);
  }
  return s;
}

/** Sets the element's source once; a later URL for the same file is used only after a load error. */
export function attachAudio(a: HTMLMediaElement, url: string) {
  const s = stateOf(a);
  s.url = url;
  if (!a.getAttribute("src")) {
    a.src = url;
    a.onerror = () => {
      // Expired or failed: try the newest URL once per URL.
      if (s.url && s.failed !== s.url) {
        s.failed = s.url;
        const at = a.currentTime;
        a.src = s.url;
        a.load();
        a.currentTime = at;
      }
    };
  }
}

/**
 * Moves the element to `at` seconds of its source and plays it, or pauses it when `at` is null.
 * `seeked` forces a jump even when the element is close to `at`.
 */
export function syncAudio(a: HTMLMediaElement, at: number | null, seeked: boolean) {
  const s = stateOf(a);
  if (at === null) {
    if (!a.paused) a.pause();
    return;
  }
  const far = Math.abs(a.currentTime - at) > DRIFT;
  if (s.starting) {
    if (seeked && far) a.currentTime = at;
    return;
  }
  if (seeked || far) {
    try { a.currentTime = at; } catch { /* not loaded yet: play() starts it near the right place */ }
  }
  if (a.paused) {
    s.starting = true;
    a.play().catch(() => {}).finally(() => { s.starting = false; });
  }
}
