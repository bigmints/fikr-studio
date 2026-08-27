import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAgentKnowledgeContext,
  buildCitedAnswerFixture,
  buildKnowledgeInventoryAnswer,
  canCreateSocialArtifact,
  createCreationFromArtifact,
  creationMatchesArtifact,
  createKnowledgeNoteFromAnswer,
  dedupeAgentEvents,
  mergeKnowledgeSources,
  isKnowledgeInventoryRequest,
  normalizeChatThreads,
  recommendProjectForKnowledgeDraft,
  resolveAgentSources,
  retrieveKnowledge,
  shouldOfferInsightSave,
  shouldUseWorkspaceFallback,
  selectChatExecutionRoute,
  titleFromQuery,
} from "../lib/chat-domain.mjs";

test("configured provider keys own chat orchestration before managed fallback", () => {
  assert.equal(selectChatExecutionRoute({ managedAvailable: true, localOverride: false, configuredProviderKey: true }), "byok-agent");
  assert.equal(selectChatExecutionRoute({ managedAvailable: true, localOverride: false, configuredProviderKey: false }), "managed");
  assert.equal(selectChatExecutionRoute({ managedAvailable: false, localOverride: true, configuredProviderKey: false }), "local-agent");
  assert.equal(selectChatExecutionRoute({ managedAvailable: false, localOverride: false, configuredProviderKey: false }), "unavailable");
});

test("managed artifact parsing is permitted only for explicit social creation", () => {
  assert.equal(canCreateSocialArtifact("According to my notes, what is Xtara's product vision?"), false);
  assert.equal(canCreateSocialArtifact("How many posts mention Xtara?"), false);
  assert.equal(canCreateSocialArtifact("Create a LinkedIn post from my Xtara notes"), true);
});

test("knowledge inventory requests and count corrections stay deterministic", () => {
  assert.equal(isKnowledgeInventoryRequest("How many notes do I have?"), true);
  assert.equal(isKnowledgeInventoryRequest("wrong", [{ role: "user", content: "How many notes do I have?" }]), true);
  assert.equal(isKnowledgeInventoryRequest("hello"), false);
  assert.equal(buildKnowledgeInventoryAnswer("How many notes do I have?", {
    scopeKind: "all",
    totalNotes: 43,
    totalSpaces: 8,
    spaces: [],
  }), "You have 43 notes across 8 spaces.");
});

const projects = [
  {
    id: "strategy",
    name: "Product Strategy",
    blocks: [
      {
        id: "launch",
        title: "Launch positioning",
        text: "Lead with the customer problem and a simpler workflow.",
        annotation: "The launch story should focus on clarity and measurable outcomes.",
        contentType: "claim",
        category: "Launch",
        timestamp: 200,
      },
      {
        id: "pricing",
        text: "Pricing experiments can wait until after the launch.",
        contentType: "task",
        timestamp: 100,
      },
    ],
  },
  {
    id: "research",
    name: "Customer Research",
    blocks: [
      {
        id: "interviews",
        title: "Customer interviews",
        text: "Customers asked for faster setup and fewer configuration steps.",
        contentType: "insight",
        category: "Research",
        timestamp: 300,
      },
    ],
  },
];

test("agent knowledge context keeps the complete selected scope while preserving ranked priors", () => {
  const context = buildAgentKnowledgeContext(projects, { kind: "all" }, [{
    noteId: "interviews",
    score: 0.9,
  }]);

  assert.equal(context.inventory.totalSpaces, 2);
  assert.equal(context.inventory.totalNotes, 3);
  assert.deepEqual(context.inventory.spaces.map((space) => space.noteCount), [2, 1]);
  assert.deepEqual(context.sources.map((source) => source.noteId), ["interviews", "launch", "pricing"]);
  assert.equal(context.sources[0].score, 0.9);

  const scoped = buildAgentKnowledgeContext(projects, { kind: "projects", projectIds: ["research"] }, []);
  assert.equal(scoped.inventory.scopeKind, "projects");
  assert.equal(scoped.inventory.totalSpaces, 1);
  assert.equal(scoped.inventory.totalNotes, 1);
  assert.deepEqual(scoped.sources.map((source) => source.noteId), ["interviews"]);
});

test("runtime source IDs define the renderer citation order and omit uncited search hits", () => {
  const context = buildAgentKnowledgeContext(projects, { kind: "all" }, []);
  const resolved = resolveAgentSources(context.sources, ["pricing", "launch", "pricing", "missing"]);

  assert.deepEqual(resolved.map((source) => source.noteId), ["pricing", "launch"]);
  assert.deepEqual(resolved.map((source) => source.citationIndex), [1, 2]);
});

