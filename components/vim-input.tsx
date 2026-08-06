"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { analytics } from "@/lib/analytics";
import { MarkdownEntryEditor } from "@/components/markdown-entry-editor";
import {
  markdownEntryDraftKey,
} from "@/lib/markdown-entry";
import { isEditableShortcutTarget } from "@/lib/keyboard-shortcuts";

interface VimInputProps {
  projectId: string;
  onSubmit: (text: string) => void;
  hidden?: boolean;
  openRequest?: number;
  onOpenRequestHandled?: () => void;
}

export function VimInput({
  projectId,
  onSubmit,
  hidden = false,
  openRequest = 0,
  onOpenRequestHandled,
}: VimInputProps) {
  const draftKey = React.useMemo(() => markdownEntryDraftKey(projectId), [projectId]);
  const [value, setValue] = React.useState("");
  const [draftLoaded, setDraftLoaded] = React.useState(false);
  const [draftStorageAvailable, setDraftStorageAvailable] = React.useState(true);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [editorCursor, setEditorCursor] = React.useState<number | null>(null);

  React.useEffect(() => {
    try {
      setValue(window.localStorage.getItem(draftKey) ?? "");
    } catch {
      setValue("");
      setDraftStorageAvailable(false);
    } finally {
      setDraftLoaded(true);
    }
  }, [draftKey]);

  React.useEffect(() => {
    if (!draftLoaded) return;
    try {
      if (value) window.localStorage.setItem(draftKey, value);
      else window.localStorage.removeItem(draftKey);
    } catch {
      // A draft is still kept in component state when browser storage is unavailable.
      setDraftStorageAvailable(false);
    }
  }, [draftKey, draftLoaded, value]);

  const openEditor = React.useCallback(() => {
    analytics.track("markdown_editor_open", { source: "fab" });
    setEditorCursor(value.length);
    setEditorOpen(true);
  }, [value.length]);

  const handledOpenRequestRef = React.useRef(0);
  React.useEffect(() => {
    if (openRequest <= 0) {
      handledOpenRequestRef.current = 0;
      return;
    }
    if (handledOpenRequestRef.current === openRequest) return;
    handledOpenRequestRef.current = openRequest;
    openEditor();
    onOpenRequestHandled?.();
  }, [onOpenRequestHandled, openEditor, openRequest]);

  React.useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (isEditableShortcutTarget(event.target) || !(event.metaKey || event.ctrlKey) || !event.shiftKey || event.key.toLowerCase() !== "m") return;
      event.preventDefault();
      openEditor();
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [openEditor]);

  const submit = React.useCallback(() => {
    if (!value.trim()) return;
    analytics.track("vim_command", { source: "editor" });
    onSubmit(value);
    setValue("");
    setEditorOpen(false);
    toast("Entry saved", { description: "Added to this workspace." });
  }, [onSubmit, value]);

  const discard = React.useCallback(() => {
    if (value.trim() && !window.confirm("Discard this entry draft?")) return;
    setValue("");
    setEditorOpen(false);
  }, [value]);

  return (
    <>
      {!editorOpen && !hidden && (
        <button
          type="button"
          onClick={openEditor}
          className="absolute bottom-6 right-6 z-[120] flex size-12 items-center justify-center rounded-full bg-foreground text-background shadow-lg transition-transform duration-150 ease-out hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/30 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95"
          title={value.trim() ? "Continue entry draft  ⌘⇧M" : "New entry  ⌘⇧M"}
          aria-label={value.trim() ? "Continue entry draft" : "Create new entry"}
        >
          <Plus className="size-5" strokeWidth={2} />
          {value.trim() && (
            <span
              className="absolute right-0.5 top-0.5 size-2 rounded-full bg-type-task ring-2 ring-background"
              aria-hidden="true"
            />
          )}
        </button>
      )}

      <MarkdownEntryEditor
        open={editorOpen}
        value={value}
        contextLabel="New entry"
        saveLabel="Save entry"
        draftIsRecoverable={draftStorageAvailable}
        initialCursor={editorCursor ?? value.length}
        onChange={setValue}
        onSave={submit}
        onClose={() => {
          setEditorOpen(false);
          setEditorCursor(null);
        }}
        onDiscard={discard}
      />
    </>
  );
}
