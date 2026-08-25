import React from "react";
import { useModKey } from "@/lib/utils";
import { FilePlus2 } from "lucide-react";
import { Kbd } from "@/components/ui/kbd";

interface EmptyWorkspaceProps {
  title?: string;
}

export function EmptyWorkspace({ title }: EmptyWorkspaceProps) {
  const mod = useModKey();

  return (
    <div className="absolute inset-0 z-0 flex items-center justify-center bg-background px-6 text-center">
      <div className="flex max-w-sm flex-col items-center">
        <span className="mb-5 flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary ring-1 ring-inset ring-primary/15">
          <FilePlus2 className="size-5" />
        </span>
        <h1 className="font-display text-2xl font-medium tracking-tight text-foreground">Start with one thought</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Add your first note to fill this {title || "workspace"}. Fikr will keep the original Markdown intact.
        </p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-lg bg-secondary/70 px-3 py-2 text-xs font-medium text-muted-foreground">
          <Kbd>{mod}</Kbd><Kbd>Enter</Kbd><span>Add a note</span>
        </div>
      </div>
    </div>
  );
}
