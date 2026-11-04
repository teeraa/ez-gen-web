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
    default:return 'งานสร้างวิดีโอไม่สำเร็จ กรุณาตรวจสอบรายละเอียดคำขอก่อนเริ่มคำขอใหม่';
  }
}
