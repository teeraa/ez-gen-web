import { parseEnvelope } from "./api-envelope.ts";
import { EditorApiError } from "./video-editor-api";

export interface AiUsageTotals { replies: number; steps: number; inputTokens: number; outputTokens: number; costUsd: number | null }
export interface AiUsageModel extends AiUsageTotals { provider: string; model: string; inputPricePerMTok: number | null; outputPricePerMTok: number | null }
export interface AiUsageDay extends AiUsageTotals { day: string }
export interface AiUsageProject extends AiUsageTotals { projectId: string; title: string }
export interface AiUsage { days: number; since: string; priceSource: string; unpricedModel: boolean; total: AiUsageTotals; models: AiUsageModel[]; byDay: AiUsageDay[]; projects: AiUsageProject[] }

export async function fetchAiChatUsage(days: number, signal?: AbortSignal): Promise<AiUsage> {
  let response: Response;
  try { response = await fetch(`/api/proxy/video-editor/ai-chat/usage?days=${days}`, { signal, cache: "no-store" }); }
  catch (error) { if (error instanceof DOMException && error.name === "AbortError") throw error; throw new EditorApiError("การเชื่อมต่อขาดหาย กรุณาลองใหม่", 0, "NETWORK_ERROR"); }
  let payload: unknown;
  try { payload = await response.json(); } catch { throw new EditorApiError("อ่านคำตอบของระบบไม่ได้", response.status, "INVALID_RESPONSE"); }
  const body = parseEnvelope(payload);
  if (!response.ok || !body.data) throw new EditorApiError(body.message || "โหลดข้อมูลการใช้งานไม่สำเร็จ", response.status, body.errorCode || "REQUEST_FAILED");
  return body.data as AiUsage;
}
