"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";

export function UpdateCheckIndicator() {
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const ipc = typeof window !== "undefined" && (window as any).fikrStudio;
    if (!ipc?.onUpdateStatus) return;

    return ipc.onUpdateStatus((status: { checking?: boolean }) => {
      setChecking(status?.checking === true);
    });
  }, []);

  return (
    <AnimatePresence>
      {checking && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="pointer-events-none fixed inset-x-0 top-12 z-[1000] flex justify-center px-4"
        >
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-2.5 rounded-lg border border-border/70 bg-popover/95 px-4 py-2.5 text-sm font-medium text-popover-foreground shadow-lg backdrop-blur-md"
          >
            <Loader2 aria-hidden="true" className="size-4 animate-spin text-primary" />
            <span>Checking for updates.</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
