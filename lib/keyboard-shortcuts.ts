export type ShortcutKey =
  | "mod"
  | "shift"
  | "alt"
  | "enter"
  | "escape"
  | "up"
  | "down"
  | string;

export interface AppShortcut {
  label: string;
  keys: ShortcutKey[];
  note?: string;
}

export interface AppShortcutGroup {
  label: string;
  shortcuts: AppShortcut[];
}

export const APP_SHORTCUT_GROUPS: AppShortcutGroup[] = [
  {
    label: "Navigate",
    shortcuts: [
      { label: "Search workspace", keys: ["mod", "K"], note: "⌘F also works" },
      { label: "Fikr Intel", keys: ["mod", "1"] },
      { label: "Fikr Studio", keys: ["mod", "2"] },
      { label: "Connections", keys: ["mod", "3"] },
      { label: "Settings", keys: ["mod", ","] },
    ],
  },
  {
    label: "Create and organize",
    shortcuts: [
      { label: "New entry", keys: ["mod", "N"] },
      { label: "New workspace", keys: ["mod", "shift", "N"] },
      { label: "Toggle insights", keys: ["mod", "shift", "I"] },
      { label: "Undo last note change", keys: ["mod", "Z"] },
    ],
  },
  {
    label: "Views",
    shortcuts: [
      { label: "Notes list", keys: ["mod", "alt", "L"] },
      { label: "Knowledge graph", keys: ["mod", "alt", "G"] },
      { label: "Previous or next note", keys: ["up", "down"] },
    ],
  },
  {
    label: "Writing",
    shortcuts: [
      { label: "Save entry", keys: ["mod", "S"], note: "⌘Enter also works" },
      { label: "Bold", keys: ["mod", "B"] },
      { label: "Italic", keys: ["mod", "I"] },
      { label: "Add link", keys: ["mod", "K"] },
    ],
  },
  {
    label: "General",
    shortcuts: [
      { label: "Keyboard shortcuts", keys: ["mod", "/"], note: "? also works" },
      { label: "Close active panel", keys: ["escape"] },
    ],
  },
];

export function isEditableShortcutTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(
    target.closest(
      "input, textarea, select, [contenteditable='true'], [contenteditable=''], [role='textbox']",
    ),
  );
}

export function shortcutKeyLabel(key: ShortcutKey, mod: string): string {
  if (key === "mod") return mod;
  if (key === "shift") return "⇧";
  if (key === "alt") return "⌥";
  if (key === "enter") return "↵";
  if (key === "escape") return "Esc";
  if (key === "up") return "↑";
  if (key === "down") return "↓";
  return key;
}
