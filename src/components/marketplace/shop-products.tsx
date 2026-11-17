"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Flame, Loader2, Package, Pencil, Plus, RotateCw, Search, Sparkles } from "lucide-react";
import w from "@/components/workbench/workbench.module.css";
import m from "./marketplace.module.css";
import { useToast } from "@/components/workbench/workbench-ui";
import { useLibraryList } from "@/components/workbench/use-library-list";
import { PRODUCT_STATUS_LABEL, baht, failText, marketplaceApi, thaiDate, type Product, type ProductStatus, type Shop, type Trends } from "@/lib/marketplace-api";
import { Channels, Crumbs, ProductForm, ShopForm } from "./marketplace-ui";
import { ShopLogo } from "./shop-list";

const STATUS_TABS: { id: ProductStatus | ""; label: string }[] = [
  { id: "", label: "ทั้งหมด" },
  { id: "active", label: PRODUCT_STATUS_LABEL.active },
  { id: "draft", label: PRODUCT_STATUS_LABEL.draft },
  { id: "archived", label: PRODUCT_STATUS_LABEL.archived },
];

export const TRENDS_NOTICE = "รายการนี้ AI ประเมินจากฤดูกาลและพฤติกรรมผู้ซื้อทั่วไป ไม่ใช่ข้อมูลยอดขายสดจากแพลตฟอร์ม ควรตรวจสอบกับหน้าเทรนด์ของแต่ละแพลตฟอร์มก่อนตัดสินใจ";

function TrendsPanel({ shopId, initial, notify }: { shopId: string; initial: Trends | null; notify: (text: string) => void }) {
  const [trends, setTrends] = useState(initial);
  const [busy, setBusy] = useState(false);
  const load = async () => {
    setBusy(true);
    try { setTrends(await marketplaceApi.suggestTrends(shopId)); }
    catch (e) { notify(failText(e)); }
    finally { setBusy(false); }
  };
  return (
    <section className={w.panel} aria-label="สินค้าที่กำลังมาแรง">
      <div className={m.itemTop}>
        <h2><Flame aria-hidden style={{ width: 16, height: 16, verticalAlign: -2, marginRight: 6 }} />สินค้าที่น่าจะมาแรงช่วงนี้</h2>
        <button type="button" className={w.secondary} disabled={busy} onClick={() => void load()}>
          {busy ? <Loader2 className={m.spin} aria-hidden /> : <Sparkles aria-hidden />}{busy ? "กำลังวิเคราะห์…" : trends ? "วิเคราะห์ใหม่" : "ให้ AI วิเคราะห์"}
        </button>
      </div>
      <p className={m.notice}>{TRENDS_NOTICE}</p>
      {trends ? (
        <>
          <div className={w.grid}>
            {trends.items.map((item, i) => (
              <article key={`${item.name}-${i}`} className={m.item}>
                <div className={m.itemTop}><h3>{item.name}</h3>{item.category && <span className={`${w.tag} ${w.tagAccent}`}>{item.category}</span>}</div>
                <p>{item.why}</p>
                {item.contentIdea && <p className={m.hook}>ไอเดียคอนเทนต์: {item.contentIdea}</p>}
              </article>
            ))}
          </div>
          <p className={w.note} style={{ textAlign: "left" }}>วิเคราะห์เมื่อ {thaiDate(trends.generatedAt)}</p>
        </>
      ) : !busy && <p className={w.note} style={{ textAlign: "left" }}>กดปุ่มเพื่อให้ AI เสนอประเภทสินค้าที่เข้ากับร้านและช่วงเวลานี้</p>}
    </section>
  );
}

