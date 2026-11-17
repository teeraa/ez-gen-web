import { AiUsageView } from "@/components/ai-usage/ai-usage-view";

// Hidden page: not linked from the navigation. The studio layout already requires a session.
export const metadata = { title: "การใช้ token ของ AI · AGENT STUDIO", robots: { index: false, follow: false } };

export default function AiUsagePage() {
  return <AiUsageView />;
}
