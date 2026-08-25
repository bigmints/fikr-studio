"use client";

import type { ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { normalizeDisplayMarkdown } from "@/lib/display-markdown.mjs";

type SharedMarkdownProps = {
  children: string;
  className?: string;
  components?: Components;
};

function textFromNode(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textFromNode).join("");
  if (node && typeof node === "object" && "props" in node) {
    return textFromNode((node as { props?: { children?: ReactNode } }).props?.children ?? "");
  }
  return "";
}

const sharedComponents: Components = {
  p: ({ children }) => (
    <p className={textFromNode(children).trimStart().startsWith("→") ? "fikr-chat-markdown__arrow" : undefined}>
      {children}
    </p>
  ),
  table: ({ children }) => (
    <div className="fikr-chat-markdown__table-wrap">
      <table>{children}</table>
    </div>
  ),
  a: ({ href, children }) => href ? (
    <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
  ) : <span>{children}</span>,
};

export function SharedMarkdown({ children, className, components }: SharedMarkdownProps) {
  return (
    <div className={cn("fikr-reading-markdown fikr-chat-markdown fikr-markdown", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ ...sharedComponents, ...components }}>
        {normalizeDisplayMarkdown(children)}
      </ReactMarkdown>
    </div>
  );
}
