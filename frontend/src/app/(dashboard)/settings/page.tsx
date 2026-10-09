import { SettingsDialog } from "@/features/settings/components/settings-dialog"

export const metadata = { title: "Settings" }

// Settings is a full page in the dashboard shell, never a modal: your own
// Profile (picture), Account (password) and Sessions, one tab each. See SettingsView.
//
// Next.js 16: searchParams is async — must be awaited, no synchronous access.
export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  return <SettingsDialog initialTab={tab === "sessions" || tab === "account" ? tab : "profile"} />
}
