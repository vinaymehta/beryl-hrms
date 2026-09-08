"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "cn"
import { NAV_ITEMS } from "@/constants/nav"
import { usePermission } from "@/features/auth/hooks/use-permission"

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname()

  return (
    <nav className="flex flex-col gap-0.5 px-3">
      {NAV_ITEMS.map((item) => (
        <NavLink key={item.href} item={item} active={pathname === item.href} onNavigate={onNavigate} />
      ))}
    </nav>
  )
}

function NavLink({
  item,
  active,
  onNavigate,
}: {
  item: (typeof NAV_ITEMS)[number]
  active: boolean
  onNavigate?: () => void
}) {
  const allowed = usePermissionOrTrue(item.permission)
  if (!allowed) return null

  const Icon = item.icon

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-sm shadow-sidebar-primary/25"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className="size-4 shrink-0" />
      {item.label}
    </Link>
  )
}

// item.permission is undefined for items visible to every authenticated user.
function usePermissionOrTrue(permission: Parameters<typeof usePermission>[0] | undefined) {
  const hasPermission = usePermission(permission ?? [])
  return permission === undefined || hasPermission
}