test("creates compact semantic chat titles with no more than five words", () => {
  assert.equal(
    titleFromQuery("Create a LinkedIn post about Markdown QA from my notes"),
    "LinkedIn post: Markdown QA",
  );
  assert.equal(
    titleFromQuery("Could you summarize the architecture decisions behind Fikr?"),
    "Architecture decisions behind Fikr",
  );
  assert.equal(titleFromQuery("hello"), "Hello");
  assert.ok(titleFromQuery("one two three four five six seven").split(/\s+/).length <= 5);
});

test("normalization automatically compacts legacy chat titles", () => {
  const [thread] = normalizeChatThreads([{
    id: "legacy-title",
    title: "Create a LinkedIn post about Markdown QA from my notes",
    messages: [{ id: "message-1", role: "user", content: "Create the post", createdAt: 1 }],
  }]);

  assert.equal(thread.title, "LinkedIn post: Markdown QA");
});

test("normalization persists attachment metadata without binary file data", () => {
  const [thread] = normalizeChatThreads([{
    id: "attachment-thread",
    messages: [{
      id: "attachment-message",
      role: "user",
      content: "Review this diagram",
      createdAt: 1,
      attachments: [{
        id: "attachment-1",
        name: "../diagram.png",
        kind: "image",
        mediaType: "image/png",
        size: 2048,
        dataUrl: "data:image/png;base64,do-not-persist",
      }],
    }],
  }]);

  assert.deepEqual(thread.messages[0].attachments, [{
    id: "attachment-1",
    name: "diagram.png",
    kind: "image",
    mediaType: "image/png",
    size: 2048,
  }]);
  assert.equal("dataUrl" in thread.messages[0].attachments[0], false);
});

test("normalization persists bounded webpage provenance and creation source URLs", () => {
  const url = "https://example.com/report";
  const [thread] = normalizeChatThreads([{
    id: "web-thread",
    messages: [{
      id: "web-message",
      role: "assistant",
      content: "The report supports bounded extraction [W1].",
      outputKind: "creation",
      webSources: [{
        citation: "W1",
        requestedUrl: url,
        finalUrl: url,
        title: "Web report",
        excerpt: "A report about retrieval.",
        wordCount: 120,
        fetchedAt: 123,
        markdown: "must not persist",
      }],
      artifact: {
        platform: "linkedin",
        title: "Reliable retrieval",
        content: "Bounded extraction keeps research focused.",
        sourceUrls: [url, "file:///etc/passwd"],
      },
    }],
  }]);

  assert.equal(thread.messages[0].webSources.length, 1);
  assert.equal(thread.messages[0].webSources[0].finalUrl, url);
  assert.equal("markdown" in thread.messages[0].webSources[0], false);
  assert.deepEqual(thread.messages[0].artifact.sourceUrls, [url]);

  const creation = createCreationFromArtifact({ artifact: thread.messages[0].artifact, threadId: "web-thread", now: 500 });
  assert.deepEqual(creation.sourceUrls, [url]);
});

test("normalization persists bounded PDF page provenance without extracted content", () => {
  const [thread] = normalizeChatThreads([{
    id: "document-thread",
    messages: [{
      id: "document-message",
      role: "assistant",
      content: "The report requires page-aware citations [D1:p.2].",
      outputKind: "answer",
      documentSources: [{
        citation: "D1:p.2",
        attachmentId: "attachment-pdf",
        name: "../report.pdf",
        pageNumber: 2,
        extractionMethod: "ocr",
        markdown: "must not persist",
      }],
    }],
  }]);

  assert.deepEqual(thread.messages[0].documentSources, [{
    citation: "D1:p.2",
    attachmentId: "attachment-pdf",
    name: "report.pdf",
    pageNumber: 2,
    extractionMethod: "ocr",
  }]);
  assert.equal("markdown" in thread.messages[0].documentSources[0], false);
});

test("retrieves and cites relevant notes across workspaces", () => {
  const results = retrieveKnowledge("product launch customer workflow", projects, { limit: 3 });

  assert.equal(results.length, 3);
  assert.equal(results[0].noteId, "launch");
  assert.equal(results[0].projectName, "Product Strategy");
  assert.equal(results[0].citationIndex, 1);
  assert.equal(results[1].noteId, "interviews");
  assert.equal(results[1].citationIndex, 2);
  assert.ok(results[0].score > results[2].score);
});

