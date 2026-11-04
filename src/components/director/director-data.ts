export type { Project, Scene, Shot, Idea, Step, Character, Capabilities, ModelOption } from "@/lib/director-api";
export const stepIndex = (step: string) => step === "idea" ? 0 : step === "plot" ? 1 : 2;
export const formatDate = (time: string) => new Date(time).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" });
