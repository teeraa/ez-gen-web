"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Pencil, Plus, RotateCw, Search, Store } from "lucide-react";
import w from "@/components/workbench/workbench.module.css";
import m from "./marketplace.module.css";
import { WorkbenchHead, useToast } from "@/components/workbench/workbench-ui";
import { useLibraryList } from "@/components/workbench/use-library-list";
import { marketplaceApi, type Shop } from "@/lib/marketplace-api";
import { Channels, ShopForm } from "./marketplace-ui";

export function ShopLogo({ shop }: { shop: Pick<Shop, "name" | "logoUrl"> }) {
  return (
    <span className={m.logo} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL; next/image would cache it past expiry */}
      {shop.logoUrl ? <img src={shop.logoUrl} alt="" /> : shop.name.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}

/** Marketplace landing page: every shop the user owns, with a side panel to add or edit one. */
export function ShopList() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [form, setForm] = useState<{ shop?: Shop } | null>(null);
  const toast = useToast();
  const list = useLibraryList<Shop>(query.trim(), (page, signal) => marketplaceApi.shops({ q: query, page }, signal));

  const saved = (shop: Shop, created: boolean) => {
    if (created) { router.push(`/studio/marketplace/${shop.id}`); return; }
    list.setItems((items) => items.map((s) => (s.id === shop.id ? { ...shop, productCount: s.productCount } : s)));
    setForm(null);
  };

  return (
    <div className={w.page}>
      <WorkbenchHead preview={false} icon={<Store aria-hidden />} title="Marketplace"
        description="รวมร้านค้าของคุณ เลือกร้านเพื่อจัดการสินค้า สร้างคอนเทนต์โปรโมท และติดตามยอดขาย"
        actions={<button type="button" className={w.primary} onClick={() => setForm({})}><Plus aria-hidden />เพิ่มร้านค้า</button>} />

      <div className={w.toolbar}>
        <label className={w.search}><Search aria-hidden /><input value={query} maxLength={100} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาร้านค้า" aria-label="ค้นหาร้านค้า" /></label>
      </div>

      <div>
        <div className={w.grid} style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }} aria-busy={list.loading}>
          {!list.loading && list.items.map((shop) => (
            <article key={shop.id} className={`${w.card} ${form?.shop?.id === shop.id ? w.cardOn : ""}`}>
              <Link href={`/studio/marketplace/${shop.id}`} className={`${w.cardTop} ${m.cardLink}`}>
                <ShopLogo shop={shop} />
                <div>
                  <h3>{shop.name}</h3>
                  <p>{shop.category || "ยังไม่ระบุหมวดหมู่"}</p>
                </div>
              </Link>
              {shop.description && <p className={w.clamp}>{shop.description}</p>}
              <Channels source={shop} />
              <div className={w.meta}>
                <span className={`${w.tag} ${w.tagAccent}`}>{shop.productCount} สินค้า</span>
                {shop.status === "inactive" && <span className={w.tag}>ปิดชั่วคราว</span>}
              </div>
              <div className={w.cardActions}>
                <Link href={`/studio/marketplace/${shop.id}`} className={w.secondary}>ดูสินค้า</Link>
                <button type="button" className={w.ghost} onClick={() => setForm({ shop })}><Pencil aria-hidden />แก้ไข</button>
              </div>
            </article>
          ))}
          {list.loading && <div className={w.empty} style={{ gridColumn: "1 / -1", padding: 40 }}><Loader2 className={m.spin} aria-hidden /><p>กำลังโหลดร้านค้า…</p></div>}
          {!list.loading && list.error && (
            <div className={w.empty} style={{ gridColumn: "1 / -1", padding: 40 }}><Store aria-hidden /><h3>โหลดไม่สำเร็จ</h3><p>{list.error}</p>
              <button type="button" className={w.secondary} onClick={list.reload}><RotateCw aria-hidden />ลองใหม่</button></div>
          )}
          {!list.loading && !list.error && list.items.length === 0 && (
            <div className={w.empty} style={{ gridColumn: "1 / -1", padding: 40 }}><Store aria-hidden />
              <h3>{query.trim() ? "ไม่พบร้านค้า" : "ยังไม่มีร้านค้า"}</h3>
              <p>{query.trim() ? "ลองค้นหาด้วยคำอื่น" : "เพิ่มร้านค้าแรกเพื่อเริ่มจัดการสินค้าและสร้างคอนเทนต์โปรโมท"}</p>
              {!query.trim() && <button type="button" className={w.primary} onClick={() => setForm({})}><Plus aria-hidden />เพิ่มร้านค้า</button>}
            </div>
          )}
          {!list.loading && list.hasMore && (
            <button type="button" className={w.secondary} style={{ gridColumn: "1 / -1", justifySelf: "center" }} disabled={list.loadingMore} onClick={() => void list.loadMore()}>
              {list.loadingMore ? "กำลังโหลด…" : `โหลดเพิ่ม (${list.items.length}/${list.total})`}
            </button>
          )}
        </div>

        {form && (
          <ShopForm key={form.shop?.id ?? "new"} initial={form.shop} notify={toast.show} onClose={() => setForm(null)}
            onSaved={(shop) => saved(shop, !form.shop)}
            onDeleted={() => { const gone = form.shop?.id; list.setItems((items) => items.filter((s) => s.id !== gone)); list.setTotal((n) => Math.max(0, n - 1)); setForm(null); }} />
        )}
      </div>
      {toast.node}
    </div>
  );
}
