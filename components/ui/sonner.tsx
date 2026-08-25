"use client";

import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();

  return (
    <Sonner
      theme={(resolvedTheme ?? "system") as ToasterProps["theme"]}
      position="bottom-center"
      closeButton
      gap={8}
      toastOptions={{
        duration: 3_200,
        classNames: {
          toast:
            "group !rounded-lg !border-border/70 !bg-popover !font-sans !text-foreground !shadow-xl",
          title: "!font-semibold",
          description: "!text-muted-foreground",
          actionButton:
            "!rounded-md !bg-foreground !px-2.5 !font-semibold !text-background",
          cancelButton:
            "!rounded-md !bg-secondary !px-2.5 !font-semibold !text-foreground",
          closeButton:
            "!border-border/70 !bg-popover !text-muted-foreground hover:!text-foreground",
        },
      }}
      {...props}
    />
  );
}
