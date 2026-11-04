export type ImageCategory = "character" | "product";
export const visualStyles = [
  { value: "auto", label: "ตามคำอธิบาย" },
  { value: "cinematic_realistic", label: "สมจริงแบบภาพยนตร์" },
  { value: "3d_animation", label: "แอนิเมชัน 3 มิติ" },
  { value: "anime", label: "อนิเมะ" },
  { value: "illustration", label: "ภาพวาด" },
  { value: "clay", label: "ดินปั้น" },
] as const;
export const moods = [
  { value: "neutral", label: "เป็นกลาง" },
  { value: "warm", label: "อบอุ่น" },
  { value: "confident", label: "มั่นใจ" },
  { value: "mysterious", label: "ลึกลับ" },
  { value: "serious", label: "จริงจัง" },
  { value: "energetic", label: "มีชีวิตชีวา" },
] as const;
export const designFormats = [
  { value: "full_body", label: "เต็มตัว · แนะนำสำหรับวิดีโอ", description: "ตัวละครเดียว มุมตรง เห็นศีรษะถึงเท้า ท่าผ่อนคลาย พื้นหลังเรียบ เหมาะใช้เป็นภาพอ้างอิงหลัก" },
  { value: "turnaround", label: "ชีตออกแบบ 3 มุม", description: "ด้านหน้า ด้านข้าง และด้านหลัง สำหรับตรวจงานออกแบบ ควรใช้ภาพเต็มตัวมุมเดียวเมื่อนำไปสร้างวิดีโอ" },
  { value: "portrait", label: "ใบหน้าและไหล่", description: "เห็นรายละเอียดใบหน้าและทรงผมชัด เหมาะเป็นภาพอ้างอิงเพิ่มเติม" },
] as const;
export interface CharacterDesignOptions {
  visualStyle?: (typeof visualStyles)[number]["value"];
  mood?: (typeof moods)[number]["value"];
  designFormat?: (typeof designFormats)[number]["value"];
}
export interface CharacterDraft extends CharacterDesignOptions {
  category?: ImageCategory;
  prompt: string;
  aspectRatio?: string;
  referenceImageId?: string;
  referenceName?: string;
  referenceExpiresAt?: string;
}
export function restoreCharacterDraft(value: string | null): CharacterDraft | null {
  if (!value) return null;
  try {
    const candidate = JSON.parse(value);
    if (!candidate || typeof candidate !== "object" || candidate.version !== 1 || typeof candidate.prompt !== "string") return null;
    const validReference = typeof candidate.referenceImageId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(candidate.referenceImageId)
      && typeof candidate.referenceExpiresAt === "string" && Date.parse(candidate.referenceExpiresAt) > Date.now();
    return {
      referenceImageId: validReference ? candidate.referenceImageId : undefined,
      referenceName: validReference && typeof candidate.referenceName === "string" ? candidate.referenceName.slice(0, 255) : undefined,
      referenceExpiresAt: validReference ? candidate.referenceExpiresAt : undefined,
      category: candidate.category === "product" ? "product" : "character",
      prompt: candidate.prompt,
      aspectRatio: ["1:1", "3:4", "4:3", "16:9", "9:16"].includes(candidate.aspectRatio) ? candidate.aspectRatio : undefined,
      visualStyle: visualStyles.some((item) => item.value === candidate.visualStyle) ? candidate.visualStyle : "auto",
      mood: moods.some((item) => item.value === candidate.mood) ? candidate.mood : "neutral",
      designFormat: candidate.category === "product" ? undefined : designFormats.some((item) => item.value === candidate.designFormat) ? candidate.designFormat : "full_body",
    };
  } catch {
    // Prior versions stored the brief directly, without JSON.
    return { prompt: value, category: "character" };
  }
}

export const productMoods = moods.map((item) => ({
  ...item,
  label: ({ confident: "โดดเด่น", serious: "สุขุม", energetic: "สดใส" } as Partial<Record<typeof item.value, string>>)[item.value] ?? item.label,
}));
export function imageDesignOptions(category: ImageCategory, options: CharacterDesignOptions) {
  return { category, visualStyle: options.visualStyle, mood: options.mood,
    ...(category === "character" ? { designFormat: options.designFormat } : {}) };
}
