"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowUpRight, Coins, LogOut, Monitor, Moon, Palette, Settings as SettingsIcon, ShieldCheck, Sparkles, Sun, UserRound } from "lucide-react";
import { signOutAction } from "@/app/(auth)/actions";
import { clearStudioSessionStorage } from "@/lib/studio-session-storage";
import { applyTheme, currentTheme, subscribeTheme, type Theme } from "@/lib/theme";
import { creativeApi, type ImageCapabilities } from "@/lib/creative-api";
import w from "@/components/workbench/workbench.module.css";
import { WorkbenchHead } from "@/components/workbench/workbench-ui";
import c from "@/components/creative/collection.module.css";

export interface SettingsUser { name: string; email: string; plan: string; role: string }
export interface SettingsBalance { points: number; plan: string; unavailable: boolean }

const SECTIONS = [
  { id: "account", label: "บัญชี", icon: UserRound },
  { id: "appearance", label: "การแสดงผล", icon: Palette },
  { id: "generation", label: "การสร้าง", icon: Sparkles },
  { id: "points", label: "พอยต์และแพ็กเกจ", icon: Coins },
  { id: "privacy", label: "ข้อมูลและความเป็นส่วนตัว", icon: ShieldCheck },
] as const;

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]?.toUpperCase()).join("") || "?";
const formatPoints = (value: number) => value.toLocaleString("th-TH", { maximumFractionDigits: 1 });

