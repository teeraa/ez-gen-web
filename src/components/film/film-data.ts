// Mock content for the "สร้างหนัง" concept page. Replaced by Director API data once the flow is approved.

export type StageId = "story" | "cast" | "elements" | "shots" | "film";

export const STAGES: { id: StageId; label: string; hint: string }[] = [
  { id: "story", label: "เรื่องราว", hint: "เรื่องย่อ · แก่นเรื่อง · โครงเรื่อง" },
  { id: "cast", label: "ตัวละคร", hint: "บุคลิก · หน้าตา · เสียง" },
  { id: "elements", label: "องค์ประกอบ", hint: "สถานที่ · ของ · โทนภาพ" },
  { id: "shots", label: "ฉากและช็อต", hint: "เวลา · มุมกล้อง · บทพูด" },
  { id: "film", label: "หนัง", hint: "สร้างวิดีโอ · เสียง · รวมไฟล์" },
];

export const SAMPLE_PROMPT =
  "อยากได้หนังสั้นย้อนยุคกรุงศรีอยุธยา ปี 2310 ก่อนเสียกรุง นายทหารหนุ่มต้องยืนหยัดรับศึกพม่าเพื่อให้ชาวบ้านหนีทัน ยาว 2 นาที ภาพสมจริงแบบหนังโรง";

export const TOTAL_SECONDS = 120;

export const STORY = {
  title: "อโยธยา: ก่อนรุ่งสาง",
  meta: ["สงครามย้อนยุค", "ดราม่า", "2:00", "16:9", "สมจริง"],
  logline:
    "รุ่งสางก่อนเสียกรุง นายทหารหนุ่มที่เหลือกำลังพลเพียงหยิบมือ ต้องเลือกระหว่างถอยเพื่อรอด หรือยืนหยัดซื้อเวลาให้ชาวบ้านหนีพ้น",
  synopsis:
    "ปลายสมัยกรุงศรีอยุธยา พ.ศ. 2310 กองทัพพม่าเคลื่อนพลเข้าหาแนวป้องกันนอกพระนครในยามรุ่งสาง ขุนอินทร์ได้รับหน้าที่รักษาแนวนี้ไว้ แต่กำลังทหารของเขาเหลือไม่มาก หากแนวแตก ผู้คนที่กำลังอพยพอยู่ด้านหลังจะตกอยู่ในอันตราย",
  theme: "ชัยชนะไม่ได้หมายถึงการเอาชนะศัตรูเสมอไป แต่หมายถึงการรักษาชีวิตคนที่อยู่ข้างหลัง",
  acts: [
    { label: "องก์ 1 · ก่อนศึก", start: 0, end: 35, summary: "แนะนำสถานการณ์และความขัดแย้ง" },
    { label: "องก์ 2 · การปะทะ", start: 35, end: 95, summary: "กองทัพบุกเข้ามาและเกิดการต่อสู้" },
    { label: "องก์ 3 · การเสียสละ", start: 95, end: 120, summary: "ตัดสินใจครั้งสุดท้ายและปิดเรื่อง" },
  ],
};

export interface CastMember {
  id: string;
  name: string;
  age: number;
  role: string;
  trait: string;
  look: string;
  voice: string;
  tone: string;
}

export const CAST: CastMember[] = [
  {
    id: "c1",
    name: "ขุนอินทร์",
    age: 32,
    role: "ตัวเอก · นายทหารอยุธยา",
    trait: "เด็ดเดี่ยว สุขุม ยอมเสี่ยงชีวิตเพื่อชาวบ้าน",
    look: "ผิวคล้ำแดด ผมมวยสั้น ผ้าคาดเอวสีแดงเข้ม ถือดาบไทยฝักไม้",
    voice: "ชายทุ้ม หนักแน่น",
    tone: "#7a5a3c",
  },
  {
    id: "c2",
    name: "ไอ้กล้า",
    age: 20,
    role: "ผู้ติดตาม",
    trait: "หวาดกลัวสงคราม แต่ภักดีต่อหน้าที่",
    look: "ร่างผอม เสื้อผ้าฝ้ายสีหม่น มีรอยเปื้อนโคลน",
    voice: "ชายหนุ่ม เสียงสั่นเล็กน้อย",
    tone: "#5e6b78",
  },
  {
    id: "c3",
    name: "แม่ทัพพม่า",
    age: 45,
    role: "ฝ่ายตรงข้าม",
    trait: "นิ่งขรึม น่าเกรงขาม",
    look: "ชุดเกราะผ้าหนา ผ้าโพกศีรษะ ยืนเด่นหน้าธงทัพ",
    voice: "ไม่มีบทพูด",
    tone: "#6b2a2a",
  },
];

