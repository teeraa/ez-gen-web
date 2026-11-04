"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, Film, ArrowLeft } from "lucide-react";
import {
  productionApi,
  type ProjectDetail,
  type ProductionScene,
  type VideoCapabilities,
} from "@/lib/production-api";
import { SceneEditor } from "./scene-editor";
import { AssemblyEditor } from "./assembly-editor";
import s from "./production.module.css";
export function ProductionWorkspace({ projectId }: { projectId: string }) {
  const params = useSearchParams();
  const [importedAsset, setImportedAsset] = useState(params.get("asset"));
  const consumeImportedAsset = useCallback(() => {
    setImportedAsset(null);
  }, []);
  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [caps, setCaps] = useState<VideoCapabilities | null>(null);
  const [selected, setSelected] = useState("");
  const [tab, setTab] = useState("scenes");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState("");
  const [adding, setAdding] = useState(false);
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    const p = await productionApi.project(projectId);
    setProject(p);
    setSelected((old) =>
      p.scenes.some((x) => x.id === old) ? old : (p.scenes[0]?.id ?? ""),
    );
    return p;
  }, [projectId]);
  useEffect(() => {
    let active = true;
    Promise.all([
      productionApi.project(projectId),
      productionApi.capabilities(),
    ])
      .then(([p, c]) => {
        if (active) {
          setProject(p);
          setTitle(p.title);
          setCaps(c);
          setSelected(p.scenes[0]?.id ?? "");
        }
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [projectId]);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }
  function updateScene(scene: ProductionScene) {
    setProject((p) =>
      p
        ? { ...p, scenes: p.scenes.map((x) => (x.id === scene.id ? scene : x)) }
        : p,
    );
  }
  async function order(index: number, delta: number) {
    if (!project) return;
    const ids = project.scenes.map((x) => x.id);
    [ids[index], ids[index + delta]] = [ids[index + delta], ids[index]];
    await productionApi.order(project.id, ids);
    await reload();
  }
  const scene = project?.scenes.find((x) => x.id === selected);
  if (loading) return <p role="status">กำลังเปิดพื้นที่สร้างวิดีโอ…</p>;
  if (!project || !caps)
    return (
      <section className={s.shell}>
        <p className={s.error} role="alert">
          {error || "ไม่พบโปรเจกต์"}
        </p>
        <Link className={s.button} href="/studio/projects">
          กลับไปโปรเจกต์
        </Link>
      </section>
    );
  return (
    <section className={s.shell}>
      <header className={s.header}>
        <div className={s.stack}>
          <Link href="/studio/projects" className={s.row}>
            <ArrowLeft size={16} />
            โปรเจกต์วิดีโอ
          </Link>
          <label className={s.field}>
            <span className={s.muted}>ชื่อโปรเจกต์</span>
            <input
              className={s.titleInput}
              aria-label="ชื่อโปรเจกต์"
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
          <p className={s.muted}>
            {project.scenes.length} ฉาก · เลือกคลิปแล้ว{" "}
            {project.scenes.filter((x) => x.selectedJobId).length} ฉาก ·
            การสร้างคลิปแต่ละฉากไม่เปลี่ยนฉากอื่น
          </p>
        </div>
        {title !== project.title && (
          <button
            className={s.button}
            disabled={busy || !title.trim()}
            onClick={() =>
              action(async () => {
                await productionApi.update(project.id, {
                  revision: project.revision,
                  title: title.trim(),
                });
                await reload();
              })
            }
          >
            บันทึกชื่อ
          </button>
        )}
      </header>
      {caps.connectionMode === "fixture" && (
        <p className={s.notice}>
          โหมดทดสอบ — คลิปจำลอง ไม่ได้สร้างด้วย AI และไม่ใช้เครดิต
        </p>
      )}
      {error && (
        <p className={s.error} role="alert">
          {error}
        </p>
      )}
      <nav aria-label="ขั้นตอนสร้างวิดีโอ" className={s.tabs}>
        <button
          className={s.tab}
          aria-current={tab === "scenes"}
          onClick={() => setTab("scenes")}
        >
          1 · ฉากและคลิป
        </button>
        <button
          className={s.tab}
          aria-current={tab === "edit"}
          disabled={busy}
          onClick={() =>
            action(async () => {
              await reload();
              setTab("edit");
            })
          }
        >
          2 · ตัดต่อและส่งออก
        </button>
      </nav>
      {tab === "scenes" ? (
        <div className={s.workspace}>
          <aside className={s.stack}>
            <div className={s.rail} aria-label="ฉากในโปรเจกต์">
              {project.scenes.map((x, i) => (
                <div key={x.id}>
                  <button
                    className={s.scene}
                    aria-current={selected === x.id}
                    onClick={() => setSelected(x.id)}
                  >
                    <span className={s.muted}>ฉาก {i + 1}</span>
                    <strong>{x.title}</strong>
                    <span className={s.badge}>
                      {x.selectedJobId ? "เลือกคลิปแล้ว" : "ยังไม่ได้เลือกคลิป"}
                    </span>
                  </button>
                  <div className={s.row}>
                    <button
                      className={s.button}
                      disabled={busy || i === 0}
                      aria-label={`เลื่อนฉาก ${i + 1} ขึ้น`}
                      onClick={() => action(() => order(i, -1))}
                    >
                      ↑
                    </button>
                    <button
                      className={s.button}
                      disabled={busy || i === project.scenes.length - 1}
                      aria-label={`เลื่อนฉาก ${i + 1} ลง`}
                      onClick={() => action(() => order(i, 1))}
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              className={s.button}
              disabled={busy || project.scenes.length >= 100}
              onClick={() => setAdding(true)}
            >
              <Plus size={18} />
              เพิ่มฉาก
            </button>
          </aside>
          <main className={s.stack}>
            {adding && (
              <form
                className={`${s.panel} ${s.stack}`}
                onSubmit={(e) => {
                  e.preventDefault();
                  action(async () => {
                    const x = await productionApi.addScene(project.id, {
                      description: description.trim(),
                    });
                    await reload();
                    setSelected(x.id);
                    setDescription("");
                    setAdding(false);
                  });
                }}
              >
                <label className={s.field}>
                  ฉากถัดไปเกิดอะไรขึ้น?
                  <textarea
                    autoFocus
                    required
                    maxLength={2000}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </label>
                <div className={s.row}>
                  <button
                    className={s.primary}
                    disabled={busy || !description.trim()}
                  >
                    เพิ่มฉาก
                  </button>
                  <button
                    type="button"
                    className={s.button}
                    onClick={() => setAdding(false)}
                  >
                    ยกเลิก
                  </button>
                </div>
              </form>
            )}
            {scene ? (
              <>
                <SceneEditor
                  key={scene.id}
                  scene={scene}
                  caps={caps}
                  onChange={updateScene}
                  onInitialAssetConsumed={consumeImportedAsset}
                  initialAsset={
                    project.scenes[0]?.id === scene.id
                      ? importedAsset
                      : null
                  }
                />
                <div className={s.row}>
                  <button
                    className={s.button}
                    disabled={busy}
                    onClick={() =>
                      action(async () => {
                        const x = await productionApi.duplicate(scene.id);
                        await reload();
                        setSelected(x.id);
                      })
                    }
                  >
                    ทำสำเนาฉาก
                  </button>
                  <button
                    className={s.button}
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          `ลบ “${scene.title}” ออกจากโปรเจกต์? คลิปต้นฉบับยังคงอยู่ในประวัติ`,
                        )
                      )
                        action(async () => {
                          await productionApi.deleteScene(scene.id);
                          await reload();
                        });
                    }}
                  >
                    ลบฉาก
                  </button>
                  <button
                    className={s.primary}
                    onClick={() =>
                      action(async () => {
                        await reload();
                        setTab("edit");
                      })
                    }
                  >
                    ไปตัดต่อและส่งออก
                  </button>
                </div>
              </>
            ) : (
              <div className={`${s.panel} ${s.empty}`}>
                <Film />
                <h2>เริ่มจากฉากแรกของคุณ</h2>
                <button className={s.primary} onClick={() => setAdding(true)}>
                  เพิ่มฉากแรก
                </button>
              </div>
            )}
          </main>
        </div>
      ) : (
        <AssemblyEditor
          project={project}
          caps={caps}
          onSaved={async () => {
            await reload();
          }}
        />
      )}
    </section>
  );
}
