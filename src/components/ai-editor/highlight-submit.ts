export const DEFAULT_HIGHLIGHT_BRIEF = "สรุปไฮไลต์สำคัญจากคลิปให้กระชับ เลือกช่วงเด่นที่มีหลักฐานจากต้นฉบับ พร้อมข้อความและเสียงที่เหมาะสม";
export function highlightBrief(brief: string, autoMode: boolean): string {
  return brief.trim() || (autoMode ? DEFAULT_HIGHLIGHT_BRIEF : "");
}
export type HighlightIssue = {field: "selection" | "brief" | "target" | "consent"; message: string};
export function highlightSubmissionIssue(input: {selectedCount: number; selectedReady: boolean; maxAssets: number; sourceDuration: number; maxSourceDuration: number; brief: string; autoMode: boolean; target: number; maxTarget: number; consent: boolean}): HighlightIssue | null {
  if (!input.selectedCount || !input.selectedReady) return {field:"selection",message:"เลือกคลิปที่พร้อมใช้อย่างน้อย 1 คลิปก่อนสร้างไฮไลต์"};
  if (input.selectedCount>input.maxAssets) return {field:"selection",message:`เลือกได้สูงสุด ${input.maxAssets} คลิป`};
  if (!Number.isFinite(input.sourceDuration) || input.sourceDuration>input.maxSourceDuration) return {field:"selection",message:`เลือกคลิปความยาวรวมไม่เกิน ${input.maxSourceDuration/60} นาที`};
  if (!highlightBrief(input.brief,input.autoMode)) return {field:"brief",message:"พิมพ์สิ่งที่ต้องการให้ AI ตัดต่อก่อนเริ่มวิเคราะห์"};
  if (!Number.isFinite(input.target) || input.target<1 || input.target>input.maxTarget) return {field:"target",message:`ตั้งความยาวเป้าหมายระหว่าง 1–${input.maxTarget} วินาที`};
  if (!input.consent) return {field:"consent",message:"กรุณาติ๊กยินยอมส่งภาพตัวอย่างและข้อความเพื่อวิเคราะห์ก่อนเริ่ม"};
  return null;
}
