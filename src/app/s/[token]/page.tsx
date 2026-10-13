import type { Metadata } from "next"
import { Suspense } from "react"
import Link from "next/link"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { Download, Sparkles } from "lucide-react"
import { getPublicShare, videoSize } from "@/lib/public-share"

const TITLE = "สร้างด้วย VIOLET STUDIO"
const DESCRIPTION = "วิดีโอ AI ระดับภาพยนตร์จาก EZ-Gen Studio — สร้างวิดีโอของคุณเองได้ฟรี"
// Permanent brand image: thumbnails are signed for 1h but LINE/Facebook cache previews much longer.
const FALLBACK_IMAGE = "/og-share.png"

async function siteOrigin(): Promise<string> {
  if (process.env.PUBLIC_WEB_BASE_URL) return process.env.PUBLIC_WEB_BASE_URL
  const h = await headers()
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? "localhost:3000"}`
}

export async function generateMetadata({ params }: PageProps<"/s/[token]">): Promise<Metadata> {
  const { token } = await params
  const share = await getPublicShare(token)
  if (!share) notFound()

  const origin = await siteOrigin()
  const pageUrl = `${origin}/s/${token}`
  const { width, height } = videoSize(share.aspectRatio)
  const image = share.thumbnailUrl ?? `${origin}${FALLBACK_IMAGE}`

  return {
    title: TITLE,
    description: DESCRIPTION,
    robots: { index: false, follow: false },
    openGraph: {
      type: "video.other",
      url: pageUrl,
      title: TITLE,
      description: DESCRIPTION,
      siteName: "EZ-Gen Studio",
      // Dimensions are only known for the brand fallback; a thumbnail's size isn't in the API.
      images: [share.thumbnailUrl ? { url: image } : { url: image, width: 1200, height: 630 }],
      videos: [{ url: share.mediaUrl, secureUrl: share.mediaUrl, type: "video/mp4", width, height }],
    },
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [image] },
  }
}

async function ShareContent({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const share = await getPublicShare(token)
  if (!share) notFound()
  const { width, height } = videoSize(share.aspectRatio)

  return (
    <div className="flex w-full flex-col items-center gap-5">
      <div
        className="preview-frame w-full max-w-[min(100%,calc(78svh*var(--ar)))] border border-[rgba(191,160,255,.15)] shadow-[0_25px_80px_rgba(0,0,0,.5)]"
        style={{ aspectRatio: `${width} / ${height}`, ["--ar" as string]: width / height }}
      >
        {share.mediaType === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={share.mediaUrl} alt={TITLE} className="size-full object-contain" />
        ) : (
          <video
            src={share.mediaUrl}
            poster={share.thumbnailUrl ?? undefined}
            controls
            playsInline
            preload="metadata"
            className="block size-full bg-black object-contain"
          />
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-2.5">
        <a href={share.downloadUrl} className="btn-secondary"><Download className="size-4" /> ดาวน์โหลด</a>
        <Link href="/signup" className="btn-primary"><Sparkles className="size-4" /> สร้างวิดีโอของคุณเอง</Link>
      </div>
    </div>
  )
}

export default function SharePage({ params }: PageProps<"/s/[token]">) {
  return (
    <main className="auth-shell">
      <div className="flex w-full max-w-[1100px] flex-col items-center gap-6">
        <Link className="brand m-0" href="/" aria-label="EZ-Gen Studio home">
          <span className="brand-symbol"><Sparkles strokeWidth={1.6} /></span>
          <span className="brand-name">EZ-GEN <span>STUDIO</span></span>
        </Link>
        <Suspense fallback={<div className="preview-frame aspect-video w-full max-w-3xl animate-pulse bg-white/[.03]" />}>
          <ShareContent params={params} />
        </Suspense>
        <p className="m-0 text-[11px] text-text-subtle">{TITLE}</p>
      </div>
    </main>
  )
}
