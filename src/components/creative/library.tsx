"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, ArrowUpRight, Trash2, UserRound, Pencil, Images, Film, Package, LayoutGrid, List, Maximize2, Plus } from "lucide-react";
import { creativeApi, type Asset } from "@/lib/creative-api";
import w from "@/components/workbench/workbench.module.css";
import { WorkbenchHead } from "@/components/workbench/workbench-ui";
import c from "./collection.module.css";

type AssetType = "character" | "prop" | "video";
const TYPES: { value: AssetType; label: string; icon: typeof UserRound }[] = [
  { value: "character", label: "ตัวละคร", icon: UserRound },
  { value: "video", label: "วิดีโอ", icon: Film },
  { value: "prop", label: "สินค้า/พร็อพ", icon: Package },
];
const typeLabel = (type: string) => type === "video" ? "วิดีโอ" : type === "prop" ? "สินค้า/พร็อพ" : "ตัวละคร";

export function AssetLibrary() {
  const [assetType, setAssetType] = useState<AssetType>("character");
  const subject = assetType === "video" ? "วิดีโอ" : assetType === "prop" ? "สินค้า/พร็อพ" : "ตัวละคร";
  const [reload, setReload] = useState(0);
  useEffect(() => { const type = new URLSearchParams(window.location.search).get("type"); if (type === "video" || type === "prop" || type === "character") setAssetType(type); }, []);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Asset | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [mediaErrors, setMediaErrors] = useState<Record<string, string>>({});
  const [refreshingMedia, setRefreshingMedia] = useState<Record<string, boolean>>({});
  const [mediaVersions, setMediaVersions] = useState<Record<string, number>>({});
  const [view, setView] = useState<"grid" | "list">("grid");

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      creativeApi
        .assets(search, assetType, page)
        .then((data) => {
          if (active) {
            setAssets(data.items);
            setTotal(data.total);
            setError("");
          }
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [search, page, assetType, reload]);

  useEffect(() => {
    if (!editing) return;
    const close = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) setEditing(null); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [editing, busy]);

  async function refreshVideo(asset: Asset) {
    if (refreshingMedia[asset.id]) return;
    setRefreshingMedia((current) => ({ ...current, [asset.id]: true }));
    try {
      const updated = await creativeApi.asset(asset.id);
      if (!updated.mediaUrl) throw new Error("Missing media URL");
      setAssets((items) => items.map((item) => item.id === asset.id ? updated : item));
      setMediaVersions((current) => ({ ...current, [asset.id]: (current[asset.id] ?? 0) + 1 }));
    } catch {
      setMediaErrors((current) => ({ ...current, [asset.id]: "โหลดลิงก์วิดีโอใหม่ไม่สำเร็จ กรุณาลองอีกครั้ง" }));
    } finally {
      setRefreshingMedia((current) => ({ ...current, [asset.id]: false }));
    }
  }

  function clearMediaError(id: string) {
    setMediaErrors((current) => {
      if (!current[id]) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  async function remove(asset: Asset) {
    if (
      !window.confirm(
        `นำ “${asset.name}” ออกจากคลังหรือไม่? ภาพต้นฉบับยังอยู่ในประวัติการสร้าง`,
      )
    )
      return;
    setDeleting(asset.id);
    setError("");
    try {
      await creativeApi.deleteAsset(asset.id);
      setAssets((items) => items.filter((a) => a.id !== asset.id));
      setTotal((value) => value - 1);
      if (assets.length === 1 && page > 1) setPage(page - 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ลบผลงานไม่สำเร็จ");
    } finally {
      setDeleting(null);
    }
  }

  async function update() {
    if (!editing) return;
    setBusy(true);
    setError("");
    try {
      const result = await creativeApi.editAsset(editing.id, {
        name: editing.name.trim(),
        description: editing.description,
      });
      setAssets((items) =>
        items.map((asset) => (asset.id === result.id ? result : asset)),
      );
      setEditing(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : `แก้ไข${subject}ไม่สำเร็จ`);
    } finally {
      setBusy(false);
    }
  }

  function switchType(value: AssetType) {
    if (value === assetType && page === 1 && search === "") return;
    setLoading(true);
    setAssetType(value);
    window.history.replaceState(null, "", `/studio/library?type=${value}`);
    setPage(1);
    setSearch("");
    setEditing(null);
    setError("");
  }

  const createHref = assetType === "video" ? "/studio" : `/studio/images?category=${assetType === "prop" ? "product" : "character"}`;
  const createLabel = assetType === "video" ? "สร้างวิดีโอ" : assetType === "prop" ? "สร้างภาพสินค้า" : "สร้างภาพตัวละคร";
  const pages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className={w.page}>
      <WorkbenchHead preview={false} icon={<Images aria-hidden />} title="คลังผลงาน"
        description={`${subject}ที่บันทึกไว้ในคลังส่วนตัว พร้อมนำไปใช้ในงานชิ้นต่อไป`}
        actions={<Link href={createHref} className={w.primary}><Plus aria-hidden />{createLabel}</Link>} />

      <div className={w.toolbar}>
        <div className={c.segment} role="group" aria-label="ประเภทผลงาน">
          {TYPES.map(({ value, label, icon: Icon }) => (
            <button key={value} type="button" aria-pressed={assetType === value} disabled={busy || deleting !== null} onClick={() => switchType(value)}>
              <Icon aria-hidden />{label}
            </button>
          ))}
        </div>
        <label className={w.search}>
          <Search aria-hidden />
          <span className={c.sr}>ค้นหา{subject}</span>
          <input
            value={search}
            maxLength={200}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder={`ค้นหา${subject}…`}
          />
        </label>
        <span className={c.spacer} />
        {!loading && !error && <span className={c.count} aria-hidden>{total} รายการ</span>}
        <div className={c.viewToggle} role="group" aria-label="มุมมอง">
          <button type="button" aria-pressed={view === "grid"} aria-label="มุมมองตาราง" onClick={() => setView("grid")}><LayoutGrid aria-hidden /></button>
          <button type="button" aria-pressed={view === "list"} aria-label="มุมมองรายการ" onClick={() => setView("list")}><List aria-hidden /></button>
        </div>
      </div>

      {error && (
        <p className={c.alert} role="alert">
          {error} <button type="button" className={w.secondary} onClick={() => setReload(value => value + 1)}>ลองใหม่</button>
        </p>
      )}

      {loading ? (
        <div className={`${c.gallery} ${view === "list" ? c.galleryList : ""}`} role="status" aria-busy="true">
          <span className={c.sr}>กำลังโหลดคลังผลงาน…</span>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className={c.tile} aria-hidden>
              <div className={`${c.media} ${assetType === "video" ? c.mediaVideo : ""} ${c.skeleton}`} style={{ borderRadius: 0 }} />
              <div className={c.body}>
                <div className={`${c.skeleton} ${c.skelLine}`} style={{ width: "60%" }} />
                <div className={`${c.skeleton} ${c.skelLine}`} style={{ width: "90%" }} />
                <div className={`${c.skeleton} ${c.skelLine}`} style={{ width: "40%" }} />
              </div>
            </div>
          ))}
        </div>
      ) : error ? null : assets.length ? (
        <div className={`${c.gallery} ${view === "list" ? c.galleryList : ""}`}>
          {assets.map((asset) => (
            <article key={asset.id} className={c.tile}>
              <div className={`${c.media} ${asset.assetType === "video" ? c.mediaVideo : ""}`}>
                {asset.assetType === "video" && asset.mediaUrl ? (
                  <video
                    key={`${asset.id}:${mediaVersions[asset.id] ?? 0}`}
                    controls aria-label={asset.name} src={asset.mediaUrl}
                    onError={() => setMediaErrors((current) => ({ ...current, [asset.id]: "โหลดวิดีโอไม่สำเร็จ ลิงก์อาจหมดอายุ กรุณาโหลดลิงก์ใหม่" }))}
                    onLoadedData={() => clearMediaError(asset.id)}
                  />
                ) : asset.mediaUrl ? (
                  <a href={asset.mediaUrl} target="_blank" rel="noreferrer">
                    <Image unoptimized width={500} height={500} src={asset.mediaUrl} alt={asset.description || asset.name} />
                  </a>
                ) : (
                  <div className={c.noMedia}>
                    {asset.assetType === "prop" ? <Package aria-hidden /> : <UserRound aria-hidden />}
                    <span>ข้อมูล{subject} · ยังไม่มีภาพ</span>
                  </div>
                )}
                <span className={c.typeBadge}>{typeLabel(asset.assetType)}</span>
                <div className={c.overlay}>
                  {asset.mediaUrl && asset.assetType !== "video" && (
                    <a href={asset.mediaUrl} target="_blank" rel="noreferrer" aria-label={`เปิดภาพขนาดเต็ม ${asset.name}`}><Maximize2 aria-hidden /></a>
                  )}
                  <button type="button" onClick={() => setEditing(asset)} aria-label={`แก้ไข ${asset.name}`}><Pencil aria-hidden /></button>
                  <button type="button" disabled={deleting === asset.id} onClick={() => remove(asset)} aria-label={`ลบ ${asset.name}`}><Trash2 aria-hidden /></button>
                </div>
              </div>
              {asset.assetType === "video" && mediaErrors[asset.id] && (
                <div className={c.mediaError} role="alert">
                  <p>{mediaErrors[asset.id]}</p>
                  <button type="button" className={w.secondary}
                    disabled={refreshingMedia[asset.id]}
                    aria-label={`โหลดลิงก์วิดีโอใหม่ ${asset.name}`}
                    onClick={() => void refreshVideo(asset)}>
                    {refreshingMedia[asset.id] ? "กำลังโหลดลิงก์ใหม่…" : "โหลดลิงก์วิดีโอใหม่"}
                  </button>
                </div>
              )}
              <div className={c.body}>
                <h2 title={asset.name}>{asset.name}</h2>
                {asset.description && <p>{asset.description}</p>}
                <div className={c.foot}>
                  <span>{new Date(asset.createdAt).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })} · ส่วนตัว</span>
                  {asset.assetType === "character" && <Link href={`/studio/projects?asset=${encodeURIComponent(asset.id)}`} className={c.use}>ใช้สร้างวิดีโอ <ArrowUpRight aria-hidden /></Link>}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={c.emptyBox}>
          {assetType === "video" ? <Film aria-hidden /> : assetType === "prop" ? <Package aria-hidden /> : <UserRound aria-hidden />}
          <h2>
            {search
              ? `ไม่พบ${subject}ที่ค้นหา`
              : `พื้นที่สำหรับ${subject}ชิ้นต่อไปของคุณ`}
          </h2>
          <p>
            {search
              ? "ลองค้นหาด้วยคำอื่น"
              : assetType === "video" ? "สร้างวิดีโอแล้วบันทึกไว้ที่นี่ เพื่อกลับมาใช้ซ้ำได้ทุกเมื่อ" : `สร้างภาพ ตั้งชื่อ แล้วบันทึกเพื่อเริ่มคลัง${subject}ของคุณ`}
          </p>
          <Link className={w.primary} href={createHref}>
            {assetType === "video" ? "สร้างวิดีโอแรก" : "สร้างภาพแรก"} <ArrowUpRight aria-hidden />
          </Link>
        </div>
      )}

      {!loading && !error && total > 20 && (
        <nav className={c.pager} aria-label="เปลี่ยนหน้า">
          <button className={w.secondary} disabled={page === 1} onClick={() => setPage(page - 1)}>ก่อนหน้า</button>
          <span>หน้า {page} / {pages} · {total} {subject}</span>
          <button className={w.secondary} disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>ถัดไป</button>
        </nav>
      )}

      {editing && (
        <div className={c.scrim} onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setEditing(null); }}>
          <form className={c.dialog} role="dialog" aria-modal="true" aria-labelledby="edit-asset-title"
            onSubmit={(e) => { e.preventDefault(); update(); }}>
            <h2 id="edit-asset-title">แก้ไข{editing.assetType === "prop" ? "สินค้า/พร็อพ" : editing.assetType === "video" ? "วิดีโอ" : "ตัวละคร"}</h2>
            <label className={w.field} htmlFor="edit-name">
              ชื่อ
              <input autoFocus id="edit-name" required maxLength={100} value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </label>
            <label className={w.field} htmlFor="edit-description">
              คำอธิบาย
              <textarea id="edit-description" maxLength={2000} value={editing.description} style={{ minHeight: 96 }}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })} />
            </label>
            <div className={c.dialogActions}>
              <button className={w.secondary} type="button" onClick={() => setEditing(null)}>ยกเลิก</button>
              <button className={w.primary} disabled={busy || !editing.name.trim()}>บันทึกการแก้ไข</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
