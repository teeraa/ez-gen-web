/** Applying a new AI edit replaces AI-owned tracks while keeping independently authored tracks. */
export function previewCompositionTracks<T extends {originJobId?: string}>(manual: T[], generated: T[] | undefined): T[] {
  return [...manual.filter(item=>!item.originJobId),...(generated??[])];
}
export function approvalIdsForApply(ids: string[], approved: string[], autoJob: boolean, approveAll: boolean): string[] {
  const result=autoJob&&approveAll?ids:approved;
  if (!ids.length || result.length!==ids.length || ids.some(id=>!result.includes(id))) throw new Error("กรุณาตรวจและอนุมัติทุกฉากก่อนนำไปใช้");
  return [...result];
}
