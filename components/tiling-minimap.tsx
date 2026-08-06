"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { CONTENT_TYPE_CONFIG } from "@/lib/content-types"
import type { TextBlock } from "@/components/tile-card"

interface TilingMinimapProps {
  pages: TextBlock[][]
  activePageIdx: number
  onPageClick: (idx: number) => void
}

export function TilingMinimap({ pages, activePageIdx, onPageClick }: TilingMinimapProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  return (
    <motion.div
      initial={{ opacity: 0, x: 8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex flex-col items-center gap-1.5 p-1.5 rounded-lg bg-card/80 backdrop-blur-md border border-border/40 shadow-xl"
    >
      {pages.map((page, idx) => {
        const isActive = idx === activePageIdx

        return (
          <div key={idx} className="relative flex items-center">

            {/* Tooltip — slides in from the right, appears to the left of the button */}
            <AnimatePresence>
              {hoveredIdx === idx && (
                <motion.div
                  initial={{ opacity: 0, x: 6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 6 }}
                  transition={{ duration: 0.12, ease: "easeOut" }}
                  className="absolute right-full bottom-0 mr-2.5 w-52 p-2.5 rounded-md bg-card/95 backdrop-blur-md border border-border/40 shadow-2xl pointer-events-none z-50"
                >
                  <p className="text-[11px] font-semibold text-muted-foreground/70 pb-1.5 mb-1.5 border-b border-border/20">
                    Page {idx + 1} · {page.length} tile{page.length !== 1 ? "s" : ""}
                  </p>
                  <div className="flex flex-col gap-1.5">
                    {page.map(block => {
                      const config = CONTENT_TYPE_CONFIG[block.contentType] || CONTENT_TYPE_CONFIG.general
                      const title  = (block.text || '').length > 48
                        ? (block.text || '').slice(0, 48) + "…"
                        : (block.text || "Empty note")
                      return (
                        <div key={block.id} className="flex items-start gap-1.5">
                          <div
                            className="h-[5px] w-[5px] rounded-[1px] shrink-0 mt-[3px]"
                            style={{ background: config.accentVar, opacity: 0.85 }}
                          />
                          <span className="text-[11px] text-foreground/80 leading-snug">
                            {title}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Page button */}
            <button
              onClick={() => onPageClick(idx)}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              className={`group relative flex flex-col items-center gap-[4px] p-1.5 rounded-md transition-all duration-150 outline-none ${
                isActive
                  ? "bg-primary/15 border border-primary/40 shadow-[0_0_0_1px_var(--primary)]"
                  : "border border-border/40 bg-foreground/5 hover:bg-foreground/10 hover:border-border/60"
              }`}
            >
              {/* Dot grid — up to 3 columns, rows as needed */}
              <div className="grid grid-cols-3 gap-[3px]">
                {page.map(block => {
                  const config = CONTENT_TYPE_CONFIG[block.contentType] || CONTENT_TYPE_CONFIG.general
                  return (
                    <div
                      key={block.id}
                      className="h-[5px] w-[5px] rounded-[1px] transition-opacity duration-150"
                      style={{
                        background: config.accentVar,
                        opacity: isActive ? 0.95 : 0.55,
                      }}
                    />
                  )
                })}
              </div>

              {/* Page number */}
              <span className={`text-[11px] font-semibold leading-none transition-colors ${
                isActive ? "text-primary/80" : "text-muted-foreground/50 group-hover:text-foreground/70"
              }`}>
                {idx + 1}
              </span>
            </button>
          </div>
        )
      })}
    </motion.div>
  )
}
