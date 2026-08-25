"use client";

import { ArrowRight, ExternalLink, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ApiKeyBannerProps {
  onAddKey: () => void;
}

export function ApiKeyBanner({ onAddKey }: ApiKeyBannerProps) {
  return (
    <div className="shrink-0 border-b border-border/60 bg-primary/[0.06] px-3 py-1.5 sm:px-5" data-testid="api-key-banner">
      <div role="alert" className="flex min-h-8 items-center justify-between gap-2 sm:gap-4">
        <div className="flex min-w-0 items-center gap-2 text-xs font-medium text-foreground/80">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/12 text-primary"><Zap className="size-3.5" /></span>
          <span className="truncate"><span className="sm:hidden">AI setup needed</span><span className="hidden sm:inline">Add an API key to use AI across Fikr Studio.</span></span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button asChild type="button" variant="ghost" size="xs" className="hidden bg-background/50 sm:inline-flex">
            <a href="https://fikr.one/pricing" target="_blank" rel="noopener noreferrer">
              Upgrade <ExternalLink className="size-3" />
            </a>
          </Button>
          <Button type="button" size="xs" onClick={onAddKey}>
            Add key <ArrowRight className="size-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
