import Link from "next/link";
import { Sparkles } from "lucide-react";
import { ThemeToggle } from "./theme-root";
import s from "./landing.module.css";

/** Landing navbar for signed-out visitors (signed-in users get the app shell instead). */
export function PublicNav() {
  return (
    <header className={s.nav}>
      <div className={s.navIn}>
        <Link className={s.brand} href="/">
          <span className={s.brandMark}>
            <Sparkles size={16} strokeWidth={1.8} />
          </span>
          <b>Story</b>
          <span>Flow</span>
        </Link>
        <nav className={s.navLinks} aria-label="หัวข้อในหน้า">
          <a href="#flow">วิธีใช้งาน</a>
          <a href="#cast">ตัวละคร</a>
          <a href="#features">ฟีเจอร์</a>
        </nav>
        <div className={s.navRight}>
          <ThemeToggle />
          <Link className={`${s.btn} ${s.btnGhost}`} href="/signin">
            เข้าสู่ระบบ
          </Link>
          <Link className={`${s.btn} ${s.btnPrimary}`} href="/signup">
            เริ่มใช้ฟรี
          </Link>
        </div>
      </div>
    </header>
  );
}
