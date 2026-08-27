const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('empty chat history removes the recent chats context panel', () => {
  const component = fs.readFileSync(path.join(__dirname, '..', 'components', 'project-sidebar.tsx'), 'utf8');

  assert.match(component, /contextKind === "chats" && sortedThreads\.length > 0/);
  assert.equal((component.match(/contextKind && showContextPanel &&/g) ?? []).length, 2);
  assert.doesNotMatch(component, /Your recent conversations will appear here/);
});

test('knowledge sidebar is presented as Spaces with one header count', () => {
  const component = fs.readFileSync(path.join(__dirname, '..', 'components', 'project-sidebar.tsx'), 'utf8');

  assert.match(component, /\["Knowledge", "Spaces", BookOpen\]/);
  assert.match(component, /contextKind === "chats" \? "Chats" : "Spaces"/);
  assert.match(component, /const contextCount = contextKind === "chats" \? chatThreads\.length : projects\.length/);
  assert.match(component, /aria-label=\{contextCountLabel\}/);
  assert.doesNotMatch(component, />\s*Workspaces\s*</);
});

test('chat sidebar count uses the complete thread collection', () => {
  const component = fs.readFileSync(path.join(__dirname, '..', 'components', 'project-sidebar.tsx'), 'utf8');

  assert.match(component, /const contextCount = contextKind === "chats" \? chatThreads\.length : projects\.length/);
  assert.match(component, /`\$\{contextCount\} \$\{contextCount === 1 \? "chat" : "chats"\}`/);
  assert.doesNotMatch(component, /const contextCount = contextKind === "chats" \? sortedThreads\.length/);
});

test('chat timestamps stay pinned to the right edge', () => {
  const component = fs.readFileSync(path.join(__dirname, '..', 'components', 'project-sidebar.tsx'), 'utf8');
  const rightAlignedTimestamps = component.match(/ml-auto shrink-0 pt-px text-right text-xs font-normal tabular-nums text-muted-foreground/g) ?? [];

  assert.equal(rightAlignedTimestamps.length, 2);
});

test('chat actions support compact manual renaming and recoverable deletion', () => {
  const sidebar = fs.readFileSync(path.join(__dirname, '..', 'components', 'project-sidebar.tsx'), 'utf8');
  const page = fs.readFileSync(path.join(__dirname, '..', 'app', 'page.tsx'), 'utf8');

  assert.match(sidebar, /<Edit3 \/> Rename chat/);
  assert.match(sidebar, /aria-label="Chat title"/);
  assert.match(sidebar, /split\(\/\\s\+\/\)\.slice\(0, 5\)\.join\(" "\)/);
  assert.match(page, /onRenameChat=\{handleRenameChat\}/);
  assert.match(page, /toast\("Chat deleted", \{[\s\S]*?label: "Undo"/);
});

test('desktop settings lives in the profile menu instead of the icon rail', () => {
  const component = fs.readFileSync(path.join(__dirname, '..', 'components', 'project-sidebar.tsx'), 'utf8');
  const profileMenu = component.match(/<DropdownMenuContent className="w-\[248px\]"[\s\S]*?<\/DropdownMenuContent>/)?.[0] ?? '';

  assert.match(profileMenu, /<Settings \/> Settings/);
  assert.match(profileMenu, /onClick=\{\(\) => onOpenSettings\("account"\)\}/);
  assert.doesNotMatch(component, /<TooltipContent side="right">Settings<\/TooltipContent>/);
  assert.doesNotMatch(component, /<Shield \/> Manage Account/);
});

test('appearance menu offers persisted Light Dark and System preferences', () => {
  const component = fs.readFileSync(path.join(__dirname, '..', 'components', 'project-sidebar.tsx'), 'utf8');
  const layout = fs.readFileSync(path.join(__dirname, '..', 'app', 'layout.tsx'), 'utf8');

  assert.match(layout, /defaultTheme="light"/);
  assert.match(layout, /enableSystem/);
  assert.match(component, /<DropdownMenuPortal>\s*<DropdownMenuSubContent/);
  assert.match(component, /<DropdownMenuRadioGroup value=\{theme \?\? "light"\} onValueChange=\{setTheme\}>/);
  assert.match(component, /<DropdownMenuRadioItem value="light"[^>]*>[\s\S]*?Light[\s\S]*?<\/DropdownMenuRadioItem>/);
  assert.match(component, /<DropdownMenuRadioItem value="dark"[^>]*>[\s\S]*?Dark[\s\S]*?<\/DropdownMenuRadioItem>/);
  assert.match(component, /<DropdownMenuRadioItem value="system"[^>]*>[\s\S]*?System[\s\S]*?<\/DropdownMenuRadioItem>/);
  assert.doesNotMatch(component, /setTheme\(theme === "dark" \? "light" : "dark"\)/);
});