/** Products of one shop, with the shop header, a product form panel and the trend suggestions. */
export function ShopProducts({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const [shop, setShop] = useState<Shop | null>(null);
  const [shopError, setShopError] = useState("");
  const [panel, setPanel] = useState<"shop" | "product" | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProductStatus | "">("");
  const list = useLibraryList<Product>(`${id}|${status}|${query.trim()}`, (page, signal) => marketplaceApi.products(id, { q: query, status, page }, signal));

  useEffect(() => {
    const ctl = new AbortController();
    marketplaceApi.shop(id, ctl.signal).then(setShop).catch((e: unknown) => { if (!ctl.signal.aborted) setShopError(failText(e)); });
    return () => ctl.abort();
  }, [id]);

  if (shopError) {
    return (
      <div className={w.page}>
        <Crumbs trail={[{ label: "Marketplace", href: "/studio/marketplace" }, { label: "ไม่พบร้านค้า" }]} />
        <div className={w.empty} style={{ padding: 60 }}><Package aria-hidden /><h3>เปิดร้านค้านี้ไม่ได้</h3><p>{shopError}</p>
          <Link href="/studio/marketplace" className={w.secondary}>กลับไปหน้ารวมร้านค้า</Link></div>
      </div>
    );
  }
  if (!shop) return <div className={w.page}><div className={w.empty} style={{ padding: 60 }}><Loader2 className={m.spin} aria-hidden /><p role="status">กำลังเปิดร้านค้า…</p></div></div>;

  return (
    <div className={w.page}>
      <Crumbs trail={[{ label: "Marketplace", href: "/studio/marketplace" }, { label: shop.name }]} />
      <header className={w.head}>
        <div className={w.cardTop}>
          <ShopLogo shop={shop} />
          <div>
            <h1>{shop.name}</h1>
            <p>{[shop.category, shop.status === "inactive" ? "ปิดชั่วคราว" : "", shop.description].filter(Boolean).join(" · ") || "ยังไม่มีคำอธิบายร้าน"}</p>
          </div>
        </div>
        <div className={w.toolbar}>
          <button type="button" className={w.secondary} onClick={() => setPanel("shop")}><Pencil aria-hidden />แก้ไขร้าน</button>
          <button type="button" className={w.primary} onClick={() => setPanel("product")}><Plus aria-hidden />เพิ่มสินค้า</button>
        </div>
      </header>
      <Channels source={shop} showMissing />

      <div className={w.toolbar}>
        <div className={w.tabs} role="tablist" aria-label="สถานะสินค้า">
          {STATUS_TABS.map((t) => <button key={t.id || "all"} type="button" role="tab" aria-selected={status === t.id} onClick={() => setStatus(t.id)}>{t.label}</button>)}
        </div>
        <label className={w.search}><Search aria-hidden /><input value={query} maxLength={100} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาชื่อสินค้า หรือ SKU" aria-label="ค้นหาสินค้า" /></label>
      </div>

      <div>
        <div className={w.grid} aria-busy={list.loading}>
          {!list.loading && list.items.map((p) => (
            <Link key={p.id} href={`/studio/marketplace/${id}/products/${p.id}`} className={`${w.card} ${m.cardLink}`}>
              <span className={m.cover}>
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL; next/image would cache it past expiry */}
                {p.images[0] ? <img src={p.images[0].url} alt="" loading="lazy" /> : <Package aria-hidden />}
              </span>
              <h3>{p.name}</h3>
              <span className={m.price}>{baht(p.price)}</span>
              <p>ขาย 30 วัน: {p.recentUnits.toLocaleString("th-TH")} ชิ้น · {baht(p.recentRevenue)}</p>
              <div className={w.meta}>
                <span className={`${w.tag} ${p.status === "active" ? w.tagAccent : ""}`}>{PRODUCT_STATUS_LABEL[p.status]}</span>
                <span className={w.tag}>{p.contentCount} คอนเทนต์</span>
                <span>สต็อก {p.stock.toLocaleString("th-TH")}</span>
              </div>
            </Link>
          ))}
          {list.loading && <div className={w.empty} style={{ gridColumn: "1 / -1", padding: 40 }}><Loader2 className={m.spin} aria-hidden /><p>กำลังโหลดสินค้า…</p></div>}
          {!list.loading && list.error && (
            <div className={w.empty} style={{ gridColumn: "1 / -1", padding: 40 }}><Package aria-hidden /><h3>โหลดไม่สำเร็จ</h3><p>{list.error}</p>
              <button type="button" className={w.secondary} onClick={list.reload}><RotateCw aria-hidden />ลองใหม่</button></div>
          )}
          {!list.loading && !list.error && list.items.length === 0 && (
            <div className={w.empty} style={{ gridColumn: "1 / -1", padding: 40 }}><Package aria-hidden />
              <h3>{query.trim() || status ? "ไม่พบสินค้า" : "ร้านนี้ยังไม่มีสินค้า"}</h3>
              <p>{query.trim() || status ? "ลองเปลี่ยนคำค้นหรือสถานะ" : "เพิ่มสินค้าเพื่อเริ่มสร้างวิดีโอโปรโมทและบันทึกยอดขาย"}</p>
              {!query.trim() && !status && <button type="button" className={w.primary} onClick={() => setPanel("product")}><Plus aria-hidden />เพิ่มสินค้า</button>}
            </div>
          )}
          {!list.loading && list.hasMore && (
            <button type="button" className={w.secondary} style={{ gridColumn: "1 / -1", justifySelf: "center" }} disabled={list.loadingMore} onClick={() => void list.loadMore()}>
              {list.loadingMore ? "กำลังโหลด…" : `โหลดเพิ่ม (${list.items.length}/${list.total})`}
            </button>
          )}
        </div>

        {panel === "shop" && (
          <ShopForm key={shop.updatedAt} initial={shop} notify={toast.show} onClose={() => setPanel(null)}
            onSaved={(next) => { setShop({ ...next, trends: next.trends ?? shop.trends }); setPanel(null); }}
            onDeleted={() => router.push("/studio/marketplace")} />
        )}
        {panel === "product" && (
          <ProductForm shopId={id} notify={toast.show} onClose={() => setPanel(null)}
            onSaved={(product) => router.push(`/studio/marketplace/${id}/products/${product.id}`)} />
        )}
      </div>

      <TrendsPanel shopId={id} initial={shop.trends} notify={toast.show} />
      {toast.node}
    </div>
  );
}
