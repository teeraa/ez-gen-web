"use client";

import { useEffect, useRef, useState } from "react";

// ─── Icon sprite (inline, zero runtime deps) ──────────────────────────────────
function IconSprite() {
  return (
    <svg style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} aria-hidden="true">
      <symbol id="i-sparkles" viewBox="0 0 24 24"><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="m19 14 1.1 3.1L23 18l-2.9 1L19 22l-1-3-3-1 3-1 1-3Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="m5 2 .8 2.2L8 5l-2.2.8L5 8l-.8-2.2L2 5l2.2-.8L5 2Z" fill="currentColor"/></symbol>
      <symbol id="i-video"    viewBox="0 0 24 24"><rect x="3" y="5" width="13" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="m16 10 5-3v10l-5-3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></symbol>
      <symbol id="i-image"   viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6"/><circle cx="8.5" cy="8.5" r="1.5" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="m21 15-5-5L5 21" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></symbol>
      <symbol id="i-move"    viewBox="0 0 24 24"><path d="m5 9-3 3 3 3m14-6 3 3-3 3M9 5l3-3 3 3m-6 14 3 3 3-3M2 12h20M12 2v20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></symbol>
      <symbol id="i-zap"     viewBox="0 0 24 24"><path d="m13 2-3 9H5l6 11 3-9h5L13 2Z" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/></symbol>
      <symbol id="i-wand"    viewBox="0 0 24 24"><path d="m15 4 1-3 1 3 3 1-3 1-1 3-1-3-3-1 3-1ZM4 20 16 8M6 8l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2ZM17 15l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2Z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/></symbol>
      <symbol id="i-check"   viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></symbol>
      <symbol id="i-play"    viewBox="0 0 24 24"><path d="m8 5 12 7-12 7V5Z" fill="currentColor" stroke="currentColor" strokeLinejoin="round"/></symbol>
      <symbol id="i-arrow"   viewBox="0 0 24 24"><path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></symbol>
      <symbol id="i-menu"    viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></symbol>
      <symbol id="i-close"   viewBox="0 0 24 24"><path d="m18 6-12 12M6 6l12 12" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></symbol>
      <symbol id="i-clock"   viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M12 7v5l3 2" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></symbol>
      <symbol id="i-shield"  viewBox="0 0 24 24"><path d="M12 3 4 7v5c0 5 4 9 8 10 4-1 8-5 8-10V7l-8-4Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/></symbol>
    </svg>
  );
}

function Icon({ id, size = 17 }: { id: string; size?: number }) {
  return <svg aria-hidden="true" style={{ width: size, height: size, flexShrink: 0 }}><use href={`#${id}`} /></svg>;
}

// ─── Scroll-reveal hook ────────────────────────────────────────────────────────
function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add("visible");
          observer.unobserve(e.target);
        }
      }),
      { threshold: 0.12 }
    );
    document.querySelectorAll(".reveal").forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

