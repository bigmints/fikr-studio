import { Link as LinkIcon } from "lucide-react";

export const MarkdownComponents = {
  p: ({ children }: any) => <p className="mb-3 last:mb-0">{children}</p>,
  ul: ({ children }: any) => (
    <ul className="mb-3 list-disc pl-4 last:mb-0">{children}</ul>
  ),
  ol: ({ children }: any) => (
    <ol className="mb-3 list-decimal pl-4 last:mb-0">{children}</ol>
  ),
  li: ({ children }: any) => <li className="mb-1">{children}</li>,
  h1: ({ children }: any) => (
    <h1 className="mb-2 text-base font-bold">{children}</h1>
  ),
  h2: ({ children }: any) => (
    <h2 className="mb-2 text-base font-bold">{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="mb-1 text-sm font-bold">{children}</h3>
  ),
  a: ({ href, children }: any) => {
    let displayDomain = href;
    try {
      displayDomain = new URL(href).hostname.replace("www.", "");
    } catch {}
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-0.5 text-primary hover:underline"
      >
        <LinkIcon className="h-2.5 w-2.5" />
        {children || displayDomain}
      </a>
    );
  },
  strong: ({ children }: any) => (
    <strong className="font-bold text-foreground">{children}</strong>
  ),
};
