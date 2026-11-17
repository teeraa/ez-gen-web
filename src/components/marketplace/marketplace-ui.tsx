"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { ChevronRight, ExternalLink, ImagePlus, Loader2, Save, Trash2, X } from "lucide-react";
import { Dialog } from "@/components/ui";
import w from "@/components/workbench/workbench.module.css";
import m from "./marketplace.module.css";
import {
  PLATFORMS, PLATFORM_LABEL, PRODUCT_STATUS_LABEL, failText, marketplaceApi, safeLink,
  type Platform, type Product, type ProductBody, type ProductImage, type ProductStatus, type Shop, type ShopBody,
} from "@/lib/marketplace-api";

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const IMAGE_TYPES = "image/jpeg,image/png,image/webp";

export function Crumbs({ trail }: { trail: { label: string; href?: string }[] }) {
  return (
    <nav className={m.crumbs} aria-label="เส้นทาง">
      {trail.map((step, i) => (
        <span key={`${step.label}-${i}`} className={m.crumbs}>
          {i > 0 && <ChevronRight aria-hidden />}
          {step.href ? <Link href={step.href}>{step.label}</Link> : <span aria-current="page">{step.label}</span>}
        </span>
      ))}
    </nav>
  );
}

const CHANNEL_KEY: Record<Platform, "tiktokShopUrl" | "shopeeUrl" | "lazadaUrl"> = { tiktok_shop: "tiktokShopUrl", shopee: "shopeeUrl", lazada: "lazadaUrl" };
export const channelUrl = (source: Pick<Shop, "tiktokShopUrl" | "shopeeUrl" | "lazadaUrl">, platform: Platform) => safeLink(source[CHANNEL_KEY[platform]]);

/** Storefront/listing links the user typed in. A dashed chip means no link was given. */
export function Channels({ source, showMissing = false }: { source: Pick<Shop, "tiktokShopUrl" | "shopeeUrl" | "lazadaUrl">; showMissing?: boolean }) {
  const chips = PLATFORMS.map((platform) => ({ platform, href: channelUrl(source, platform) })).filter((c) => c.href || showMissing);
  if (chips.length === 0) return null;
  return (
    <div className={m.channels}>
      {chips.map(({ platform, href }) => href
        ? <a key={platform} className={m.channel} href={href} target="_blank" rel="noopener noreferrer">{PLATFORM_LABEL[platform]}<ExternalLink aria-hidden /></a>
        : <span key={platform} className={`${m.channel} ${m.channelOff}`}>{PLATFORM_LABEL[platform]} · ยังไม่ใส่ลิงก์</span>)}
    </div>
  );
}

/** Uploads pictures and reports the ordered list of upload ids; previews use the server URL or a local object URL. */
function ImagePicker({ images, max, onChange, onError, label }: { images: ProductImage[]; max: number; onChange: (next: ProductImage[]) => void; onError: (text: string) => void; label: string }) {
  const [uploading, setUploading] = useState(false);
  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    let next = images;
    try {
      for (const file of Array.from(files).slice(0, max - images.length)) {
        if (!IMAGE_TYPES.split(",").includes(file.type)) { onError("รองรับเฉพาะไฟล์ JPG, PNG หรือ WebP"); continue; }
        if (file.size > MAX_IMAGE_BYTES) { onError("ไฟล์รูปต้องไม่เกิน 10 MB"); continue; }
        const uploadId = await marketplaceApi.uploadImage(file);
        next = [...next, { id: uploadId, url: URL.createObjectURL(file) }];
        onChange(next);
      }
    } catch (e) {
      onError(failText(e));
    } finally {
      setUploading(false);
    }
  };
  return (
    <div className={m.shots}>
      {images.map((img) => (
        <div key={img.id} className={m.shot}>
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL or local preview; next/image would cache it past expiry */}
          <img src={img.url} alt="" />
          <button type="button" aria-label="ลบรูปนี้" onClick={() => onChange(images.filter((x) => x.id !== img.id))}><X aria-hidden /></button>
        </div>
      ))}
      {images.length < max && (
        <label className={m.shotAdd} aria-busy={uploading}>
          {uploading ? <Loader2 className={m.spin} aria-hidden /> : <ImagePlus aria-hidden />}
          <input type="file" accept={IMAGE_TYPES} multiple={max > 1} disabled={uploading} aria-label={label}
            onChange={(e) => { void add(e.target.files); e.target.value = ""; }} />
        </label>
      )}
    </div>
  );
}

