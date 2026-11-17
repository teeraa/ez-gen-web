import { parseEnvelope } from "./api-envelope.ts";
import {EditorApiError, type EditorProject} from "./video-editor-api";
import type {AiEditOperation, AiEditProposal} from "./video-editor-ai-api";
import {parseSseFrames} from "./ai-chat-sse";

export type AiChatProposalStatus = "pending" | "applied" | "discarded" | "stale";
export interface AiChatTool {name: string; label: string; ok: boolean}
export interface AiChatProposal {baseRevision: number; summary: string; operations: AiEditOperation[]; proposal: AiEditProposal; status: AiChatProposalStatus; appliedRevision?: number}
export interface AiChatMessage {id: string; role: "user" | "assistant"; content: string; createdAt: string; tools: AiChatTool[]; proposal?: AiChatProposal; jobId?: string; error?: string}
export interface AiChatModel {id: string; provider: string; model: string; label: string; available: boolean; inputPricePerMTok: number | null; outputPricePerMTok: number | null}
export interface AiChatThread {models?: AiChatModel[]; defaultModel?: string; available: boolean; unavailableReason?: string; provider: string; model: string; cloudNotice: string; maxMessageLength: number; messages: AiChatMessage[]}
export type AiChatEvent =
  | {type: "status"; tool: string; label: string}
  | {type: "message"; message: AiChatMessage}
  | {type: "error"; code: string; text: string};

const base = "/api/proxy/video-editor/projects";
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object";
const path = (projectId: string, rest = "") => `${base}/${encodeURIComponent(projectId)}/ai-chat${rest}`;

async function json<T>(response: Response): Promise<T> {
  let payload: unknown;
  try {payload = await response.json();} catch {throw new EditorApiError("อ่านคำตอบของระบบไม่ได้ กรุณาลองใหม่", response.status, "INVALID_RESPONSE");}
  if (!object(payload)) throw new EditorApiError("ระบบส่งข้อมูลไม่สมบูรณ์", response.status, "INVALID_RESPONSE");
  const body = parseEnvelope(payload);
  if (!response.ok) throw new EditorApiError(body.message ?? "ดำเนินการไม่สำเร็จ", response.status, body.errorCode ?? "REQUEST_FAILED");
  if (!body.hasPayload) throw new EditorApiError("ระบบส่งข้อมูลไม่สมบูรณ์", response.status, "INVALID_RESPONSE");
  return body.data as T;
}
async function call<T>(url: string, method = "GET", body?: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {response = await fetch(url, {method, signal, cache: "no-store", headers: {"Content-Type": "application/json"}, ...(body === undefined ? {} : {body: JSON.stringify(body)})});}
  catch (error) {if (error instanceof DOMException && error.name === "AbortError") throw error; throw new EditorApiError("การเชื่อมต่อขาดหาย กรุณาลองใหม่", 0, "NETWORK_ERROR");}
  return json<T>(response);
}

export const videoEditorAiChatApi = {
  thread: (projectId: string, signal?: AbortSignal) => call<AiChatThread>(path(projectId), "GET", undefined, signal),
  /** Soft-deletes the project's chat and returns the (now empty) thread. */
  clear: (projectId: string, signal?: AbortSignal) => call<AiChatThread>(path(projectId), "DELETE", undefined, signal),
  apply: (projectId: string, messageId: string) => call<{message: AiChatMessage; project: EditorProject}>(path(projectId, `/messages/${encodeURIComponent(messageId)}/apply`), "POST", {}),
  discard: (projectId: string, messageId: string) => call<AiChatMessage>(path(projectId, `/messages/${encodeURIComponent(messageId)}/discard`), "POST", {}),
  /** Streams one reply; resolves with the stored assistant message (or rejects with the stream's error). */
  /** model is a "provider:model" id from thread.models; empty uses the server default. */
  async send(projectId: string, message: string, model: string, onEvent: (event: AiChatEvent) => void, signal?: AbortSignal): Promise<AiChatMessage> {
    let response: Response;
    try {response = await fetch(path(projectId, "/messages"), {method: "POST", signal, cache: "no-store", headers: {"Content-Type": "application/json", Accept: "text/event-stream"}, body: JSON.stringify({message, cloudConsent: true, ...(model ? {model} : {})})});}
    catch (error) {if (error instanceof DOMException && error.name === "AbortError") throw error; throw new EditorApiError("การเชื่อมต่อขาดหาย กรุณาลองใหม่", 0, "NETWORK_ERROR");}
    if (!(response.headers.get("content-type") ?? "").includes("text/event-stream") || !response.body) {
      await json<unknown>(response);
      throw new EditorApiError("ระบบไม่ได้ส่งคำตอบแบบต่อเนื่อง", response.status, "INVALID_RESPONSE");
    }
    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = "", stored: AiChatMessage | null = null, failure: EditorApiError | null = null;
    for (;;) {
      const {value, done} = await reader.read();
      if (value) buffer += value;
      const {events, rest} = parseSseFrames<AiChatEvent>(done ? buffer + "\n\n" : buffer);
      buffer = rest;
      for (const event of events) {
        onEvent(event);
        if (event.type === "message") stored = event.message;
        if (event.type === "error") failure = new EditorApiError(event.text || "AI ตอบไม่สำเร็จ", 200, event.code || "AI_CHAT_FAILED");
      }
      if (done) break;
    }
    if (stored) return stored;
    throw failure ?? new EditorApiError("การเชื่อมต่อหลุดก่อน AI ตอบเสร็จ คำตอบอาจถูกบันทึกแล้ว ลองโหลดใหม่", 0, "STREAM_CLOSED");
  },
};