export const ELEMENTS = {
  locations: [
    { name: "ทุ่งนานอกพระนคร", note: "ก่อนรุ่งสาง · หมอกหนา · เห็นพระนครไกล ๆ" },
    { name: "แนวค่ายทหารอยุธยา", note: "รั้วไม้ระเนียด · กองไฟมอด · รุ่งสาง" },
    { name: "ช่องทางออกจากค่าย", note: "ทางดินแคบ · ชาวบ้านอพยพ · เช้า" },
  ],
  props: [
    { name: "ดาบไทยของขุนอินทร์", spec: "ด้ามเดียว ฝักไม้แยก ใช้ทุกช็อตที่มีขุนอินทร์" },
    { name: "ธงทัพพม่า", spec: "ผ้าแดงขอบทอง เคลื่อนในหมอก" },
    { name: "กลองศึก", spec: "ได้ยินเสียงเป็นหลัก เห็นภาพในช็อต 06" },
  ],
  look: [
    { label: "แสง", value: "แสงธรรมชาติยามเช้า หมอก ควัน แสงย้อน" },
    { label: "กล้อง", value: "Anamorphic · 35/50/85mm · เคลื่อนอย่างมีจุดหมาย" },
    { label: "เครื่องแต่งกาย", value: "ผ้าฝ้าย ผ้าคาดเอว อิงยุคปลายอยุธยา ไม่มีของสมัยใหม่" },
  ],
  palette: [
    { name: "น้ำตาลดิน", hex: "#6b4f3a" },
    { name: "ทองหม่น", hex: "#a8894f" },
    { name: "เทาอมฟ้า", hex: "#5e6b78" },
    { name: "แดงเข้ม", hex: "#7a1f1f" },
  ],
};

export interface Line {
  who: string;
  text: string;
}
export interface Shot {
  id: string;
  no: string;
  start: number;
  end: number;
  type: string;
  action: string;
  lines?: Line[];
  sound?: string;
}
export interface Scene {
  id: string;
  no: number;
  title: string;
  heading: string;
  start: number;
  end: number;
  tone: string;
  shots: Shot[];
}

