interface PipelineFailure {
  status:string;
  failureCode?:string|null;
}

export function pipelineFailureMessage(job:PipelineFailure):string {
  if(job.status==='needs_attention')return 'ยังยืนยันผลการสร้างไม่ได้ กรุณาตรวจสอบงานและการใช้งานก่อนเริ่มคำขอใหม่ เพื่อหลีกเลี่ยงงานซ้ำ';
  if(job.status!=='failed')return 'กรุณาตรวจสอบสถานะงานอีกครั้ง';
  switch(job.failureCode){
    case 'PROVIDER_OUTPUT_REJECTED':return 'ผู้ให้บริการปฏิเสธวิดีโอที่สร้างจากการตรวจนโยบายเนื้อหา กรุณาปรับคำอธิบายหรือภาพอ้างอิงแล้วสร้างคำขอใหม่';
    case 'PROVIDER_GENERATION_FAILED':return 'ผู้ให้บริการยืนยันว่าสร้างวิดีโอไม่สำเร็จ กรุณาปรับคำขอแล้วสร้างใหม่';
    case 'VOICE_FAILED':return 'สร้างเสียงพากย์ไม่สำเร็จ (คืนแต้มแล้ว) กดดำเนินการต่อเพื่อลองใหม่';
    case 'VOICE_UNAVAILABLE':return 'ระบบเสียงพากย์ยังไม่พร้อมใช้งาน (คืนแต้มแล้ว) กรุณาลองใหม่ภายหลัง';
    case 'VOICE_REJECTED':return 'ระบบเสียงไม่รับบทพูดหรือเสียงนี้ (คืนแต้มแล้ว) กรุณาปรับบทพูดหรือเปลี่ยนเสียงแล้วสร้างคำขอใหม่';
    case 'VOICE_NOT_FOUND':return 'ไม่พบเสียงพากย์ที่เลือก (อาจถูกลบไปแล้ว) กรุณาเลือกเสียงใหม่แล้วสร้างคำขอใหม่';
    case 'DUB_FAILED':return 'ผสมเสียงพากย์ลงวิดีโอไม่สำเร็จ กดดำเนินการต่อเพื่อผสมใหม่ (ไม่สร้างวิดีโอใหม่)';
    default:return 'งานสร้างวิดีโอไม่สำเร็จ กรุณาตรวจสอบรายละเอียดคำขอก่อนเริ่มคำขอใหม่';
  }
}