export function SettingsView({ user, balance }: { user: SettingsUser; balance: SettingsBalance }) {
  const theme = useSyncExternalStore(subscribeTheme, currentTheme, () => "light" as const);
  const [current, setCurrent] = useState<string>("account");
  const [capability, setCapability] = useState<ImageCapabilities | null>(null);
  const [capabilityError, setCapabilityError] = useState("");

  useEffect(() => {
    let alive = true;
    creativeApi.capabilities()
      .then((value) => { if (alive) setCapability(value); })
      .catch((e) => { if (alive) setCapabilityError(e instanceof Error ? e.message : "ตรวจสอบสถานะไม่สำเร็จ"); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const nodes = SECTIONS.map((s) => document.getElementById(s.id)).filter((n): n is HTMLElement => !!n);
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setCurrent(visible.target.id);
    }, { rootMargin: "0px 0px -60% 0px" });
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  const pickTheme = (value: Theme) => applyTheme(value);
  const connection = !capability ? null
    : capability.connectionMode === "fixture" ? { state: "fixture", text: "โหมดทดสอบ — ภาพจำลอง ไม่ใช้เครดิต" }
      : capability.enabled ? { state: "ready", text: "เชื่อมต่อแล้ว พร้อมสร้างภาพ" }
        : { state: "off", text: capability.unavailableReason || "ยังไม่พร้อมสร้างภาพ" };

  return (
    <div className={w.page}>
      <WorkbenchHead preview={false} icon={<SettingsIcon aria-hidden />} title="ตั้งค่า" description="จัดการบัญชี การแสดงผล และดูสถานะระบบสร้างงานของคุณ" />
      <div className={c.settings}>
        <nav className={c.settingsNav} aria-label="หมวดการตั้งค่า">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <a key={id} href={`#${id}`} aria-current={current === id ? "true" : undefined}
              onClick={(e) => { e.preventDefault(); setCurrent(id); document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>
              <Icon aria-hidden />{label}
            </a>
          ))}
        </nav>

        <div className={c.sections}>
          <section id="account" className={c.card} aria-labelledby="account-title">
            <div className={c.cardHead}><h2 id="account-title">บัญชี</h2><p>ข้อมูลบัญชีที่ใช้เข้าสู่ระบบ</p></div>
            <div className={c.profile}>
              <span className={c.bigAvatar} aria-hidden>{initials(user.name)}</span>
              <div><b>{user.name}</b><span>{user.email}</span></div>
            </div>
            <div className={c.rows}>
              <div className={c.setRow}><span>อีเมล</span><span className={c.setValue}>{user.email}</span><span /></div>
              <div className={c.setRow}><span>แพ็กเกจ</span><span className={c.setValue}><span className={`${w.tag} ${w.tagAccent}`}>{user.plan || "Free"}</span></span><span /></div>
              <div className={c.setRow}><span>สิทธิ์</span><span className={c.setValue}>{user.role === "admin" ? "ผู้ดูแลระบบ" : "ผู้ใช้งาน"}</span><span /></div>
              <div className={c.setRow}>
                <span>ออกจากระบบ</span>
                <span className={c.setValue}><small>ออกจากระบบในอุปกรณ์นี้ งานที่กำลังสร้างจะยังทำงานต่อ</small></span>
                <form action={signOutAction} onSubmit={clearStudioSessionStorage}>
                  <button type="submit" className={`${w.secondary} ${c.danger}`}><LogOut aria-hidden />ออกจากระบบ</button>
                </form>
              </div>
            </div>
          </section>

          <section id="appearance" className={c.card} aria-labelledby="appearance-title">
            <div className={c.cardHead}><h2 id="appearance-title">การแสดงผล</h2><p>เลือกธีมของสตูดิโอ ระบบจำค่าไว้ในเบราว์เซอร์นี้</p></div>
            <div className={c.themes} role="group" aria-label="ธีม">
              {([["light", "สว่าง", Sun, c.themeLight], ["dark", "มืด", Moon, c.themeDark]] as const).map(([value, label, Icon, cls]) => (
                <button key={value} type="button" className={c.themeCard} aria-pressed={theme === value} onClick={() => pickTheme(value)}>
                  <span className={`${c.themePreview} ${cls}`} aria-hidden><i /><i><i /><i /></i></span>
                  <span><Icon aria-hidden />{label}</span>
                </button>
              ))}
            </div>
          </section>

          <section id="generation" className={c.card} aria-labelledby="generation-title">
            <div className={c.cardHead}><h2 id="generation-title">การสร้าง</h2><p>สถานะบริการสร้างภาพที่ผู้ดูแลเชื่อมต่อไว้ (อ่านอย่างเดียว)</p></div>
            <div className={c.rows}>
              <div className={c.setRow} role="status">
                <span>สถานะ</span>
                <span className={c.setValue}>
                  {connection ? <span className={c.status} data-state={connection.state}>{connection.text}</span>
                    : capabilityError ? <span className={c.status} data-state="off">{capabilityError}</span>
                      : <span className={`${c.skeleton} ${c.skelLine}`} style={{ display: "block", width: 180 }} />}
                </span>
                <span />
              </div>
              {capability && <>
                {capability.model && <div className={c.setRow}><span>โมเดล</span><span className={c.setValue}>{capability.model}</span><span /></div>}
                <div className={c.setRow}>
                  <span>สัดส่วนภาพที่รองรับ</span>
                  <span className={`${c.setValue} ${c.tags}`}>{capability.aspectRatios.map((r) => <span key={r} className={w.tag}>{r}</span>)}</span>
                  <span />
                </div>
                <div className={c.setRow}>
                  <span>ภาพอ้างอิง</span>
                  <span className={c.setValue}>
                    สินค้า: {capability.supportsReferenceImage ? "รองรับ" : "ยังไม่รองรับ"}
                    <small>ตัวละคร: {capability.supportsCharacterReferenceImage ? "รองรับ" : capability.characterReferenceUnavailableReason || "ยังไม่รองรับ"}</small>
                  </span>
                  <span />
                </div>
              </>}
              <div className={c.setRow}>
                <span>ค่าใช้จ่าย</span>
                <span className={c.setValue}><small>ระบบใช้ผู้ให้บริการ AI ที่ตั้งค่าไว้ ยังไม่มีข้อมูลราคาประเมิน และอาจมีค่าใช้จ่ายจากผู้ให้บริการ</small></span>
                <Link href="/studio/images" className={w.secondary}>ไปหน้าสร้างภาพ <ArrowUpRight aria-hidden /></Link>
              </div>
            </div>
          </section>

          <section id="points" className={c.card} aria-labelledby="points-title">
            <div className={c.cardHead}><h2 id="points-title">พอยต์และแพ็กเกจ</h2><p>พอยต์ใช้สำหรับสร้างภาพ วิดีโอ และเสียง</p></div>
            <div className={c.rows}>
              <div className={c.setRow}>
                <span>พอยต์คงเหลือ</span>
                <span className={c.setValue}>
                  <span className={c.points}>{balance.unavailable ? "—" : formatPoints(balance.points)}<small>pt</small></span>
                  {balance.unavailable && <small>โหลดพอยต์คงเหลือไม่สำเร็จ กรุณารีเฟรชหน้า</small>}
                </span>
                <button type="button" className={w.secondary} disabled title="เร็วๆ นี้">เติมพอยต์ · เร็วๆ นี้</button>
              </div>
              <div className={c.setRow}><span>แพ็กเกจปัจจุบัน</span><span className={c.setValue}>{balance.plan}<small>ระบบแสดงราคาก่อนกดสร้างทุกครั้ง</small></span><span /></div>
            </div>
          </section>

          <section id="privacy" className={c.card} aria-labelledby="privacy-title">
            <div className={c.cardHead}><h2 id="privacy-title">ข้อมูลและความเป็นส่วนตัว</h2><p>ผลงานทั้งหมดเป็นของบัญชีคุณ</p></div>
            <div className={c.rows}>
              <div className={c.setRow}>
                <span>คลังส่วนตัว</span>
                <span className={c.setValue}><small>ตัวละคร สินค้า และวิดีโอที่บันทึกเห็นได้เฉพาะคุณ การลบจะนำออกจากคลัง โดยภาพต้นฉบับยังอยู่ในประวัติการสร้าง</small></span>
                <Link href="/studio/library" className={w.secondary}>เปิดคลังผลงาน <ArrowUpRight aria-hidden /></Link>
              </div>
              <div className={c.setRow}>
                <span>ประวัติการสร้าง</span>
                <span className={c.setValue}><small>ดูสถานะ เครดิตที่ใช้ และบันทึกผลงานจากงานที่สร้างทั้งหมด</small></span>
                <Link href="/studio/jobs" className={w.secondary}>เปิดงานที่สร้าง <ArrowUpRight aria-hidden /></Link>
              </div>
              <div className={c.setRow}>
                <span>ข้อมูลในเบราว์เซอร์</span>
                <span className={c.setValue}><small>ฉบับร่างงานเก็บชั่วคราวในแท็บนี้และถูกล้างเมื่อออกจากระบบ ส่วนธีมจำไว้ในเบราว์เซอร์นี้</small></span>
                <span><Monitor aria-hidden style={{ width: 18, height: 18, color: "var(--wb-muted)" }} /></span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
