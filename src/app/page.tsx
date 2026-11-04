import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, ChevronRight } from "lucide-react";
import { getShowcase } from "@/lib/showcase";
import { EditorDemo } from "@/components/landing/editor-demo";
import { SubtitleCycle, VoiceWave } from "@/components/landing/feature-bits";
import { FlowDemo } from "@/components/landing/flow-demo";
import { HeroComposer } from "@/components/landing/hero-composer";
import { CharacterDefs, Figure, Scene } from "@/components/landing/scenes";
import { ShowcaseMedia, ShowcaseStill } from "@/components/landing/showcase-media";
import { pickLandscape } from "@/components/landing/showcase-pick";
import { ShowcaseReel } from "@/components/landing/showcase-reel";
import { PublicNav } from "@/components/landing/public-nav";
import { ThemeRoot } from "@/components/landing/theme-root";
import { AppChrome } from "@/components/shell/app-chrome";
import { ShellColumn, ShellFrame } from "@/components/shell/shell-frame";
import { getCurrentUser } from "@/lib/auth/session";
import s from "@/components/landing/landing.module.css";

export const metadata: Metadata = {
  title: "Story Flow — เล่าเรื่องเป็นวิดีโอด้วยตัวละครของคุณ",
  description: "สร้างตัวละครครั้งเดียว ใช้ซ้ำได้ทุกฉาก พิมพ์ไอเดียเป็นภาษาไทย แล้วรับวิดีโอพร้อมบทพูด ลองแบบร่าง 480p ก่อนสร้างฉบับ 1080p",
};

