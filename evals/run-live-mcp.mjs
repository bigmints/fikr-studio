import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function text(result) {
  return (result?.content ?? []).filter((item) => item.type === "text").map((item) => item.text).join("\n");
}

function structuredId(result, key, label) {
  const direct = result?.structuredContent?.[key];
  if (typeof direct === "string" && direct) return direct;
  const match = text(result).match(/\bid:\s*([A-Za-z0-9_-]+)/i);
  assert(match, `Missing ${label} id`);
  return match[1];
}

const workspace = path.resolve(option("--workspace") ?? "");
const lockfile = path.resolve(option("--lockfile") ?? "");
assert(workspace.startsWith("/private/tmp/"), "Live MCP mutation evals require a /private/tmp workspace");
assert(fs.existsSync(path.join(workspace, "workspace.json")), "QA workspace is missing");
assert(fs.existsSync(path.join(workspace, "workspace.lock")), "QA workspace is not locked by Electron");
assert(fs.existsSync(lockfile), "MCP lockfile is missing");

const workspaceLock = readJson(path.join(workspace, "workspace.lock"));
const connection = readJson(lockfile);
assert(workspaceLock.pid === connection.pid, "MCP endpoint does not belong to the isolated QA workspace");
assert(typeof connection.url === "string" && connection.url.startsWith("http://127.0.0.1:"), "Unsafe MCP endpoint");

const client = new Client({ name: "fikr-live-chat-eval", version: "1.0.0" });
const steps = [];
const record = (name, passed, detail) => steps.push({ name, passed, detail });
const call = async (name, args = {}) => client.callTool({ name, arguments: args });

try {
  await client.connect(new SSEClientTransport(new URL(connection.url)));
  const listedTools = await client.listTools();
  const names = listedTools.tools.map((tool) => tool.name).sort();
  const expected = ["create_note", "create_note_synthesized", "create_project", "delete_note", "get_canvas", "get_synthesis", "list_projects", "search_notes", "update_note"].sort();
  assert(JSON.stringify(names) === JSON.stringify(expected), "MCP tool inventory changed");
  record("tools/list", true, `${names.length} tools`);

  const resources = await client.listResources();
  assert(resources.resources.some((resource) => resource.uri === "fikr-studio://projects"), "Projects resource missing");
  await client.readResource({ uri: "fikr-studio://projects" });
  record("resources/list + resources/read", true, "projects resource readable");

  const prompts = await client.listPrompts();
  assert(prompts.prompts.some((prompt) => prompt.name === "pre_synthesis"), "Pre-synthesis prompt missing");
  await client.getPrompt({ name: "pre_synthesis", arguments: { text: "Bounded QA note" } });
  record("prompts/list + prompts/get", true, "pre_synthesis prompt readable");

  await call("list_projects");
  record("list_projects", true, "workspace listed");

  const marker = Date.now().toString(36);
  const projectResult = await call("create_project", { name: `QA Chat Tools ${marker}` });
  assert(!projectResult.isError, "create_project failed");
  const projectId = structuredId(projectResult, "projectId", "project");
  record("create_project", true, "empty QA Space created");

  const rawKey = `chat-tools-raw-${marker}`;
  const raw = await call("create_note", {
    project_id: projectId,
    text: "Lighthouse activation increased from 18% to 27%.",
    idempotency_key: rawKey,
  });
  assert(!raw.isError, "create_note failed");
  const rawNoteId = structuredId(raw, "noteId", "note");
  const rawDuplicate = await call("create_note", {
    project_id: projectId,
    text: "This duplicate payload must not create another note.",
    idempotency_key: rawKey,
  });
  assert(structuredId(rawDuplicate, "noteId", "duplicate note") === rawNoteId, "create_note idempotency failed");
  record("create_note", true, "created once and deduplicated by idempotency key");

  const synthesized = await call("create_note_synthesized", {
    project_id: projectId,
    text: "Orbit latency p95 improved from 420 ms to 260 ms.",
    contentType: "claim",
    category: "Release performance",
    annotation: "The release is below the 300 ms rollback threshold.",
    confidence: 98,
    idempotency_key: `chat-tools-synth-${marker}`,
  });
  assert(!synthesized.isError, "create_note_synthesized failed");
  const synthesizedNoteId = structuredId(synthesized, "noteId", "synthesized note");
  record("create_note_synthesized", true, "stored enriched note");

  const canvasBefore = await call("get_canvas", { project_id: projectId });
  const beforePayload = JSON.parse(text(canvasBefore));
  assert(beforePayload.notes.length === 2, "get_canvas did not read both notes");
  record("get_canvas", true, "read two exact notes");

  const search = await call("search_notes", { project_id: projectId, query: "rollback threshold", limit: 5 });
  const searchPayload = JSON.parse(text(search));
  assert(searchPayload.some((item) => item.id === synthesizedNoteId), "search_notes missed exact synthesized content");
  record("search_notes", true, "exact note retrieved");

  const updated = await call("update_note", {
    project_id: projectId,
    note_id: rawNoteId,
    new_text: "Lighthouse activation increased from 18% to 29% after QA correction.",
    type: "claim",
    category: "Activation",
    annotation: "Corrected source-of-truth metric.",
  });
  assert(!updated.isError, "update_note failed");
  const canvasAfterUpdate = JSON.parse(text(await call("get_canvas", { project_id: projectId })));
  assert(canvasAfterUpdate.notes.find((note) => note.id === rawNoteId)?.text.includes("29%"), "update_note readback failed");
  record("update_note", true, "updated fields persisted and read back");

  const synthesis = JSON.parse(text(await call("get_synthesis", { project_id: projectId })));
  assert(Array.isArray(synthesis.synthesis), "get_synthesis returned an invalid shape");
  record("get_synthesis", true, "synthesis collection readable");

  const missingDelete = await call("delete_note", { project_id: projectId, note_id: "missing-note" });
  assert(missingDelete.isError === true, "delete_note wrong-id case did not fail closed");
  await call("delete_note", { project_id: projectId, note_id: rawNoteId });
  await call("delete_note", { project_id: projectId, note_id: synthesizedNoteId });
  const finalCanvas = JSON.parse(text(await call("get_canvas", { project_id: projectId })));
  assert(finalCanvas.notes.length === 0, "delete_note persistence readback failed");
  record("delete_note", true, "wrong id rejected and both test notes removed");

  const result = {
    passed: true,
    at: new Date().toISOString(),
    workspaceKind: "isolated-temp",
    projectId,
    projectName: `QA Chat Tools ${marker}`,
    steps,
  };
  const resultPath = path.resolve("evals/results/live-mcp-latest.json");
  fs.writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ passed: true, steps: steps.length, cleanupProjectId: projectId, resultPath }));
} finally {
  await client.close().catch(() => {});
}
