// Client for the Marketplace menu (/api/v1/marketplace). Manual phase: nothing here talks to
// TikTok Shop, Shopee or Lazada; posts and sales are logged by the user.

import { parseEnvelope, type ParsedResponse } from "./api-envelope.ts";
export type Platform = "tiktok_shop" | "shopee" | "lazada";
export type ShopStatus = "active" | "inactive";
export type ProductStatus = "active" | "draft" | "archived";
export type ContentKind = "promo_video" | "short_film";
export type ContentRefType = "" | "director_series" | "film_series";

export const PLATFORMS: Platform[] = ["tiktok_shop", "shopee", "lazada"];
export const PLATFORM_LABEL: Record<Platform, string> = { tiktok_shop: "TikTok Shop", shopee: "Shopee", lazada: "Lazada" };
export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = { active: "วางขาย", draft: "ฉบับร่าง", archived: "เลิกขาย" };
export const CONTENT_KIND_LABEL: Record<ContentKind, string> = { promo_video: "วิดีโอโปรโมท", short_film: "หนังสั้นโปรโมท" };

export interface TrendItem { name: string; category: string; why: string; contentIdea: string }
export interface Trends { items: TrendItem[]; generatedAt: string }

export interface Shop {
  id: string; name: string; description: string; category: string;
  logoUploadId: string | null; logoUrl: string | null;
  phone: string; email: string; lineId: string; website: string; address: string;
  brandTone: string; targetAudience: string;
  tiktokShopUrl: string; shopeeUrl: string; lazadaUrl: string;
  status: ShopStatus; productCount: number; trends: Trends | null;
  createdAt: string; updatedAt: string;
}

export interface ShopBody {
  name: string; description: string; category: string; logoUploadId: string | null;
  phone: string; email: string; lineId: string; website: string; address: string;
  brandTone: string; targetAudience: string;
  tiktokShopUrl: string; shopeeUrl: string; lazadaUrl: string; status: ShopStatus;
}

export interface ProductImage { id: string; url: string }
export interface AdAngle { format: string; fit: ContentKind; title: string; why: string; hook: string; outline: string[] }
export interface Suggestion {
  similarProducts: string[]; angles: AdAngle[];
  captions: { platform: Platform; caption: string }[]; hashtags: string[]; generatedAt: string;
}

export interface Product {
  id: string; shopId: string; shopName?: string; name: string; description: string; sellingPoints: string;
  category: string; sku: string; price: number; stock: number; status: ProductStatus; images: ProductImage[];
  tiktokShopUrl: string; shopeeUrl: string; lazadaUrl: string;
  recentUnits: number; recentRevenue: number; contentCount: number;
  suggestion: Suggestion | null; createdAt: string; updatedAt: string;
}

export interface ProductBody {
  name: string; description: string; sellingPoints: string; category: string; sku: string;
  price: number; stock: number; status: ProductStatus; imageUploadIds: string[];
  tiktokShopUrl: string; shopeeUrl: string; lazadaUrl: string;
}

export interface Content { id: string; productId: string; kind: ContentKind; title: string; brief: string; refType: ContentRefType; refId: string | null; createdAt: string }
export interface ContentBody { kind: ContentKind; title: string; brief: string; refType?: ContentRefType; refId?: string }

export interface Publish { id: string; productId: string; contentId: string | null; platform: Platform; caption: string; postUrl: string; postedOn: string; createdAt: string }
export interface PublishBody { contentId?: string; platform: Platform; caption: string; postUrl: string; postedOn: string }

export interface SaleRow { id: string; platform: Platform; date: string; units: number; orders: number; revenue: number }
export interface SaleInput { platform: Platform; date: string; units: number; orders: number; revenue: number }
export interface SalesTotal { platform?: Platform; units: number; orders: number; revenue: number }
export interface Sales { days: number; from: string; to: string; total: SalesTotal; byPlatform: SalesTotal[]; rows: SaleRow[] }

export interface Page<T> { items: T[]; total: number; page: number; limit: number }

