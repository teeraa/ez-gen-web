import type { JobStatus } from "@/types/api";
export const jobStatusLabel: Record<JobStatus, string> = {
  queued: "รอคิว",
  submitted: "ส่งคำขอแล้ว",
  processing: "กำลังสร้าง",
  succeeded: "เสร็จสมบูรณ์",
  failed: "ไม่สำเร็จ",
  cancelled: "ยกเลิกแล้ว",
};