// ─── Navbar ────────────────────────────────────────────────────────────────────
function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileOpen(false);
  };

  return (
    <nav className={`lp-nav${scrolled ? " scrolled" : ""}`}>
      <a className="lp-nav-logo" href="#hero" onClick={e => { e.preventDefault(); scrollTo("hero"); }}>
        <span className="lp-nav-logo-mark"><Icon id="i-sparkles" size={18} /></span>
        <span className="lp-nav-logo-text">EZ-GEN <span>STUDIO</span></span>
      </a>

      <div className="lp-nav-links">
        {[["features", "ฟีเจอร์"], ["how", "วิธีใช้งาน"], ["showcase", "ตัวอย่างผลงาน"], ["pricing", "ราคา"]].map(([id, label]) => (
          <button key={id} className="lp-nav-link" onClick={() => scrollTo(id)}>{label}</button>
        ))}
      </div>

      <div className="lp-nav-actions">
        <button className="lp-btn-ghost">เข้าสู่ระบบ</button>
        <button className="lp-btn-cta" onClick={() => scrollTo("pricing")}>เริ่มต้นฟรี</button>
      </div>

      <button className="icon-button lp-nav-hamburger" onClick={() => setMobileOpen(v => !v)} aria-label="เมนู">
        <Icon id={mobileOpen ? "i-close" : "i-menu"} />
      </button>

      {mobileOpen && (
        <div style={{
          position: "fixed", inset: "64px 0 0", zIndex: 89,
          background: "rgba(8,8,13,.97)", backdropFilter: "blur(16px)",
          padding: "24px 20px", display: "flex", flexDirection: "column", gap: 8
        }}>
          {[["features", "ฟีเจอร์"], ["how", "วิธีใช้งาน"], ["showcase", "ตัวอย่างผลงาน"], ["pricing", "ราคา"]].map(([id, label]) => (
            <button key={id} className="lp-nav-link" style={{ textAlign: "left", fontSize: 15, padding: "12px 8px" }} onClick={() => scrollTo(id)}>{label}</button>
          ))}
          <div style={{ borderTop: "1px solid rgba(255,255,255,.08)", paddingTop: 16, marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
            <button className="lp-btn-ghost" style={{ width: "100%", padding: "12px" }}>เข้าสู่ระบบ</button>
            <button className="lp-btn-cta" style={{ width: "100%", padding: "12px" }}>เริ่มต้นฟรี</button>
          </div>
        </div>
      )}
    </nav>
  );
}

// ─── Hero ──────────────────────────────────────────────────────────────────────
const HERO_IMAGES = [
  { src: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=600&q=85", alt: "เมืองยามค่ำคืน", title: "Midnight in Tokyo", tag: "EZ-Cinema" },
  { src: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=85", alt: "ยอดเขาและเมฆ", title: "Cloud Kingdom", tag: "EZ-Motion 2.0" },
  { src: "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=600&q=85", alt: "น้ำหอมหรูหรา", title: "Scent of Silence", tag: "EZ-Realism" },
];

function HeroSection() {
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  return (
    <section className="lp-hero" id="hero">
      <div className="lp-hero-orb lp-hero-orb-1" />
      <div className="lp-hero-orb lp-hero-orb-2" />
      <div className="lp-hero-orb lp-hero-orb-3" />

      <div className="lp-hero-inner">

        {/* Floating preview cards */}
        <div className="lp-hero-visual mb-8">
          {HERO_IMAGES.map((item, i) => (
            <div key={item.title} className={`lp-card lp-card-${i + 1}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.src} alt={item.alt} />
              <div className="lp-card-overlay">
                <div className="lp-card-tag">{item.tag}</div>
                <div style={{ fontSize: 10, color: "#d8d0ec", marginTop: 2 }}>{item.title}</div>
              </div>
            </div>
          ))}
        </div>

        <h1 className="lp-hero-h1 mt-3">
          เปลี่ยนจินตนาการ<br />
          <span className="lp-hero-h1-grad">ให้เป็นการเคลื่อนไหว</span>
        </h1>

        <p className="lp-hero-sub">
          พิมพ์แนวคิด กด Generate — EZ-Gen Studio แปลงข้อความและรูปภาพของคุณ<br />
          ให้กลายเป็นวิดีโอ AI ระดับภาพยนตร์ภายในไม่กี่วินาที
        </p>

        <div className="lp-hero-actions">
          <button className="lp-hero-primary" onClick={() => scrollTo("pricing")}>
            <Icon id="i-sparkles" size={16} />
            เริ่มสร้างสรรค์ฟรี
          </button>
          <button className="lp-hero-secondary" onClick={() => scrollTo("showcase")}>
            <Icon id="i-play" size={16} />
            ดูตัวอย่างผลงาน
          </button>
        </div>

        
      </div>
    </section>
  );
}

// ─── Stats bar ────────────────────────────────────────────────────────────────
const STATS = [
  { num: "10,000+", label: "ผลงานที่สร้างแล้ว" },
  { num: "4",       label: "โมเดล AI" },
  { num: "< 30วิ", label: "เวลาในการสร้าง" },
  { num: "4.9★",   label: "คะแนนผู้ใช้งาน" },
];

function StatsBar() {
  return (
    <div className="lp-stats">
      {STATS.map(s => (
        <div key={s.label} className="lp-stat">
          <span className="lp-stat-num">{s.num}</span>
          <span className="lp-stat-label">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Features ─────────────────────────────────────────────────────────────────
const FEATURES = [
  { icon: "i-wand",   color: "purple", title: "ข้อความเป็นวิดีโอ",      desc: "แค่พิมพ์แนวคิดของคุณ เลือกโมเดล แล้วปล่อยให้ AI สร้างฉากที่คุณจินตนาการขึ้นมาทุกรายละเอียด" },
  { icon: "i-image",  color: "blue",   title: "รูปภาพเป็นวิดีโอ",      desc: "นำรูปภาพที่คุณชื่นชอบมาใส่ชีวิต — กล้องเคลื่อนไหว แสงสว่างเปลี่ยน บรรยากาศเต้นระบำ" },
  { icon: "i-move",   color: "rose",   title: "ควบคุมการเคลื่อนไหว",   desc: "กำหนดทิศทาง zoom pan tilt และ dolly ด้วยคำสั่งภาษาธรรมชาติ — ควบคุมกล้องอย่างผู้กำกับมืออาชีพ" },
  { icon: "i-zap",    color: "green",  title: "เพิ่มคุณภาพวิดีโอ",     desc: "อัพเกรดความละเอียดและความคมชัดของวิดีโอที่มีอยู่ด้วย AI Enhancement ได้ทันที" },
  { icon: "i-shield", color: "amber",  title: "ปลอดภัย 100%",          desc: "ผลงานทั้งหมดของคุณเป็นของคุณ ไม่มีการนำข้อมูลไปฝึก AI หรือแชร์กับบุคคลที่สาม" },
  { icon: "i-clock",  color: "purple", title: "ผลลัพธ์รวดเร็ว",        desc: "คิวสร้างวิดีโอของเราตอบสนองเร็ว สร้างได้ทันทีโดยไม่ต้องรอคิว แม้ในชั่วโมงเร่งด่วน" },
];

function FeaturesSection() {
  return (
    <section id="features" style={{ background: "rgba(255,255,255,.012)", borderTop: "1px solid rgba(255,255,255,.06)", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
      <div className="lp-section">
        <div className="lp-section-head centered reveal">
          <span className="lp-section-eyebrow">ฟีเจอร์</span>
          <h2 className="lp-section-h2">ทุกเครื่องมือที่คุณต้องการ<br />อยู่ในที่เดียว</h2>
          <p className="lp-section-sub centered">จากข้อความธรรมดาสู่วิดีโอระดับมืออาชีพ EZ-Gen Studio มอบเครื่องมือครบชุดสำหรับทุกขั้นตอนของกระบวนการสร้างสรรค์</p>
        </div>
        <div className="lp-features-grid">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="lp-feature-card reveal" style={{ transitionDelay: `${i * 80}ms` }}>
              <div className={`lp-feature-icon ${f.color}`}><Icon id={f.icon} size={20} /></div>
              <h3 className="lp-feature-h">{f.title}</h3>
              <p className="lp-feature-p">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── How it works ─────────────────────────────────────────────────────────────
const STEPS = [
  { num: "01", title: "เขียนพรอมต์", desc: "อธิบายฉากที่คุณต้องการ ระบุตัวละคร แสงสว่าง การเคลื่อนไหว และบรรยากาศ ยิ่งละเอียดยิ่งได้ผลลัพธ์ที่ดี" },
  { num: "02", title: "เลือกการตั้งค่า", desc: "เลือกโมเดล AI อัตราส่วนภาพ ระยะเวลา และคุณภาพ ระบบจะแสดงค่าใช้จ่ายเครดิตก่อนสร้าง" },
  { num: "03", title: "สร้างและดาวน์โหลด", desc: "กด Generate แล้วรอไม่เกิน 30 วินาที วิดีโอพร้อมดาวน์โหลดและแชร์ทันที" },
];

function HowItWorksSection() {
  return (
    <section id="how">
      <div className="lp-section">
        <div className="lp-steps-wrap">
          <div>
            <div className="lp-section-head reveal">
              <span className="lp-section-eyebrow">วิธีใช้งาน</span>
              <h2 className="lp-section-h2">สร้างวิดีโอ AI<br />ง่ายใน 3 ขั้นตอน</h2>
              <p className="lp-section-sub">ไม่ต้องมีความรู้ด้านการตัดต่อ ไม่ต้องมีซอฟต์แวร์ราคาแพง แค่ไอเดียและคีย์บอร์ดก็พอ</p>
            </div>
            <div className="lp-steps-list">
              {STEPS.map((s, i) => (
                <div key={s.num} className="lp-step reveal" style={{ transitionDelay: `${i * 100}ms` }}>
                  <div className="lp-step-num">{s.num}</div>
                  <div>
                    <h3 className="lp-step-h">{s.title}</h3>
                    <p className="lp-step-p">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lp-steps-visual reveal">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=900&q=85" alt="ผลงานตัวอย่างจาก EZ-Gen Studio" />
            <div className="lp-steps-visual-overlay" />
            <div className="lp-steps-badge">
              <div className="lp-steps-badge-icon"><Icon id="i-sparkles" size={15} /></div>
              <div>
                <strong>EZ-Motion 2.0</strong>
                <span>กำลังประมวลผล · 00:08 · 16:9</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Showcase ─────────────────────────────────────────────────────────────────
const SHOWCASE = [
  { src: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=600&q=80", label: "Midnight in Tokyo · EZ-Cinema" },
  { src: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80", label: "Cloud Kingdom · EZ-Motion 2.0" },
  { src: "https://images.unsplash.com/photo-1541643600914-78b084683601?auto=format&fit=crop&w=600&q=80", label: "Scent of Silence · EZ-Realism" },
  { src: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600&q=80", label: "After Hours · EZ-Realism" },
  { src: "https://images.unsplash.com/photo-1501854140801-50d01698950b?auto=format&fit=crop&w=600&q=80", label: "Wilderness Dream · EZ-Motion 2.0" },
  { src: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=600&q=80", label: "Urban Portrait · EZ-Cinema" },
  { src: "https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?auto=format&fit=crop&w=600&q=80", label: "Abstract Flow · EZ-Fast" },
  { src: "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=600&q=80", label: "Mountain Mist · EZ-Realism" },
];

function ShowcaseSection() {
  return (
    <section id="showcase" style={{ background: "rgba(255,255,255,.012)", borderTop: "1px solid rgba(255,255,255,.06)", borderBottom: "1px solid rgba(255,255,255,.06)" }}>
      <div className="lp-section">
        <div className="lp-section-head centered reveal">
          <span className="lp-section-eyebrow">ตัวอย่างผลงาน</span>
          <h2 className="lp-section-h2">สร้างด้วย EZ-Gen Studio</h2>
          <p className="lp-section-sub centered">ผลงานทั้งหมดสร้างจากพรอมต์ภาษาไทยโดยผู้ใช้จริง ไม่มีการแต่งภาพเพิ่มเติม</p>
        </div>
        <div className="lp-showcase-grid">
          {SHOWCASE.map((item, i) => (
            <div key={i} className="lp-showcase-item reveal" style={{ transitionDelay: `${(i % 4) * 70}ms` }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={item.src} alt={item.label} loading="lazy" />
              <div className="lp-showcase-overlay">
                <span>{item.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────
const PLANS = [
  {
    name: "ผู้สร้าง",
    price: "฿690",
    period: "/ เดือน",
    featured: false,
    features: ["5,000 เครดิตต่อเดือน", "วิดีโอ HD ทุกโมเดล", "พื้นที่ทำงานส่วนตัว", "ดาวน์โหลดไม่จำกัด"],
    cta: "เริ่มต้นฟรี 7 วัน",
  },
  {
    name: "สตูดิโอโปร",
    price: "฿1,790",
    period: "/ เดือน",
    featured: true,
    features: ["15,000 เครดิตต่อเดือน", "คิวสร้างลำดับความสำคัญ", "การควบคุมขั้นสูง", "พื้นที่ทำงานทีม", "รองรับลูกค้าพิเศษ"],
    cta: "ลองสตูดิโอโปรฟรี",
  },
];

function PricingSection() {
  return (
    <section id="pricing">
      <div className="lp-section">
        <div className="lp-section-head centered reveal">
          <span className="lp-section-eyebrow">ราคา</span>
          <h2 className="lp-section-h2">เลือกแผนที่ใช่สำหรับคุณ</h2>
          <p className="lp-section-sub centered">ทดลองฟรี 7 วัน ไม่ต้องใส่บัตรเครดิต ยกเลิกได้ตลอดเวลา</p>
        </div>
        <div className="lp-pricing-grid">
          {PLANS.map((plan, i) => (
            <div key={plan.name} className={`lp-price-card${plan.featured ? " featured" : ""} reveal`} style={{ transitionDelay: `${i * 100}ms` }}>
              {plan.featured && (
                <div className="lp-price-tag">
                  <span style={{ color: "#c4a5ff", background: "rgba(155,109,255,.15)", border: "1px solid rgba(155,109,255,.25)", borderRadius: 100, padding: "3px 10px", fontSize: 10, fontWeight: 700 }}>ยอดนิยม</span>
                </div>
              )}
              <p className="lp-price-plan">{plan.name}</p>
              <div className="lp-price-amount">{plan.price}<small>{plan.period}</small></div>
              <ul className="lp-price-list">
                {plan.features.map(f => (
                  <li key={f}><Icon id="i-check" size={14} />{f}</li>
                ))}
              </ul>
              <button className={`lp-price-btn ${plan.featured ? "lp-price-btn-solid" : "lp-price-btn-outline"}`}>
                {plan.cta}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────────────────────
function CtaSection() {
  return (
    <div className="lp-cta-wrap reveal">
      <span className="lp-section-eyebrow" style={{ display: "block", marginBottom: 16 }}>เริ่มต้นวันนี้</span>
      <h2 className="lp-cta-h">พร้อมเปลี่ยนจินตนาการ<br />ให้เป็นการเคลื่อนไหวหรือยัง?</h2>
      <p className="lp-cta-sub">เข้าร่วมกับผู้สร้างสรรค์กว่า 10,000 คนที่ใช้ EZ-Gen Studio สร้างวิดีโอ AI ระดับภาพยนตร์ทุกวัน</p>
      <div className="lp-cta-actions">
        <button className="lp-hero-primary" onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}>
          <Icon id="i-sparkles" size={16} />
          เริ่มสร้างสรรค์ฟรี 7 วัน
        </button>
        <button className="lp-hero-secondary" onClick={() => document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })}>
          <Icon id="i-arrow" size={16} />
          ดูวิธีใช้งาน
        </button>
      </div>
    </div>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <>
      <footer className="lp-footer">
        <div className="lp-footer-brand">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div className="lp-nav-logo-mark"><Icon id="i-sparkles" size={16} /></div>
            <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: "1.2px" }}>EZ-GEN <span style={{ color: "#bb9bff" }}>STUDIO</span></span>
          </div>
          <p>สร้างวิดีโอ AI ระดับภาพยนตร์จากข้อความ รูปภาพ และแนวคิดของคุณ</p>
        </div>
        <div className="lp-footer-col">
          <h4>ผลิตภัณฑ์</h4>
          <a href="#">ฟีเจอร์</a>
          <a href="#">ราคา</a>
          <a href="#">ตัวอย่างผลงาน</a>
          <a href="#">อัพเดท</a>
        </div>
        <div className="lp-footer-col">
          <h4>บริษัท</h4>
          <a href="#">เกี่ยวกับเรา</a>
          <a href="#">บล็อก</a>
          <a href="#">ติดต่อเรา</a>
          <a href="#">ร่วมงานกับเรา</a>
        </div>
        <div className="lp-footer-col">
          <h4>ช่วยเหลือ</h4>
          <a href="#">คู่มือการใช้งาน</a>
          <a href="#">FAQ</a>
          <a href="#">นโยบายความเป็นส่วนตัว</a>
          <a href="#">เงื่อนไขการใช้งาน</a>
        </div>
      </footer>
      <div className="lp-footer-bottom">
        <span>© 2026 EZ-Gen Studio · สงวนลิขสิทธิ์</span>
        <span>สร้างในประเทศไทย 🇹🇭</span>
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  useScrollReveal();
  const pageRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={pageRef}>
      <IconSprite />
      <Navbar />
      <HeroSection />
      <StatsBar />
      <FeaturesSection />
      <HowItWorksSection />
      <ShowcaseSection />
      <PricingSection />
      <CtaSection />
      <Footer />
    </div>
  );
}
