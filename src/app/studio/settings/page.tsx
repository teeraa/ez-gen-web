import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { getPointsBalance } from "@/lib/points";
import { SettingsView } from "@/components/settings/settings-view";

// Reads the session cookie, so it must stream behind Suspense under Cache Components.
async function SettingsContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/api/auth/expired");
  const balance = await getPointsBalance(user);
  return <SettingsView user={{ name: user.name, email: user.email, plan: user.plan, role: user.role }} balance={balance} />;
}

export default function Settings() {
  return (
    <Suspense fallback={<p role="status" style={{ padding: 24 }}>กำลังโหลดการตั้งค่า…</p>}>
      <SettingsContent />
    </Suspense>
  );
}