function interleave<T>(a: T[], b: T[]): T[] {
  const out: T[] = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

// Signed in: the same sidebar + navbar as the studio, so moving between pages feels continuous.
async function LandingChrome() {
  const user = await getCurrentUser();
  return user ? <AppChrome user={user} /> : <PublicNav />;
}

export default async function Home() {
  // Cached ("use cache") in getShowcase, so this stays part of the static shell.
  const items = await getShowcase();
  // Stills (character/product) never go into a <video> slot.
  const videos = items.filter((item) => item.mediaType !== "image" && item.slot !== "character" && item.slot !== "product");
  const shots = videos.filter((item) => item.slot === "editor");
  const showcased = videos.filter((item) => item.slot !== "editor");
  // The reel shows every video, sword-fight shots included, interleaved for variety.
  const reel = interleave(shots, showcased);
  const character = items.find((item) => item.slot === "character");
  const product = items.find((item) => item.slot === "product");
  // Character Lock only claims "same character" when the shots really share one.
  const castShots = character && shots.length >= 3 ? [shots[0], shots[1], shots[3] ?? shots[2]] : [];
  const ctaClip = pickLandscape(shots, 2) ?? pickLandscape(showcased);

  return (
    <ThemeRoot>
      <CharacterDefs />
      <div className={s.aurora} aria-hidden>
        <i />
        <i />
        <i />
      </div>

      <ShellFrame>
        <ShellColumn>
          <div className={s.content}>
            <Suspense fallback={<PublicNav />}>
              <LandingChrome />
            </Suspense>

            <main>
              <section className={s.hero}>
                <div className={s.wrap}>
                  <span className={`${s.eyebrow} ${s.reveal}`}>
                    <span className={s.tag}>ใหม่</span>แบบร่าง 480p — ลองไอเดียได้เร็ว ใช้เครดิตน้อยลง
                  </span>
                  <h1 className={`${s.reveal} ${s.d1}`}>
                    เล่าเรื่องเป็น<span className={s.shine}>วิดีโอ</span>
                    <br />
                    ด้วยตัวละครที่เป็นของคุณ
                  </h1>
                  <p className={`${s.lead} ${s.reveal} ${s.d2}`}>
                    สร้างตัวละครครั้งเดียว ใช้ซ้ำได้ทุกฉาก ใบหน้าและชุดคงเดิม พิมพ์ไอเดียเป็นภาษาไทย แล้วรับวิดีโอพร้อมบทพูดภายในไม่กี่นาที
                  </p>
                  <HeroComposer />
                </div>
                <ShowcaseReel items={reel} />
              </section>

              <section id="flow" className={s.section}>
                <div className={s.wrap}>
                  <div className={`${s.secHead} ${s.reveal}`}>
                    <div className={s.kicker}>จากไอเดียถึงไฟนอล</div>
                    <h2>4 ขั้นตอน ไม่ต้องเป็นผู้กำกับ</h2>
                    <p>ลองแบบร่างราคาถูกก่อน พอใจแล้วค่อยสร้างฉบับ 1080p จากร่างเดิม คุมเครดิตได้ทุกขั้น</p>
                  </div>
                  <FlowDemo items={showcased} shots={shots} character={character} />
                </div>
              </section>

              <section id="cast" className={s.section}>
                <div className={s.wrap}>
                  <div className={`${s.secHead} ${s.reveal}`}>
                    <div className={s.kicker}>Character Lock</div>
                    <h2>ตัวละครเดียว หน้าเดิม ทุกฉาก</h2>
                    <p>ปัญหาใหญ่ของวิดีโอ AI คือหน้าตาตัวละครเปลี่ยนไปทุกช็อต เราเก็บตัวละครไว้ในคลัง แล้วใช้เป็นต้นแบบทุกครั้งที่สร้าง</p>
                  </div>
                  <div className={s.cast}>
                    <div className={`${s.charCard} ${s.reveal}`}>
                      <div className={s.charPortrait}>{character ? <ShowcaseStill item={character} fit="contain" /> : <Figure />}</div>
                      <h4>{character ? character.title : "มายา"}</h4>
                      <div className={s.mutedText}>{character ? (character.subtitle ?? "ตัวละครในคลัง") : "นักสำรวจ · ตัวละครในคลัง"}</div>
                      <div className={s.tags}>
                        {(character ? ["ผมดำมัดสูง", "ชุดฮั่นฝูสีขาว", "ผ้าคาดเอวแดง", "กระบี่ด้ามเงิน"] : ["ผมสีเงิน", "เสื้อคลุมครีม", "ผ้าพันคอม่วง", "ดวงตาอบอุ่น"]).map((tag) => (
                          <span key={tag}>{tag}</span>
                        ))}
                      </div>
                    </div>
                    <div className={s.shots}>
                      {castShots.length
                        ? castShots.map((shot, i) => (
                            <div key={shot.id} className={`${s.card} ${s.reveal} ${[s.d1, s.d2, s.d3][i]}`}>
                              <ShowcaseMedia item={shot} />
                              <div className={s.meta}>
                                <span>
                                  <b>{shot.title.replace(/^ดวลกระบี่ · /, "")}</b>
                                  ฉาก {i + 1}
                                </span>
                                <i>{shot.duration} วิ</i>
                              </div>
                            </div>
                          ))
                        : (
                            [
                              ["forest", "ป่ายามเช้า", "ฉาก 1", "5 วิ"],
                              ["neon", "เมืองนีออน", "ฉาก 2", "8 วิ"],
                              ["ocean", "ชายหาด", "ฉาก 3", "5 วิ"],
                            ] as const
                          ).map(([kind, title, scene, dur], i) => (
                            <div key={kind} className={`${s.card} ${s.reveal} ${[s.d1, s.d2, s.d3][i]}`}>
                              <Scene kind={kind} />
                              <Figure />
                              <div className={s.meta}>
                                <span>
                                  <b>{title}</b>
                                  {scene}
                                </span>
                                <i>{dur}</i>
                              </div>
                            </div>
                          ))}
                    </div>
                  </div>
                </div>
              </section>

              <section id="features" className={s.section}>
                <div className={s.wrap}>
                  <div className={`${s.secHead} ${s.reveal}`}>
                    <div className={s.kicker}>ทุกอย่างในสตูดิโอเดียว</div>
                    <h2>จากภาพนิ่ง สู่เรื่องเล่า สู่คลิปพร้อมโพสต์</h2>
                  </div>
                  <div className={s.bento}>
                    <div className={`${s.tile} ${s.tA} ${s.reveal}`}>
                      <div>
                        <h3>AI ตัดต่อ</h3>
                        <p>อัปโหลดฟุตเทจยาว บอกความยาวที่ต้องการ AI จะถอดเสียงไทย เลือกช่วงที่เล่าเรื่องได้ครบ แล้ววางคลิป ซับ และเสียงให้บนไทม์ไลน์ ปรับต่อเองได้ทุกแทร็ก</p>
                      </div>
                      <EditorDemo shots={shots} />
                    </div>
                    <div className={`${s.tile} ${s.tB} ${s.reveal} ${s.d1}`}>
                      <h3>ซับไทยอัตโนมัติ</h3>
                      <p>ถอดเสียงไทย วางซับตรงจังหวะพูด</p>
                      <SubtitleCycle />
                    </div>
                    <div className={`${s.tile} ${s.tC} ${s.reveal}`}>
                      <h3>เรื่องยาวหลายฉาก</h3>
                      <p>วางโครงเรื่อง แตกเป็นฉาก แล้วสร้างทีละช็อตอย่างต่อเนื่อง</p>
                      <div className={s.flowmini}>
                        <span>เปิดเรื่อง</span>
                        <ChevronRight size={13} />
                        <span>ปมขัดแย้ง</span>
                        <ChevronRight size={13} />
                        <span>ไคลแมกซ์</span>
                      </div>
                    </div>
                    <div className={`${s.tile} ${s.tD} ${s.reveal} ${s.d1}`}>
                      <h3>ภาพสินค้า</h3>
                      <p>ภาพสินค้าระดับโฆษณา จากคำอธิบายหรือภาพอ้างอิงเดียว</p>
                      <div className={s.prod}>{product ? <ShowcaseStill item={product} /> : <Scene kind="studio" still />}</div>
                    </div>
                    <div className={`${s.tile} ${s.tE} ${s.reveal} ${s.d2}`}>
                      <span className={s.badge}>เร็ว ๆ นี้</span>
                      <h3>เสียงพากย์ไทย</h3>
                      <p>ผูกเสียงไว้กับตัวละคร พูดด้วยเสียงเดิมทุกฉาก</p>
                      <VoiceWave />
                    </div>
                  </div>
                </div>
              </section>

              <section className={s.section} style={{ paddingTop: 40 }}>
                <div className={s.wrap}>
                  <div className={`${s.cta} ${s.reveal}`}>
                    {ctaClip && <ShowcaseMedia item={ctaClip} className={s.ctaMedia} />}
                    <h2>
                      วิดีโอแรกของคุณ
                      <br />
                      อยู่ห่างแค่ประโยคเดียว
                    </h2>
                    <p>เริ่มจากแบบร่าง 480p เห็นราคาก่อนกดสร้างทุกครั้ง พอใจแล้วค่อยต่อยอดเป็นฉบับสมบูรณ์</p>
                    <Link className={`${s.btn} ${s.ctaBtn}`} href="/signup">
                      เริ่มสร้างเลย <ArrowRight size={16} />
                    </Link>
                    <div className={s.facts}>
                      <div>
                        <b>480p</b>แบบร่างไว้ลองไอเดีย
                      </div>
                      <div>
                        <b>1080p</b>ฉบับสมบูรณ์
                      </div>
                      <div>
                        <b>ไทย</b>บทพูดและซับ
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </main>

            <footer className={s.footer}>
              <div className={s.wrap}>
                <span>© 2026 Story Flow</span>
                <span>ข้อกำหนด · ความเป็นส่วนตัว · ติดต่อเรา</span>
              </div>
            </footer>
          </div>
        </ShellColumn>
      </ShellFrame>
    </ThemeRoot>
  );
}
