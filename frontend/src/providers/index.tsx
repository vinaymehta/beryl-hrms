"use client"

import type { ReactNode } from "react"

import { AppQueryProvider } from "@/providers/query-provider"
import { ThemeProvider } from "@/providers/theme-provider"
import { Toaster } from "@/components/ui/sonner"

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AppQueryProvider>
        {children}
        <Toaster />
      </AppQueryProvider>
    </ThemeProvider>
  )
}
