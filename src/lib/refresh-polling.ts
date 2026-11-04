export type RefreshReason = "initial" | "poll" | "manual" | "resume" | "expiry" | "media";
export interface RefreshPlan { poll?: boolean; expiresAt?: number | number[] }
export interface RefreshClock {
  now: () => number;
  setTimeout: (callback: () => void, delay: number) => unknown;
  clearTimeout: (handle: unknown) => void;
}
export interface RefreshOptions<T> {
  fetch: (signal: AbortSignal, reason: RefreshReason) => Promise<T>;
  onData: (data: T) => RefreshPlan | void;
  onError?: (error: unknown) => void;
  onRefreshing?: (refreshing: boolean) => void;
  intervalMs: number;
  visible?: boolean;
  initial?: boolean;
  initialPlan?: RefreshPlan;
  clock?: RefreshClock;
}
const clock: RefreshClock = {
  now: () => Date.now(),
  setTimeout: (callback, delay) => setTimeout(callback, delay),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};
export function expiryDeadlines(values: (string | null | undefined)[]): number[] {
  return values.map(value => value ? Date.parse(value) : NaN).filter(Number.isFinite);
}
export function earliestExpiry(values: (string | null | undefined)[]): number | undefined {
  const times = expiryDeadlines(values);
  return times.length ? Math.min(...times) : undefined;
}
export function createRefreshController<T>(options: RefreshOptions<T>) {
  const time = options.clock ?? clock;
  let visible = options.visible ?? true;
  let disposed = false;
  let timer: unknown;
  let current: AbortController | null = null;
  let resumeQueued = false;
  let queued: RefreshReason | null = null;
  let plan = options.initialPlan ?? {};
  let attemptedExpiry: number | undefined;
  let lastResume = -Infinity;
  let lastMedia = -Infinity;
  const clear = () => { if (timer !== undefined) time.clearTimeout(timer); timer = undefined; };
  const arm = () => {
    clear();
    if (disposed || !visible || current) return;
    const now = time.now();
    const deadlines = Array.isArray(plan.expiresAt) ? plan.expiresAt : [plan.expiresAt];
    const eligible = deadlines.filter((value): value is number => value !== undefined && Number.isFinite(value) && value !== attemptedExpiry && (value > now || attemptedExpiry === undefined));
    const expiry = eligible.length ? Math.min(...eligible) : undefined;
    const expiryDelay = expiry !== undefined && Number.isFinite(expiry) && expiry !== attemptedExpiry && (expiry > now || attemptedExpiry === undefined)
      ? Math.max(1000, expiry - now) : Infinity;
    const pollDelay = plan.poll ? Math.max(1000, options.intervalMs) : Infinity;
    const delay = Math.min(expiryDelay, pollDelay);
    if (!Number.isFinite(delay)) return;
    const reason = expiryDelay <= pollDelay ? "expiry" : "poll";
    timer = time.setTimeout(() => {
      timer = undefined;
      if (reason === "expiry" && expiry !== undefined && expiry > time.now()) { arm(); return; }
      if (reason === "expiry") attemptedExpiry = expiry;
      void refresh(reason);
    }, Math.min(delay, 2147483647));
  };
  async function refresh(reason: RefreshReason = "manual"): Promise<boolean> {
    if (disposed || !visible) return false;
    if (current) { if (reason === "manual") queued = reason; return false; }
    const now = time.now();
    if (reason === "resume" && now - lastResume < 1000) return false;
    if (reason === "media" && now - lastMedia < 15000) return false;
    if (reason === "resume") lastResume = now;
    if (reason === "media") lastMedia = now;
    clear();
    const request = new AbortController();
    current = request;
    options.onRefreshing?.(true);
    try {
      const data = await options.fetch(request.signal, reason);
      if (!disposed && visible && !request.signal.aborted) plan = options.onData(data) ?? {};
    } catch (error) {
      if (!disposed && !request.signal.aborted) { plan = {}; options.onError?.(error); }
    } finally {
      current = null;
      if (!disposed) {
        options.onRefreshing?.(false);
        if (resumeQueued && visible) { resumeQueued = false; lastResume = -Infinity; void refresh("resume"); }
        else if (queued && visible) { const next = queued; queued = null; void refresh(next); }
        else arm();
      }
    }
    return true;
  }
  const controller = {
    refresh,
    setVisible(next: boolean) {
      if (disposed || next === visible) return;
      visible = next;
      if (!next) { clear(); current?.abort(); }
      else if (current) resumeQueued = true;
      else void refresh("resume").then(started => { if (!started) arm(); });
    },
    dispose() { disposed = true; clear(); current?.abort(); },
  };
  if (options.initial !== false) void refresh("initial"); else arm();
  return controller;
}
