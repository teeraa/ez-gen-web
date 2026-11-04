import type { PaginatedData } from '@/types/api';
export interface PipelineRequest { referenceImageId?:string; characterAssetId?:string; characterPrompt:string; scenePrompt:string; dialogue?:string; visualStyle:string; aspectRatio:string; durationSeconds:number; modelId:string; quality:string; draft?:boolean; idempotencyKey:string }
export interface Pipeline { isDraft?:boolean; modelId?:string; modelLabel?:string; aspectRatio?:string; durationSeconds?:number; quality?:string; canCreateFinal?:boolean; sourceDraftId?:string|null; draftExpiresAt?:string|null; finalUnavailableReason?:string|null; sourceMode?:'upload'|'text'|'library'; id:string; characterPrompt:string; scenePrompt:string; dialogue:string; status:'queued'|'processing'|'succeeded'|'failed'|'needs_attention'; stage:'image'|'save_character'|'video'|'save_video'|'done'; canRetry:boolean; failureCode:string|null; failureMessage:string|null; characterAssetId:string|null; videoAssetId:string|null; characterMediaUrl:string|null; videoMediaUrl:string|null; characterMediaUrlExpiresAt:string|null; videoMediaUrlExpiresAt:string|null; createdAt:string; updatedAt:string }
export interface PipelineModelCapabilities extends Omit<PipelineCapabilities,'models'> { id:string; label:string; supportsDraft:boolean }
export interface PipelineCapabilities { models?:PipelineModelCapabilities[]; enabled:boolean; textEnabled?:boolean; libraryEnabled?:boolean; libraryAspectRatios?:string[]; libraryDurations?:number[]; supportsDialogue:boolean; unavailableReason:string|null; aspectRatios:string[]; durations:number[] }
export interface PipelineValidationDetail { field:string; reason:string; message:string }
const validationRules: Record<string, readonly string[]> = {
 referenceImageId:['invalid_uuid','required','invalid_type','conflicting_sources','invalid_image'],
 characterAssetId:['invalid_uuid','required','invalid_type','conflicting_sources'],
 idempotencyKey:['invalid_uuid','required','invalid_type'],
 characterPrompt:['required','too_long','invalid_type'],
 scenePrompt:['required','too_long','invalid_type','prompt_budget','invalid_option'],
 dialogue:['required','too_long','invalid_type','dialogue_encoding_budget'],
 visualStyle:['invalid_option','invalid_type'],
 aspectRatio:['invalid_option','invalid_type'],
 durationSeconds:['out_of_range','invalid_type'],
 modelId:['invalid_option','invalid_type'],
 quality:['invalid_option','invalid_type'],
 draft:['invalid_type'],
 body:['malformed_json'],
};
const fieldLabels: Record<string,string> = {referenceImageId:'ภาพอ้างอิง',characterAssetId:'ตัวละครจากคลัง',idempotencyKey:'รหัสคำขอ',characterPrompt:'ลักษณะตัวละคร',scenePrompt:'ฉากและการเคลื่อนไหว',dialogue:'บทพูด',visualStyle:'สไตล์ภาพ',aspectRatio:'สัดส่วนวิดีโอ',durationSeconds:'ความยาววิดีโอ',modelId:'โมเดลวิดีโอ',quality:'คุณภาพวิดีโอ',draft:'โหมดร่าง',body:'คำขอ'};
function safeValidationDetails(status:number,code:string,payload:unknown):PipelineValidationDetail[] {
 if(status!==400||code!=='VALIDATION_ERROR'||!Array.isArray(payload)||payload.length===0||payload.length>8)return [];
 const details:PipelineValidationDetail[]=[];
 for(const value of payload){
  if(!value||typeof value!=='object')return [];
  const {field,reason,message}=value;
  if(typeof field!=='string'||typeof reason!=='string'||typeof message!=='string'||message.length===0||message.length>400||!Object.hasOwn(validationRules,field)||!validationRules[field].includes(reason))return [];
  // Never render server/provider text, even for a recognized error shape.
  const messages:Record<string,string>={
   invalid_uuid:`${fieldLabels[field]}ไม่ถูกต้อง กรุณาเลือกใหม่หรือส่งคำขอใหม่`,
   conflicting_sources:'กรุณาเลือกตัวละครจากคลังหรือแนบภาพใหม่อย่างใดอย่างหนึ่ง',
   required:`กรุณาระบุ${fieldLabels[field]}`,
   too_long:`${fieldLabels[field]}ยาวเกินขีดจำกัด กรุณาย่อแล้วลองอีกครั้ง`,
   dialogue_encoding_budget:'บทพูดยาวเกินขีดจำกัด กรุณาย่อบทพูดแล้วลองอีกครั้ง',
   prompt_budget:'รายละเอียดฉากและบทพูดรวมกันยาวเกินขีดจำกัด กรุณาย่อฉากหรือบทพูดแล้วลองอีกครั้ง',
   invalid_option:field==='scenePrompt'?'รายละเอียดฉากไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง':`${fieldLabels[field]}ไม่รองรับ กรุณาเลือกค่าที่รองรับ`,
   invalid_type:`ชนิดข้อมูลของ${fieldLabels[field]}ไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง`,
   out_of_range:'ความยาววิดีโอต้องอยู่ระหว่าง 4 ถึง 15 วินาที',
   malformed_json:'รูปแบบคำขอไม่ถูกต้อง กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง',
   invalid_image:'ภาพอ้างอิงไม่ถูกต้อง กรุณาเลือกภาพใหม่',
  };
  details.push({field,reason,message:messages[reason]});
 }
 return details;
}
export class PipelineApiError extends Error { constructor(public readonly status:number, public readonly code:string,public readonly details:readonly PipelineValidationDetail[]=[]){super('คำขอไม่สำเร็จ');} }
async function request<T>(path:string,body?:unknown):Promise<T> {
 const response=await fetch(`/api/proxy/${path}`,{method:body===undefined?'GET':'POST',cache:'no-store',headers:{'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const json=await response.json();
 if(!response.ok){const code=typeof json?.code==='string'?json.code:'UNKNOWN';throw new PipelineApiError(response.status,code,safeValidationDetails(response.status,code,json?.details));}
 if(!json || typeof json!=='object' || !('data' in json)) throw new Error('ข้อมูลตอบกลับไม่สมบูรณ์');
 return json.data as T;
}
/** Server-side dry run of a create request: exact limits, model support and prompt budget. */
export interface PipelinePreflight { ok:boolean; promptRunes:number; promptLimit:number; sceneTruncated:boolean; issues:{field:string;reason:string;message:string}[] }
export const pipelineApi={preflight:(body:Omit<PipelineRequest,'idempotencyKey'>)=>request<PipelinePreflight>('studio-pipelines/preflight',body),capabilities:()=>request<PipelineCapabilities>('studio-pipeline-capabilities'),list:()=>request<PaginatedData<Pipeline>>('studio-pipelines?limit=20&page=1'),get:(id:string)=>request<Pipeline>(`studio-pipelines/${encodeURIComponent(id)}`),create:(body:PipelineRequest)=>request<Pipeline>('studio-pipelines',body),finalize:(id:string,idempotencyKey:string)=>request<Pipeline>(`studio-pipelines/${encodeURIComponent(id)}/finalize`,{idempotencyKey}),retry:(id:string)=>request<Pipeline>(`studio-pipelines/${encodeURIComponent(id)}/retry`,{})};
