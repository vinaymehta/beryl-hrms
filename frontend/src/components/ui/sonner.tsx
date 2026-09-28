"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      // Top-centre and wider than sonner's 356px default, with colour by
      // type: the bottom-corner default was small enough to go unnoticed.
      position="top-center"
      richColors
      closeButton
      icons={{
        success: (
          <CircleCheckIcon className="size-5" />
        ),
        info: (
          <InfoIcon className="size-5" />
        ),
        warning: (
          <TriangleAlertIcon className="size-5" />
        ),
        error: (
          <OctagonXIcon className="size-5" />
        ),
        loading: (
          <Loader2Icon className="size-5 animate-spin" />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
          "--width": "min(480px, calc(100vw - 32px))",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast !px-5 !py-4 !text-base !shadow-lg",
          title: "!text-base !font-semibold",
          description: "!text-sm",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
