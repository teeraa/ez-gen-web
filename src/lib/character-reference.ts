export const maxReferenceBytes = 8 * 1024 * 1024;
export function validateReferenceFile(file: { type: string; size: number }): string | null {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return "กรุณาเลือกภาพ PNG, JPEG หรือ WebP";
  if (file.size <= 0) return "ไฟล์ภาพว่าง กรุณาเลือกภาพใหม่";
  if (file.size > maxReferenceBytes) return "ภาพอ้างอิงต้องมีขนาดไม่เกิน 8 MB";
  return null;
}
