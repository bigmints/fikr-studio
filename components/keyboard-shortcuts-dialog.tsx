"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { APP_SHORTCUT_GROUPS, shortcutKeyLabel } from "@/lib/keyboard-shortcuts";
import { useModKey } from "@/lib/utils";

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: KeyboardShortcutsDialogProps) {
  const mod = useModKey();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[82vh] max-w-[660px] gap-0 overflow-hidden rounded-[10px] border-border/70 p-0">
        <DialogHeader className="border-b border-border/55 px-7 py-6 pr-14">
          <DialogTitle className="font-serif text-[28px] font-medium leading-tight">
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription>
            Navigate Fikr without leaving the keyboard.
          </DialogDescription>
        </DialogHeader>

        <div className="custom-scrollbar grid overflow-y-auto px-7 py-5 sm:grid-cols-2 sm:gap-x-10">
          {APP_SHORTCUT_GROUPS.map((group) => (
            <section key={group.label} className="mb-6 break-inside-avoid">
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                {group.label}
              </h2>
              <div>
                {group.shortcuts.map((shortcut) => (
                  <div
                    key={`${group.label}-${shortcut.label}`}
                    className="flex min-h-10 items-center justify-between gap-4 border-b border-border/35 py-2 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-foreground">
                        {shortcut.label}
                      </p>
                      {shortcut.note && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {shortcut.note}
                        </p>
                      )}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {shortcut.keys.map((key, index) => (
                        <Kbd key={`${key}-${index}`} className="min-w-5 justify-center bg-secondary/70 text-foreground/75">
                          {shortcutKeyLabel(key, mod)}
                        </Kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