test("scopes retrieval to selected workspaces and bounds the limit", () => {
  const results = retrieveKnowledge("customer launch", projects, {
    projectIds: ["research"],
    limit: 100,
  });

  assert.deepEqual(results.map((result) => result.projectId), ["research"]);
  assert.equal(results[0].citationIndex, 1);
});

test("generic insight actions receive recent notes from only the selected workspace", () => {
  assert.equal(shouldUseWorkspaceFallback("Find patterns in my notes"), true);
  assert.equal(shouldUseWorkspaceFallback("hello"), false);

  const results = retrieveKnowledge("Find patterns in my notes", projects, {
    projectIds: ["research"],
    limit: 8,
    fallbackToRecent: shouldUseWorkspaceFallback("Find patterns in my notes"),
  });

  assert.deepEqual(results.map((result) => result.noteId), ["interviews"]);
  assert.deepEqual(results.map((result) => result.projectId), ["research"]);
  assert.equal(results[0].citationIndex, 1);
});

test("ordinary conversation never backfills unrelated workspace notes", () => {
  const results = retrieveKnowledge("hello", projects, {
    fallbackToRecent: shouldUseWorkspaceFallback("hello"),
  });

  assert.deepEqual(results, []);
});

test("treats explicitly saved chat knowledge as first-class retrieval", () => {
  const weeklyDistractors = Array.from({ length: 8 }, (_, index) => ({
    id: `weekly-${index}`,
    title: `Weekly update ${index}`,
    text: "Last week we reviewed the product count and next week we will continue.",
    timestamp: 100 + index,
  }));
  const medicalReport = {
    id: "medical-report",
    title: "Medical report",
    text: "Clinical chemistry: Calcium 2.58 mmol/L. Leucocyte count 9.35.",
    category: "Fikr Chat · Knowledge note",
    contentType: "general",
    fromChat: true,
    timestamp: 1,
  };

  const results = retrieveKnowledge("how much was my calcium count last week", [{
    id: "general",
    name: "General",
    blocks: [...weeklyDistractors, medicalReport],
  }], { limit: 8 });

  assert.equal(results[0].noteId, "medical-report");
  assert.deepEqual(results.map((result) => result.noteId), ["medical-report"]);
});

test("hybrid retrieval cannot bury an exact lexical match under vector-only distractors", () => {
  const report = {
    noteId: "medical-report",
    projectId: "general",
    projectName: "General",
    title: "Medical report",
    text: "Calcium 2.58 mmol/L",
    score: 12,
    citationIndex: 1,
    timestamp: 1_000,
  };
  const semanticDistractors = Array.from({ length: 8 }, (_, index) => ({
    noteId: `unrelated-${index}`,
    projectId: "general",
    projectName: "General",
    title: `Unrelated note ${index}`,
    text: "Product architecture",
    score: 0.9 - index * 0.02,
    citationIndex: index + 1,
    timestamp: 100 + index,
  }));

  const results = mergeKnowledgeSources([report], semanticDistractors, { limit: 8 });

  assert.equal(results[0].noteId, "medical-report");
  assert.equal(results.length, 1);
  assert.deepEqual(results.map((result) => result.citationIndex), [1]);
});

test("hybrid retrieval retains vector fallback when no exact text match exists", () => {
  const semantic = [{
    noteId: "semantic-result",
    projectId: "research",
    projectName: "Research",
    title: "Related concept",
    text: "A conceptually related note",
    score: 0.72,
    citationIndex: 1,
  }];

  const results = mergeKnowledgeSources([], semantic, { limit: 8 });

  assert.deepEqual(results.map((result) => result.noteId), ["semantic-result"]);
});

test("recommends a save workspace from scope, citations, or a clear content match", () => {
  assert.equal(recommendProjectForKnowledgeDraft(
    { title: "Anything", content: "A new note" },
    projects,
    { scope: { kind: "projects", projectIds: ["research"] } },
  ), "research");

  assert.equal(recommendProjectForKnowledgeDraft(
    { title: "Synthesis", content: "A cross-note conclusion" },
    projects,
    { sourceNoteIds: ["launch", "pricing"] },
  ), "strategy");

  assert.equal(recommendProjectForKnowledgeDraft(
    { title: "Interview setup", content: "Customers want fewer configuration steps" },
    projects,
  ), "research");
});

