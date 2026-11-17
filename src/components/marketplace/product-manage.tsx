"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BarChart3, Clapperboard, Loader2, Package, Send, Sparkles, Tag } from "lucide-react";
import w from "@/components/workbench/workbench.module.css";
import m from "./marketplace.module.css";
import { useToast } from "@/components/workbench/workbench-ui";
import { PRODUCT_STATUS_LABEL, baht, failText, marketplaceApi, type Content, type Product, type Publish } from "@/lib/marketplace-api";
import { Channels, Crumbs, ProductForm } from "./marketplace-ui";
import { ProductContents, type ContentDraft } from "./product-contents";
import { ProductShare } from "./product-share";
import { ProductSales } from "./product-sales";
import { ProductAdvice } from "./product-advice";

type Tab = "contents" | "share" | "sales" | "advice" | "info";

const TABS: { id: Tab; label: string; icon: typeof Tag }[] = [
  { id: "contents", label: "คอนเทนต์โปรโมท", icon: Clapperboard },
  { id: "share", label: "แชร์ไปแพลตฟอร์ม", icon: Send },
  { id: "sales", label: "ยอดขาย", icon: BarChart3 },
  { id: "advice", label: "AI แนะนำ", icon: Sparkles },
  { id: "info", label: "ข้อมูลสินค้า", icon: Tag },
];

/** One product: promo content, the log of manual posts, sales figures, AI advice and its details. */
export function ProductManage({ shopId, productId }: { shopId: string; productId: string }) {
  const router = useRouter();
  const toast = useToast();
  const [product, setProduct] = useState<Product | null>(null);
  const [contents, setContents] = useState<Content[]>([]);
  const [publishes, setPublishes] = useState<Publish[]>([]);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("contents");
  const [draft, setDraft] = useState<ContentDraft | null>(null);
  const [shareContentId, setShareContentId] = useState("");

  useEffect(() => {
    const ctl = new AbortController();
    Promise.all([marketplaceApi.product(productId, ctl.signal), marketplaceApi.contents(productId, ctl.signal), marketplaceApi.publishes(productId, ctl.signal)])
      .then(([p, c, pub]) => { setProduct(p); setContents(c); setPublishes(pub); })
      .catch((e: unknown) => { if (!ctl.signal.aborted) setError(failText(e)); });
    return () => ctl.abort();
  }, [productId]);

  const shopHref = `/studio/marketplace/${shopId}`;
  if (error) {
    return (
      <div className={w.page}>
        <Crumbs trail={[{ label: "Marketplace", href: "/studio/marketplace" }, { label: "ร้านค้า", href: shopHref }, { label: "ไม่พบสินค้า" }]} />
        <div className={w.empty} style={{ padding: 60 }}><Package aria-hidden /><h3>เปิดสินค้านี้ไม่ได้</h3><p>{error}</p>
          <Link href={shopHref} className={w.secondary}>กลับไปหน้าร้านค้า</Link></div>
      </div>
    );
  }
  if (!product) return <div className={w.page}><div className={w.empty} style={{ padding: 60 }}><Loader2 className={m.spin} aria-hidden /><p role="status">กำลังเปิดสินค้า…</p></div></div>;

  return (
    <div className={w.page}>
      <Crumbs trail={[{ label: "Marketplace", href: "/studio/marketplace" }, { label: product.shopName || "ร้านค้า", href: shopHref }, { label: product.name }]} />

      <header className={m.hero}>
        <span className={m.cover}>
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL; next/image would cache it past expiry */}
          {product.images[0] ? <img src={product.images[0].url} alt="" /> : <Package aria-hidden />}
        </span>
        <div>
          <h1>{product.name}</h1>
          <p>{[baht(product.price), `สต็อก ${product.stock.toLocaleString("th-TH")} ชิ้น`, product.category, product.sku && `SKU ${product.sku}`].filter(Boolean).join(" · ")}</p>
          <div className={w.meta} style={{ marginTop: 8 }}>
            <span className={`${w.tag} ${product.status === "active" ? w.tagAccent : ""}`}>{PRODUCT_STATUS_LABEL[product.status]}</span>
            <span className={w.tag}>{contents.length} คอนเทนต์</span>
            <span className={w.tag}>{publishes.length} โพสต์</span>
          </div>
        </div>
        <Channels source={product} showMissing />
      </header>

      <div className={w.tabs} role="tablist" aria-label="จัดการสินค้า">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}><Icon aria-hidden />{label}</button>
        ))}
      </div>

      {tab === "contents" && (
        <ProductContents product={product} contents={contents} setContents={setContents} draft={draft} clearDraft={() => setDraft(null)} notify={toast.show}
          onShare={(contentId) => { setShareContentId(contentId); setTab("share"); }} />
      )}
      {tab === "share" && (
        <ProductShare key={shareContentId} product={product} contents={contents} publishes={publishes} setPublishes={setPublishes}
          initialContentId={shareContentId} notify={toast.show} onAskAdvice={() => setTab("advice")} />
      )}
      {tab === "sales" && <ProductSales productId={product.id} publishes={publishes} notify={toast.show} />}
      {tab === "advice" && (
        <ProductAdvice product={product} notify={toast.show}
          onSuggestion={(suggestion) => setProduct({ ...product, suggestion })}
          onUse={(next) => { setDraft(next); setTab("contents"); }} />
      )}
      {tab === "info" && (
        <div style={{ maxWidth: 760 }}>
          <ProductForm key={product.updatedAt} shopId={shopId} initial={product} notify={toast.show}
            onSaved={(saved) => setProduct({ ...saved, shopName: saved.shopName ?? product.shopName })}
            onDeleted={() => router.push(shopHref)} />
        </div>
      )}
      {toast.node}
    </div>
  );
}
