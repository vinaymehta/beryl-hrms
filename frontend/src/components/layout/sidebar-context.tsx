"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { usePathname } from "next/navigation"

export interface SidebarContextValue {
  isOpen: boolean
  isSettings: boolean
  toggle: () => void
  open: () => void
  close: () => void
}

const DEFAULT_SIDEBAR_VALUE: SidebarContextValue = {
  isOpen: false,
  isSettings: true,
  toggle: () => {},
  open: () => {},
  close: () => {},
}

const SidebarContext = createContext<SidebarContextValue>(DEFAULT_SIDEBAR_VALUE)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isSettings = pathname.startsWith("/settings")

  // On settings routes, sidebar is closed by default.
  const [settingsSidebarOpen, setSettingsSidebarOpen] = useState(false)

  // Reset to closed when navigating into settings
  useEffect(() => {
    if (isSettings) {
      setSettingsSidebarOpen(false)
    }
  }, [isSettings])

  const isOpen = isSettings ? settingsSidebarOpen : true

  const toggle = () => {
    if (isSettings) {
      setSettingsSidebarOpen((prev) => !prev)
    }
  }

  const open = () => {
    if (isSettings) {
      setSettingsSidebarOpen(true)
    }
  }

  const close = () => {
    if (isSettings) {
      setSettingsSidebarOpen(false)
    }
  }

  return (
    <SidebarContext.Provider
      value={{
        isOpen,
        isSettings,
        toggle,
        open,
        close,
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  return useContext(SidebarContext)
}