/** Add/edit form: a modal when `onClose` is given, otherwise an inline panel (product page tab). */
function FormFrame({ title, onClose, onSubmit, children }: { title: string; onClose?: () => void; onSubmit: () => void; children: ReactNode }) {
  const submit = (e: React.FormEvent) => { e.preventDefault(); onSubmit(); };
  if (!onClose) return <form className={w.panel} aria-label={title} onSubmit={submit}><h2>{title}</h2>{children}</form>;
  return (
    <Dialog open onClose={onClose} title={title} size="lg">
      <form className={m.modalForm} onSubmit={submit}>{children}</form>
    </Dialog>
  );
}

function Text({ label, value, onChange, max, placeholder, type = "text", wide, hint }: { label: string; value: string; onChange: (v: string) => void; max: number; placeholder?: string; type?: string; wide?: boolean; hint?: ReactNode }) {
  return (
    <label className={`${w.field} ${wide ? m.wide : ""}`}>{label}
      <input type={type} value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {hint && <small>{hint}</small>}
    </label>
  );
}

function Area({ label, value, onChange, max, placeholder, hint }: { label: string; value: string; onChange: (v: string) => void; max: number; placeholder?: string; hint?: ReactNode }) {
  return (
    <label className={`${w.field} ${m.wide} ${m.short}`}><span className={w.fieldRow}>{label}<span className={w.counter}>{value.length}/{max}</span></span>
      <textarea value={value} maxLength={max} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {hint && <small>{hint}</small>}
    </label>
  );
}

