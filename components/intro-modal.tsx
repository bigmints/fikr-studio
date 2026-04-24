"use client"

import { useEffect, useRef } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"

interface IntroModalProps {
  open: boolean
  onClose: () => void
}

export function IntroModal({ open, onClose }: IntroModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handle = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", handle)
    return () => window.removeEventListener("keydown", handle)
  }, [open, onClose])

  // Prevent body scroll while open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden"
    else document.body.style.overflow = ""
    return () => { document.body.style.overflow = "" }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative w-full max-w-3xl bg-card border border-border rounded-sm shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 pt-6 pb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <img src="logo-icon.png" alt="FikrPad" className="h-5 w-5 object-contain" />
                  <span className="font-mono text-sm font-black text-foreground tracking-tight">FikrPad</span>
                </div>
                <p className="text-xs text-muted-foreground/60 font-mono uppercase tracking-widest">
                  A quick introduction
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 rounded-sm text-muted-foreground/40 hover:text-foreground hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Welcome Content */}
            <div className="px-8 py-10">
              <h2 className="text-2xl font-bold text-foreground mb-4">Welcome to FikrPad</h2>
              <p className="text-muted-foreground leading-relaxed mb-8">
                FikrPad is the desktop spatial companion to Fikr Voice Notes. It reads what you write and enriches it with AI — no prompting, no chat. Just capture your thinking and let the structure emerge.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-primary/10 border border-primary/20 text-primary font-mono text-[10px] font-bold mt-0.5">1</div>
                  <div>
                    <h3 className="text-foreground font-semibold mb-1">Add your API key</h3>
                    <p className="text-sm text-muted-foreground">Open settings (top left) to add your OpenRouter, OpenAI, or Z.ai key.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-primary/10 border border-primary/20 text-primary font-mono text-[10px] font-bold mt-0.5">2</div>
                  <div>
                    <h3 className="text-foreground font-semibold mb-1">Capture anything</h3>
                    <p className="text-sm text-muted-foreground">Type a thought, quote, or task in the bottom input bar. Use #type to force classification.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="flex h-6 w-6 items-center justify-center rounded-sm bg-primary/10 border border-primary/20 text-primary font-mono text-[10px] font-bold mt-0.5">3</div>
                  <div>
                    <h3 className="text-foreground font-semibold mb-1">Let AI structure it</h3>
                    <p className="text-sm text-muted-foreground">The AI automatically categorises, annotates, and connects your notes.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06]">
              <p className="text-xs text-muted-foreground/40">
                You can view the full guide anytime via the <span className="font-mono font-black text-muted-foreground/60">?</span> button
              </p>
              <button
                onClick={onClose}
                className="px-4 py-1.5 text-xs font-mono font-medium rounded-sm bg-white/8 hover:bg-white/15 text-foreground/70 hover:text-foreground border border-white/10 hover:border-white/20 transition-all"
              >
                Skip to app →
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