export class MarketplaceApiError extends Error {
  constructor(message: string, readonly status: number, readonly code: string) { super(message); }
}

const MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: "ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบแล้วลองใหม่",
  NOT_FOUND: "ไม่พบรายการนี้ อาจถูกลบไปแล้ว",
  UNAUTHORIZED: "กรุณาเข้าสู่ระบบเพื่อดำเนินการต่อ",
  INVALID_FILE_TYPE: "ไฟล์ต้องเป็นรูปภาพ (JPG, PNG หรือ WebP)",
  FILE_TOO_LARGE: "ไฟล์รูปใหญ่เกินกำหนด",
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    const headers = init?.body instanceof FormData ? init.headers : { "Content-Type": "application/json", ...init?.headers };
    res = await fetch(`/api/proxy/${path}`, { cache: "no-store", ...init, headers });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new MarketplaceApiError("การเชื่อมต่อขาดหาย กรุณาลองใหม่", 0, "NETWORK_ERROR");
  }
  if (res.status === 204) return undefined as T;
  let body: ParsedResponse | null = null;
  try { body = parseEnvelope(await res.json()); } catch { /* handled below */ }
  if (!res.ok || !body) {
    const code = body?.errorCode ?? "REQUEST_FAILED";
    // Marketplace-specific server messages are already Thai; generic ones are English.
    const message = MESSAGES[code] ?? (body?.message && /[฀-๿]/.test(body.message) ? body.message : "ทำรายการไม่สำเร็จ กรุณาลองใหม่");
    throw new MarketplaceApiError(message, res.status, code);
  }
  return body.data as T;
}

const id = encodeURIComponent;
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });
const listQuery = (q: { q?: string; status?: string; page?: number; limit?: number }) => {
  const p = new URLSearchParams();
  if (q.q?.trim()) p.set("q", q.q.trim());
  if (q.status) p.set("status", q.status);
  p.set("page", String(q.page ?? 1));
  p.set("limit", String(q.limit ?? 24));
  return p.toString();
};

export const marketplaceApi = {
  shops: (q: { q?: string; page?: number }, signal?: AbortSignal) => call<Page<Shop>>(`marketplace/shops?${listQuery(q)}`, { signal }),
  shop: (shopId: string, signal?: AbortSignal) => call<Shop>(`marketplace/shops/${id(shopId)}`, { signal }),
  createShop: (body: ShopBody) => call<Shop>("marketplace/shops", json("POST", body)),
  updateShop: (shopId: string, body: ShopBody) => call<Shop>(`marketplace/shops/${id(shopId)}`, json("PUT", body)),
  removeShop: (shopId: string) => call<void>(`marketplace/shops/${id(shopId)}`, { method: "DELETE" }),
  suggestTrends: (shopId: string) => call<Trends>(`marketplace/shops/${id(shopId)}/trends`, { method: "POST" }),

  products: (shopId: string, q: { q?: string; status?: ProductStatus | ""; page?: number }, signal?: AbortSignal) =>
    call<Page<Product>>(`marketplace/shops/${id(shopId)}/products?${listQuery(q)}`, { signal }),
  product: (productId: string, signal?: AbortSignal) => call<Product>(`marketplace/products/${id(productId)}`, { signal }),
  createProduct: (shopId: string, body: ProductBody) => call<Product>(`marketplace/shops/${id(shopId)}/products`, json("POST", body)),
  updateProduct: (productId: string, body: ProductBody) => call<Product>(`marketplace/products/${id(productId)}`, json("PUT", body)),
  removeProduct: (productId: string) => call<void>(`marketplace/products/${id(productId)}`, { method: "DELETE" }),
  suggest: (productId: string) => call<Suggestion>(`marketplace/products/${id(productId)}/suggestions`, { method: "POST" }),

  contents: async (productId: string, signal?: AbortSignal) => (await call<{ items: Content[] }>(`marketplace/products/${id(productId)}/contents`, { signal })).items,
  createContent: (productId: string, body: ContentBody) => call<Content>(`marketplace/products/${id(productId)}/contents`, json("POST", body)),
  removeContent: (contentId: string) => call<void>(`marketplace/contents/${id(contentId)}`, { method: "DELETE" }),

  publishes: async (productId: string, signal?: AbortSignal) => (await call<{ items: Publish[] }>(`marketplace/products/${id(productId)}/publishes`, { signal })).items,
  createPublish: (productId: string, body: PublishBody) => call<Publish>(`marketplace/products/${id(productId)}/publishes`, json("POST", body)),
  removePublish: (publishId: string) => call<void>(`marketplace/publishes/${id(publishId)}`, { method: "DELETE" }),

  sales: (productId: string, days: number, signal?: AbortSignal) => call<Sales>(`marketplace/products/${id(productId)}/sales?days=${days}`, { signal }),
  saveSales: (productId: string, rows: SaleInput[]) => call<void>(`marketplace/products/${id(productId)}/sales`, json("POST", { rows })),
  removeSale: (saleId: string) => call<void>(`marketplace/sales/${id(saleId)}`, { method: "DELETE" }),

  uploadImage: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return (await call<{ uploadId: string }>("uploads", { method: "POST", body: form })).uploadId;
  },
};

