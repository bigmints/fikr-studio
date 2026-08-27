import test from "node:test";
import assert from "node:assert/strict";

import {
  applyChatMemoryMutations,
  executeChatMemoryCommand,
  normalizeChatMemories,
  selectRelevantChatMemories,
} from "../lib/chat-memory.mjs";

test("executes explicit memory commands without sending them through knowledge retrieval", () => {
  const remembered = executeChatMemoryCommand("Remember that I prefer a summary first.", [], { now: 100 });
  assert.equal(remembered.answer, "I’ll remember that.");
  assert.equal(remembered.toolName, "remember_user_context");
  assert.equal(remembered.memoryMutations[0].memory.text, "I prefer a summary first.");
  assert.equal(remembered.memoryMutations[0].memory.kind, "preference");

  const memory = remembered.memoryMutations[0].memory;
  assert.equal(executeChatMemoryCommand("What do you remember about me?", [memory]).answer,
    "Here’s what I remember:\n\n- I prefer a summary first.");
  assert.deepEqual(executeChatMemoryCommand("Forget that preference", [memory]).memoryMutations,
    [{ type: "delete", memoryId: memory.id }]);
  assert.throws(
    () => executeChatMemoryCommand("Remember that my password is hunter2", []),
    /Secrets and credentials cannot be saved to memory/,
  );
});

test("normalizes bounded durable chat memories", () => {
  const memories = normalizeChatMemories([
    { id: "memory-1", text: "  I prefer concise answers.  ", kind: "preference", createdAt: 10, updatedAt: 20 },
    { id: "memory-1", text: "I prefer concise plans.", kind: "preference", createdAt: 10, updatedAt: 30 },
    { id: "", text: "invalid" },
  ]);

  assert.deepEqual(memories, [{
    id: "memory-1",
    text: "I prefer concise plans.",
    kind: "preference",
    createdAt: 10,
    updatedAt: 30,
  }]);
});

test("selects relevant memories without treating them as knowledge citations", () => {
  const memories = [
    { id: "tone", text: "I prefer concise launch plans.", kind: "preference", createdAt: 10, updatedAt: 20 },
    { id: "role", text: "I work in product design.", kind: "identity", createdAt: 10, updatedAt: 10 },
  ];

  assert.deepEqual(
    selectRelevantChatMemories("Help me plan the launch", memories).map((memory) => memory.id),
    ["tone"],
  );
  assert.deepEqual(
    selectRelevantChatMemories("What do you remember about me?", memories).map((memory) => memory.id),
    ["tone", "role"],
  );
});

test("applies upsert and delete mutations idempotently", () => {
  const existing = [{
    id: "memory-old",
    text: "I prefer concise answers.",
    kind: "preference",
    createdAt: 10,
    updatedAt: 10,
  }];
  const updated = applyChatMemoryMutations(existing, [{
    type: "upsert",
    memory: {
      id: "memory-new",
      text: "I prefer concise answers.",
      kind: "preference",
      createdAt: 20,
      updatedAt: 20,
    },
  }]);
  assert.deepEqual(updated.map((memory) => memory.id), ["memory-new"]);
  assert.deepEqual(applyChatMemoryMutations(updated, [{ type: "delete", memoryId: "memory-new" }]), []);
});