function DeleteButton({ busy, label, onConfirm }: { busy: boolean; label: string; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  return (
    <button type="button" className={`${w.ghost} ${w.danger}`} disabled={busy} onBlur={() => setArmed(false)}
      onClick={() => { if (armed) onConfirm(); else setArmed(true); }}>
      <Trash2 aria-hidden />{armed ? "กดอีกครั้งเพื่อยืนยันการลบ" : label}
    </button>
  );
}

// ── Shop form ─────────────────────────────────────────────────────────────────

const emptyShop: ShopBody = {
  name: "", description: "", category: "", logoUploadId: null, phone: "", email: "", lineId: "", website: "", address: "",
  brandTone: "", targetAudience: "", tiktokShopUrl: "", shopeeUrl: "", lazadaUrl: "", status: "active",
};

export function ShopForm({ initial, onSaved, onDeleted, onClose, notify }: { initial?: Shop; onSaved: (shop: Shop) => void; onDeleted?: () => void; onClose: () => void; notify: (text: string) => void }) {
  const [form, setForm] = useState<ShopBody>(() => initial ? {
    name: initial.name, description: initial.description, category: initial.category, logoUploadId: initial.logoUploadId,
    phone: initial.phone, email: initial.email, lineId: initial.lineId, website: initial.website, address: initial.address,
    brandTone: initial.brandTone, targetAudience: initial.targetAudience,
    tiktokShopUrl: initial.tiktokShopUrl, shopeeUrl: initial.shopeeUrl, lazadaUrl: initial.lazadaUrl, status: initial.status,
  } : emptyShop);
  const [logo, setLogo] = useState<ProductImage[]>(() => initial?.logoUploadId && initial.logoUrl ? [{ id: initial.logoUploadId, url: initial.logoUrl }] : []);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof ShopBody>(key: K) => (value: ShopBody[K]) => setForm((f) => ({ ...f, [key]: value }));
  const valid = form.name.trim().length > 0;

  const submit = async () => {
    setBusy(true);
    try {
      const body = { ...form, logoUploadId: logo[0]?.id ?? null };
      const saved = initial ? await marketplaceApi.updateShop(initial.id, body) : await marketplaceApi.createShop(body);
      notify(initial ? "บันทึกข้อมูลร้านแล้ว" : "เพิ่มร้านค้าแล้ว");
      onSaved(saved);
    } catch (e) {
      notify(failText(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!initial) return;
    setBusy(true);
    try {
      await marketplaceApi.removeShop(initial.id);
      notify("ลบร้านค้าแล้ว");
      onDeleted?.();
    } catch (e) {
      notify(failText(e));
      setBusy(false);
    }
  };

  return (
    <FormFrame title={initial ? "แก้ไขร้านค้า" : "เพิ่มร้านค้า"} onClose={onClose} onSubmit={() => { if (valid && !busy) void submit(); }}>
      <div className={m.formGrid}>
        <div className={`${w.field} ${m.wide}`}>โลโก้ร้าน
          <ImagePicker images={logo} max={1} onChange={setLogo} onError={notify} label="อัปโหลดโลโก้ร้าน" />
        </div>
        <Text label="ชื่อร้าน *" value={form.name} onChange={set("name")} max={80} placeholder="เช่น Violet Beauty" wide />
        <Text label="หมวดหมู่ธุรกิจ" value={form.category} onChange={set("category")} max={60} placeholder="เช่น ความงาม, แฟชั่น, อาหาร" />
        <label className={w.field}>สถานะ
          <select value={form.status} onChange={(e) => set("status")(e.target.value === "inactive" ? "inactive" : "active")}>
            <option value="active">เปิดร้าน</option>
            <option value="inactive">ปิดชั่วคราว</option>
          </select>
        </label>
        <Area label="คำอธิบายร้าน" value={form.description} onChange={set("description")} max={1000} placeholder="ร้านขายอะไร จุดเด่นของร้านคืออะไร" />

        <p className={`${m.legend} ${m.wide}`}>ข้อมูลติดต่อ</p>
        <Text label="เบอร์โทร" value={form.phone} onChange={set("phone")} max={30} type="tel" />
        <Text label="อีเมล" value={form.email} onChange={set("email")} max={120} type="email" />
        <Text label="LINE ID" value={form.lineId} onChange={set("lineId")} max={60} />
        <Text label="เว็บไซต์" value={form.website} onChange={set("website")} max={500} placeholder="https://" />
        <Text label="ที่อยู่" value={form.address} onChange={set("address")} max={500} wide />

        <p className={`${m.legend} ${m.wide}`}>แบรนด์ (AI ใช้ประกอบคำแนะนำ)</p>
        <Area label="โทนแบรนด์" value={form.brandTone} onChange={set("brandTone")} max={300} placeholder="เช่น เป็นกันเอง สนุก พูดตรง" />
        <Area label="กลุ่มเป้าหมาย" value={form.targetAudience} onChange={set("targetAudience")} max={300} placeholder="เช่น ผู้หญิงวัยทำงาน 25-35 ปี ผิวแพ้ง่าย" />

        <p className={`${m.legend} ${m.wide}`}>ช่องทางขาย (ใส่ลิงก์หน้าร้าน ยังไม่เชื่อมบัญชี)</p>
        <Text label="TikTok Shop" value={form.tiktokShopUrl} onChange={set("tiktokShopUrl")} max={500} placeholder="https://" wide />
        <Text label="Shopee" value={form.shopeeUrl} onChange={set("shopeeUrl")} max={500} placeholder="https://" wide />
        <Text label="Lazada" value={form.lazadaUrl} onChange={set("lazadaUrl")} max={500} placeholder="https://" wide />
      </div>
      <button className={`${w.primary} ${w.block}`} disabled={!valid || busy}>
        {busy ? <Loader2 className={m.spin} aria-hidden /> : <Save aria-hidden />}{initial ? "บันทึกการแก้ไข" : "เพิ่มร้านค้า"}
      </button>
      {initial && onDeleted && <DeleteButton busy={busy} label="ลบร้านค้านี้ (สินค้าในร้านจะถูกลบด้วย)" onConfirm={() => void remove()} />}
    </FormFrame>
  );
}

// ── Product form ──────────────────────────────────────────────────────────────

type ProductDraft = Omit<ProductBody, "price" | "stock" | "imageUploadIds"> & { price: string; stock: string };

const emptyProduct: ProductDraft = {
  name: "", description: "", sellingPoints: "", category: "", sku: "", price: "", stock: "", status: "active",
  tiktokShopUrl: "", shopeeUrl: "", lazadaUrl: "",
};

export function ProductForm({ shopId, initial, onSaved, onDeleted, onClose, notify }: { shopId: string; initial?: Product; onSaved: (product: Product) => void; onDeleted?: () => void; onClose?: () => void; notify: (text: string) => void }) {
  const [form, setForm] = useState<ProductDraft>(() => initial ? {
    name: initial.name, description: initial.description, sellingPoints: initial.sellingPoints, category: initial.category, sku: initial.sku,
    price: String(initial.price), stock: String(initial.stock), status: initial.status,
    tiktokShopUrl: initial.tiktokShopUrl, shopeeUrl: initial.shopeeUrl, lazadaUrl: initial.lazadaUrl,
  } : emptyProduct);
  const [images, setImages] = useState<ProductImage[]>(initial?.images ?? []);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof ProductDraft>(key: K) => (value: ProductDraft[K]) => setForm((f) => ({ ...f, [key]: value }));
  const price = form.price.trim() === "" ? 0 : Number(form.price);
  const stock = form.stock.trim() === "" ? 0 : Number(form.stock);
  const valid = form.name.trim().length > 0 && Number.isFinite(price) && price >= 0 && Number.isInteger(stock) && stock >= 0;

  const submit = async () => {
    setBusy(true);
    try {
      const body: ProductBody = { ...form, price, stock, imageUploadIds: images.map((img) => img.id) };
      const saved = initial ? await marketplaceApi.updateProduct(initial.id, body) : await marketplaceApi.createProduct(shopId, body);
      notify(initial ? "บันทึกข้อมูลสินค้าแล้ว" : "เพิ่มสินค้าแล้ว");
      setImages(saved.images);
      onSaved(saved);
    } catch (e) {
      notify(failText(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!initial) return;
    setBusy(true);
    try {
      await marketplaceApi.removeProduct(initial.id);
      notify("ลบสินค้าแล้ว");
      onDeleted?.();
    } catch (e) {
      notify(failText(e));
      setBusy(false);
    }
  };

  const title = initial ? "ข้อมูลสินค้า" : "เพิ่มสินค้า";
  return (
    <FormFrame title={title} onClose={onClose} onSubmit={() => { if (valid && !busy) void submit(); }}>
      <div className={m.formGrid}>
        <div className={`${w.field} ${m.wide}`}>รูปสินค้า (สูงสุด 6 รูป รูปแรกเป็นรูปปก)
          <ImagePicker images={images} max={6} onChange={setImages} onError={notify} label="อัปโหลดรูปสินค้า" />
        </div>
        <Text label="ชื่อสินค้า *" value={form.name} onChange={set("name")} max={120} wide />
        <Text label="หมวดหมู่" value={form.category} onChange={set("category")} max={60} placeholder="เช่น สกินแคร์" />
        <Text label="รหัสสินค้า (SKU)" value={form.sku} onChange={set("sku")} max={60} />
        <label className={w.field}>ราคา (บาท)
          <input inputMode="decimal" value={form.price} placeholder="0" onChange={(e) => set("price")(e.target.value.replace(/[^\d.]/g, ""))} />
        </label>
        <label className={w.field}>สต็อก (ชิ้น)
          <input inputMode="numeric" value={form.stock} placeholder="0" onChange={(e) => set("stock")(e.target.value.replace(/\D/g, ""))} />
        </label>
        <label className={`${w.field} ${m.wide}`}>สถานะ
          <select value={form.status} onChange={(e) => set("status")(e.target.value as ProductStatus)}>
            {(Object.keys(PRODUCT_STATUS_LABEL) as ProductStatus[]).map((s) => <option key={s} value={s}>{PRODUCT_STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <Area label="รายละเอียดสินค้า" value={form.description} onChange={set("description")} max={2000} />
        <Area label="จุดขาย" value={form.sellingPoints} onChange={set("sellingPoints")} max={1000} placeholder="สิ่งที่ทำให้สินค้านี้ต่างจากเจ้าอื่น คั่นแต่ละข้อด้วยการขึ้นบรรทัดใหม่" hint="AI ใช้ข้อมูลนี้เขียนบรีฟ แคปชัน และแนะนำแนวโฆษณา" />

        <p className={`${m.legend} ${m.wide}`}>ลิงก์สินค้าบนแพลตฟอร์ม</p>
        <Text label="TikTok Shop" value={form.tiktokShopUrl} onChange={set("tiktokShopUrl")} max={500} placeholder="https://" wide />
        <Text label="Shopee" value={form.shopeeUrl} onChange={set("shopeeUrl")} max={500} placeholder="https://" wide />
        <Text label="Lazada" value={form.lazadaUrl} onChange={set("lazadaUrl")} max={500} placeholder="https://" wide />
      </div>
      <button className={`${w.primary} ${w.block}`} disabled={!valid || busy}>
        {busy ? <Loader2 className={m.spin} aria-hidden /> : <Save aria-hidden />}{initial ? "บันทึกการแก้ไข" : "เพิ่มสินค้า"}
      </button>
      {initial && onDeleted && <DeleteButton busy={busy} label="ลบสินค้านี้" onConfirm={() => void remove()} />}
    </FormFrame>
  );
}
