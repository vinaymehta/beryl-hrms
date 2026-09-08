"use client"

import { useState } from "react"
import { SearchIcon, XIcon } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function MailSearchInput({
  onSearch,
  onClear,
}: {
  onSearch: (query: string) => void
  onClear: () => void
}) {
  const [value, setValue] = useState("")

  return (
    <form
      className="relative"
      onSubmit={(e) => {
        e.preventDefault()
        if (value.trim()) onSearch(value.trim())
      }}
    >
      <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search mail…"
        className="pl-8"
        aria-label="Search mail"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-1/2 right-1 -translate-y-1/2"
          onClick={() => {
            setValue("")
            onClear()
          }}
        >
          <XIcon />
        </Button>
      )}
    </form>
  )
}