export const failText = (e: unknown) => e instanceof MarketplaceApiError ? e.message : "ทำรายการไม่สำเร็จ กรุณาลองใหม่";
export const baht = (n: number) => `฿${n.toLocaleString("th-TH", { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;
export const thaiDate = (iso: string) => new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit" });
/** Today's calendar date in Thailand, the zone the API uses for sales days. */
export const todayISO = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date());
/** Only http(s) links are ever rendered as hrefs. */
export const safeLink = (url: string) => (/^https?:\/\//i.test(url) ? url : undefined);

/**
 * Parses a sales CSV with a header row. Required columns: date (YYYY-MM-DD), platform, units;
 * optional: orders, revenue. Platform accepts tiktok_shop/shopee/lazada or their display names.
 */
export function parseSalesCsv(text: string): { rows: SaleInput[]; errors: string[] } {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const errors: string[] = [];
  if (lines.length < 2) return { rows: [], errors: ["ไฟล์ต้องมีแถวหัวตารางและข้อมูลอย่างน้อย 1 แถว"] };
  const cells = (line: string) => line.split(",").map((c) => c.trim().replace(/^"(.*)"$/, "$1"));
  const head = cells(lines[0]).map((h) => h.toLowerCase());
  const col = (name: string) => head.indexOf(name);
  const [d, p, u, o, r] = [col("date"), col("platform"), col("units"), col("orders"), col("revenue")];
  if (d < 0 || p < 0 || u < 0) return { rows: [], errors: ["หัวตารางต้องมีคอลัมน์ date, platform, units (orders และ revenue ใส่หรือไม่ก็ได้)"] };
  const platformOf = (raw: string): Platform | undefined => {
    const key = raw.toLowerCase().replace(/[\s_-]/g, "");
    return key === "tiktokshop" || key === "tiktok" ? "tiktok_shop" : key === "shopee" ? "shopee" : key === "lazada" ? "lazada" : undefined;
  };
  const rows: SaleInput[] = [];
  lines.slice(1).forEach((line, i) => {
    const c = cells(line);
    const platform = platformOf(c[p] ?? "");
    const num = (index: number) => (index < 0 || !c[index] ? 0 : Number(c[index]));
    const [units, orders, revenue] = [num(u), num(o), num(r)];
    const bad = !/^\d{4}-\d{2}-\d{2}$/.test(c[d] ?? "") || !platform || !Number.isInteger(units) || !Number.isInteger(orders) || !Number.isFinite(revenue) || units < 0 || orders < 0 || revenue < 0;
    if (bad || !platform) { errors.push(`แถวที่ ${i + 2} ข้อมูลไม่ถูกต้อง`); return; }
    rows.push({ platform, date: c[d], units, orders, revenue });
  });
  if (rows.length > 400) errors.push("นำเข้าได้ครั้งละไม่เกิน 400 แถว");
  return { rows, errors };
}