test("does not recommend a workspace when content signals are ambiguous", () => {
  const ambiguousProjects = [
    { id: "alpha", name: "Alpha", blocks: [{ id: "alpha-note", text: "Shared planning topic" }] },
    { id: "beta", name: "Beta", blocks: [{ id: "beta-note", text: "Shared planning topic" }] },
  ];
  assert.equal(recommendProjectForKnowledgeDraft(
    { title: "Shared planning", content: "A note about the shared topic" },
    ambiguousProjects,
  ), null);
});

test("builds a cited no-spend social-content fixture from retrieved sources", () => {
  const sources = retrieveKnowledge("launch post", projects, { limit: 3 });
  const result = buildCitedAnswerFixture(
    "Turn my launch notes into a LinkedIn post",
    sources,
  );

  assert.match(result.answer, /knowledge/i);
  assert.deepEqual(result.citations, sources.map((source) => source.noteId));
  assert.equal(result.artifact?.kind, "social-content");
  assert.equal(result.artifact?.format, "post");
  assert.equal(result.outputKind, "creation");
  assert.equal(result.artifact?.platform, "linkedin");
  assert.match(result.artifact?.content ?? "", /#ProductLaunch/);
});

test("normalizes persisted threads and rejects malformed messages", () => {
  const normalized = normalizeChatThreads([
    {
      id: "thread-1",
      title: "Launch story",
      createdAt: 10,
      updatedAt: 20,
      messages: [
        { id: "m1", role: "user", content: "What should we share?", createdAt: 11 },
        { id: "m2", role: "system", content: "ignore", createdAt: 12 },
        { id: "m3", role: "assistant", content: "Lead with clarity.", createdAt: 13 },
      ],
    },
    { id: "", messages: [] },
  ]);

  assert.equal(normalized.length, 1);
  assert.deepEqual(normalized[0].messages.map((message) => message.id), ["m1", "m3"]);
  assert.deepEqual(normalized[0].messages.map((message) => message.outputKind), ["answer", "answer"]);
  assert.equal(normalized[0].scope.kind, "all");
});

test("only offers insight saving for an explicit validated insight draft", () => {
  assert.equal(shouldOfferInsightSave({
    role: "assistant",
    content: "Hello! What would you like to do?",
    sourceNoteIds: [],
    outputKind: "answer",
  }), false);
  assert.equal(shouldOfferInsightSave({
    role: "assistant",
    content: "Here is a cited ordinary answer [1].",
    sourceNoteIds: ["note-1"],
    outputKind: "answer",
  }), false);
  assert.equal(shouldOfferInsightSave({
    role: "assistant",
    content: "I found a pattern in your notes [1].",
    sourceNoteIds: ["note-1"],
    outputKind: "insight",
    insightDraft: {
      title: "Clarity compounds",
      content: "Clarity appears to improve both setup and launch confidence.",
      sourceNoteIds: ["note-1"],
    },
  }), true);
  assert.equal(shouldOfferInsightSave({
    role: "assistant",
    content: "A cited social post [1].",
    sourceNoteIds: ["note-1"],
    outputKind: "creation",
    insightDraft: {
      title: "Wrongly retained insight",
      content: "This must not be saveable as an insight.",
      sourceNoteIds: ["note-1"],
    },
    artifact: { kind: "social-post" },
  }), false);
});

test("old persisted cited answers do not become insights", () => {
  const [thread] = normalizeChatThreads([{
    id: "old-thread",
    title: "Old chat",
    createdAt: 1,
    updatedAt: 2,
    messages: [{
      id: "old-answer",
      role: "assistant",
      content: "A previously cited answer [1].",
      createdAt: 2,
      sourceNoteIds: ["note-1"],
    }],
  }]);

  assert.equal(thread.messages[0].outputKind, "answer");
  assert.equal(shouldOfferInsightSave(thread.messages[0]), false);
});

test("persists a stopped user message without changing its output classification", () => {
  const [thread] = normalizeChatThreads([{
    id: "stopped-thread",
    messages: [{
      id: "stopped-message",
      role: "user",
      content: "Create a post",
      status: "stopped",
    }],
  }]);

  assert.equal(thread.messages[0].status, "stopped");
  assert.equal(thread.messages[0].outputKind, "answer");
});

test("normalization requires structured payloads for typed output kinds", () => {
  const [thread] = normalizeChatThreads([{
    id: "typed-thread",
    messages: [
      { id: "bad-insight", role: "assistant", content: "Claimed insight", outputKind: "insight" },
      {
        id: "creation",
        role: "assistant",
        content: "Created a post [1].",
        outputKind: "insight",
        insightDraft: { title: "Ignore me", content: "Not the output", sourceNoteIds: ["note-1"] },
        artifact: { kind: "social-post", platform: "linkedin", title: "Post", content: "Post copy" },
      },
    ],
  }]);

  assert.equal(thread.messages[0].outputKind, "answer");
  assert.equal(thread.messages[1].outputKind, "creation");
  assert.equal(shouldOfferInsightSave(thread.messages[1]), false);
});

test("normalization removes repeated note prose and duplicate activity", () => {
  const repeatedDraft = "**What we did**\n\n- Fixed the design system.";
  const [thread] = normalizeChatThreads([{
    id: "note-thread",
    messages: [{
      id: "note-response",
      role: "assistant",
      content: `I've drafted the note.\n\n${repeatedDraft}\n\nWould you like to save it?`,
      outputKind: "knowledge-note",
      noteDraft: { title: "Weekly update", content: repeatedDraft },
      agentEvents: [
        { runId: "run-1", type: "tool_completed", toolName: "draft_knowledge_note", at: 1, message: "Prepared a knowledge-note draft" },
        { runId: "run-1", type: "tool_completed", toolName: "activate_skill", at: 2, message: "Activated knowledge building" },
        { runId: "run-1", type: "tool_completed", toolName: "draft_knowledge_note", at: 3, message: "Prepared a knowledge-note draft" },
      ],
    }],
  }]);

  const message = thread.messages[0];
  assert.equal(message.content, "I drafted the note. Review it below, then save when ready.");
  assert.equal(message.content.includes(repeatedDraft), false);
  assert.deepEqual(message.agentEvents.map((event) => event.toolName), ["draft_knowledge_note", "activate_skill"]);
  assert.equal(message.noteDraft.content, repeatedDraft);
});

test("deduplicates activity by tool while preserving the latest result", () => {
  const events = dedupeAgentEvents([
    { runId: "run-1", type: "tool_completed", toolName: "search_fikr_knowledge", at: 1, message: "Found 3 relevant notes" },
    { runId: "run-1", type: "tool_completed", toolName: "search_fikr_knowledge", at: 2, message: "Found 8 relevant notes" },
  ]);

  assert.equal(events.length, 1);
  assert.equal(events[0].message, "Found 8 relevant notes");
});

test("creates collision-safe explicit note and creation records", () => {
  const note = createKnowledgeNoteFromAnswer({
    answer: "Lead with the customer problem.",
    threadId: "launch-story",
    existingIds: ["chat-launch-story-500"],
    now: 500,
  });
  const creation = createCreationFromArtifact({
    artifact: {
      kind: "social-post",
      platform: "linkedin",
      title: "Launch story",
      content: "A clearer way to launch.",
    },
    threadId: "launch-story",
    existingIds: ["creation-launch-story-500"],
    now: 500,
  });

  assert.equal(note.id, "chat-launch-story-500-2");
  assert.equal(note.fromChat, true);
  assert.equal(note.isEnriching, false);
  assert.equal(creation.id, "creation-launch-story-500-2");
  assert.equal(creation.status, "done");
  assert.equal(creation.platform, "linkedin");
  assert.equal(creation.outputMarkdown, "# Launch story\n\nA clearer way to launch.");
});

test("creation persistence deduplicates matching platform content across chats", () => {
  const artifact = {
    kind: "social-post",
    platform: "x",
    title: "A short update",
    content: "One exact post.",
    sourceNoteIds: ["note-1"],
  };
  const creation = createCreationFromArtifact({ artifact, threadId: "first", now: 500 });

  assert.equal(creation.platform, "x");
  assert.equal(creationMatchesArtifact(creation, artifact), true);
  assert.equal(creationMatchesArtifact(creation, { ...artifact, platform: "linkedin" }), false);
  assert.equal(creationMatchesArtifact(creation, { ...artifact, content: "Different post." }), false);
});

test("authored creation H1 stays the persisted title and still deduplicates", () => {
  const artifact = {
    kind: "social-post",
    platform: "linkedin",
    title: "Fallback title",
    content: "# Authored title\n\nThe complete post.",
    sourceNoteIds: [],
  };
  const creation = createCreationFromArtifact({ artifact, threadId: "headed", now: 600 });

  assert.equal(creation.name, "Authored title");
  assert.equal(creation.outputMarkdown, artifact.content);
  assert.equal(creationMatchesArtifact(creation, artifact), true);
});