export const SCENES: Scene[] = [
  {
    id: "s1", no: 1, title: "เงาแห่งสงคราม", heading: "EXT. ทุ่งนานอกพระนคร — ก่อนรุ่งสาง", start: 0, end: 20, tone: "#4a5560",
    shots: [
      { id: "01", no: "01", start: 0, end: 8, type: "Extreme Wide", action: "กล้องบินเหนือทุ่งนา เห็นพระนครอยู่ไกล ๆ หมอกปกคลุม", sound: "ลม · กลองศึกไกล ๆ · เครื่องสายต่ำ", lines: [{ who: "ขุนอินทร์ (V.O.)", text: "เมื่อศึกมาถึงหน้าพระนคร… สิ่งที่เราต้องรักษา มิใช่เพียงแผ่นดิน" }] },
      { id: "02", no: "02", start: 8, end: 14, type: "Low Angle", action: "เท้าทหารพม่าจำนวนมากเดินผ่านดินเปียก ธงทัพเคลื่อนในหมอก" },
      { id: "03", no: "03", start: 14, end: 20, type: "Medium Close-up", action: "ขุนอินทร์ยืนบนแนวป้องกัน มองกองทัพที่กำลังเข้ามา" },
    ],
  },
  {
    id: "s2", no: 2, title: "คำสั่งสุดท้าย", heading: "EXT. แนวค่ายทหารอยุธยา — รุ่งสาง", start: 20, end: 35, tone: "#5d5040",
    shots: [
      { id: "04", no: "04", start: 20, end: 27, type: "Two Shot", action: "ไอ้กล้าวิ่งเข้ามารายงาน ขุนอินทร์หันมารับฟัง", lines: [{ who: "กล้า", text: "ท่านขุน! ข้าศึกมากันเต็มทุ่งแล้วขอรับ!" }] },
      { id: "05", no: "05", start: 27, end: 35, type: "Close-up", action: "ขุนอินทร์จับด้ามดาบแน่น ก่อนออกคำสั่ง", lines: [{ who: "ขุนอินทร์", text: "พาชาวบ้านไปให้พ้น… ที่นี่ข้าจะรับไว้เอง" }] },
    ],
  },
  {
    id: "s3", no: 3, title: "ศึกประจัญบาน", heading: "EXT. แนวป้องกันนอกพระนคร — เช้าตรู่", start: 35, end: 75, tone: "#6b4a34",
    shots: [
      { id: "06", no: "06", start: 35, end: 43, type: "Extreme Wide", action: "กองทัพพม่าเคลื่อนเข้าหาแนวป้องกัน กลองศึกดังขึ้น", sound: "กลองศึก · ฝีเท้า" },
      { id: "07", no: "07", start: 43, end: 50, type: "Tracking", action: "ทหารอยุธยาตั้งรับ ขุนอินทร์วิ่งผ่านแนวทหาร", lines: [{ who: "ขุนอินทร์", text: "ตั้งแนวไว้! อย่าให้มันผ่านไปได้!" }] },
      { id: "08", no: "08", start: 50, end: 58, type: "Medium Action", action: "สองฝ่ายปะทะกันด้วยดาบและหอก ฝุ่นฟุ้งทั่วบริเวณ", sound: "อาวุธกระทบ · ออร์เคสตราเร่งจังหวะ" },
      { id: "09", no: "09", start: 58, end: 66, type: "Handheld", action: "ขุนอินทร์ต่อสู้ป้องกันแนวค่าย กล้องตามอย่างใกล้ชิด" },
      { id: "10", no: "10", start: 66, end: 75, type: "Wide", action: "แนวป้องกันเริ่มเสียเปรียบ ขุนอินทร์เห็นชาวบ้านอพยพด้านหลัง" },
    ],
  },
  {
    id: "s4", no: 4, title: "เพื่อคนข้างหลัง", heading: "EXT. ช่องทางออกจากค่าย — เช้า", start: 75, end: 95, tone: "#56604f",
    shots: [
      { id: "11", no: "11", start: 75, end: 83, type: "Over-the-shoulder", action: "ขุนอินทร์มองเห็นกล้าและชาวบ้านกลุ่มสุดท้ายกำลังหนี" },
      { id: "12", no: "12", start: 83, end: 95, type: "Close-up → Medium", action: "กล้าหันกลับมามอง ขุนอินทร์ยกดาบเป็นสัญญาณให้ไปต่อ", sound: "ดนตรีเงียบลง เหลือเสียงลม", lines: [{ who: "กล้า", text: "แล้วท่านเล่าขอรับ!" }, { who: "ขุนอินทร์", text: "ไปเสีย! อย่าให้การยืนหยัดของพวกข้าสูญเปล่า!" }] },
    ],
  },
  {
    id: "s5", no: 5, title: "ก่อนรุ่งสางจะสิ้นสุด", heading: "EXT. แนวป้องกันที่ถูกตีแตก — เช้า", start: 95, end: 120, tone: "#3f3a3a",
    shots: [
      { id: "13", no: "13", start: 95, end: 103, type: "Wide Silhouette", action: "ขุนอินทร์ยืนหน้าแนวค่ายที่พังลง เงากองทัพอยู่เบื้องหน้า" },
      { id: "14", no: "14", start: 103, end: 112, type: "Slow Push-in", action: "กล้องเคลื่อนเข้าหาใบหน้าขุนอินทร์ เขาสูดลมหายใจแล้วตั้งดาบมั่น" },
      { id: "15", no: "15", start: 112, end: 120, type: "Extreme Wide → ตัดดำ", action: "ขุนอินทร์ก้าวไปข้างหน้า กล้องถอยออก ก่อนภาพตัดดำขึ้นชื่อเรื่อง", sound: "กลองศึกครั้งสุดท้าย แล้วเงียบ", lines: [{ who: "ขุนอินทร์ (V.O.)", text: "หากรุ่งสางนี้ข้ามิได้กลับไป… ขอเพียงพวกเขายังมีวันพรุ่งนี้" }] },
    ],
  },
];

export const SHOT_COUNT = SCENES.reduce((n, s) => n + s.shots.length, 0);

export const clock = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
