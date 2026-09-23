"use client"

import { CircleUserIcon, LogOutIcon, SettingsIcon } from "lucide-react"
import Link from "next/link"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useCurrentUser } from "@/features/auth/hooks/use-current-user"
import { usePermission } from "@/features/auth/hooks/use-permission"
import { useLogout } from "@/features/auth/hooks/use-auth-mutations"
import { PEOPLE_MANAGEMENT_PERMISSIONS, roleBadgeClasses } from "@/constants/permissions"
import { cn } from "cn"

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase()
}

export function UserMenu() {
  const { user } = useCurrentUser()
  const managesPeople = usePermission(PEOPLE_MANAGEMENT_PERMISSIONS)
  const logout = useLogout()

  if (!user) return null

  const primaryRole = user.roles[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className="h-9 gap-2 px-2" />}>
        <Avatar className="size-7">
          <AvatarFallback className={cn(primaryRole && roleBadgeClasses(primaryRole.slug))}>
            {initials(user.firstName, user.lastName)}
          </AvatarFallback>
        </Avatar>
        <span className="hidden text-sm font-medium sm:inline">{user.firstName}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>
            <div className="flex flex-col">
              <span className="font-medium">
                {user.firstName} {user.lastName}
              </span>
              <span className="text-xs font-normal text-muted-foreground">{user.email}</span>
            </div>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {/* Matches the sidebar rule: only a login with an employee record,
              and not HR/Admin, who open their own record from the Employees
              directory instead. */}
          {user.employeeId && !managesPeople && (
            <DropdownMenuItem render={<Link href="/profile" />}>
              <CircleUserIcon className="mr-2 size-4" />
              My Profile
            </DropdownMenuItem>
          )}
          <DropdownMenuItem render={<Link href="/settings" />}>
            <SettingsIcon className="mr-2 size-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => logout.mutate()} disabled={logout.isPending}>
            <LogOutIcon className="mr-2 size-4" />
            {logout.isPending ? "Signing out…" : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
