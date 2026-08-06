"use client"

import { motion } from "framer-motion"
import { type LucideIcon } from "lucide-react"

interface MinimapColumn {
  id: string
  title: string
  icon: LucideIcon
  count: number
}

interface KanbanMinimapProps {
  columns: MinimapColumn[]
  onColumnClick: (id: string) => void
}

export function KanbanMinimap({ columns, onColumnClick }: KanbanMinimapProps) {
  if (columns.length === 0) return null

  return (
    <div className="flex items-center gap-1.5 p-1 rounded-lg bg-card/40 backdrop-blur-md border border-border/40 shadow-xl transition-all hover:bg-card/60">
      {columns.map((col) => (
        <button
          key={col.id}
          onClick={() => onColumnClick(col.id)}
          className="group relative flex items-center justify-center h-8 w-8 rounded-md hover:bg-foreground/10 transition-all active:scale-95"
          title={col.title}
        >
          <col.icon className="h-4 w-4 text-foreground/60 group-hover:text-foreground transition-colors" />
          
          {/* Indicator dot */}
          <div className="absolute -top-1 -right-1 min-h-4 min-w-4 px-0.5 flex items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground border-2 border-background scale-0 group-hover:scale-100 transition-transform">
            {col.count}
          </div>

          {/* Label Tooltip (Minimal) */}
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded-md bg-popover text-[11px] text-popover-foreground opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap border border-border">
            {col.title.toUpperCase()}
          </div>
        </button>
      ))}
    </div>
  )
}
