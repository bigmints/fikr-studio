"use client";

import { useState, useCallback, useEffect } from "react";
import type { TextBlock } from "@/components/tile-card";
import type { StudioProject, GenerateParams } from "@/lib/generate/types";
import { limitWords } from "@/lib/utils";
import { StudioIdeation } from "./studio-ideation";
import { StudioGenerateView } from "./studio-generate-view";
import { StudioHome } from "./studio-home";

type Screen = "home" | "ideation" | "editor";

interface Props {
  studioProjects: StudioProject[];
  setStudioProjects: (fn: (prev: StudioProject[]) => StudioProject[]) => void;
  intelBlocks: TextBlock[];
  onHighlightNote?: (noteId: string) => void;
  activeProjectId: string;
  setActiveProjectId: (id: string) => void;
  onStartGeneration: (
    projectId: string,
    params: GenerateParams,
    projectName: string,
  ) => void;
  onSaveVersion: (projectId: string, label: string, markdown: string, isManual: boolean) => void;
  onRevertToVersion: (projectId: string, versionId: string, currentMarkdown: string) => void;
  /** Called whenever studio projects change — handles both Electron IPC and localStorage. */
  onPersist: (updated: StudioProject[]) => void;
}


export function StudioRoot({
  studioProjects,
  setStudioProjects,
  intelBlocks,
  onHighlightNote,
  activeProjectId,
  setActiveProjectId,
  onStartGeneration,
  onSaveVersion,
  onRevertToVersion,
  onPersist,
}: Props) {
  const [screen, setScreen] = useState<Screen>("home");

  const activeProject = studioProjects.find((p) => p.id === activeProjectId) ?? null;

  // Sync screen state when activeProjectId changes externally (e.g. from sidebar)
  useEffect(() => {
    if (activeProjectId) {
      const proj = studioProjects.find(p => p.id === activeProjectId);
      if (proj) {
        setScreen(proj.status === "ideating" ? "ideation" : "editor");
      }
    } else {
      setScreen("home");
    }
  }, [activeProjectId]); // Only depend on activeProjectId to avoid overriding user navigation

  // ── Create new project ─────────────────────────────────────────────────────
  const handleNewProject = useCallback((project: StudioProject) => {
    setStudioProjects((prev) => {
      const updated = [project, ...prev];
      onPersist(updated);
      return updated;
    });
    setActiveProjectId(project.id);
    setScreen("ideation");
  }, [setStudioProjects, setActiveProjectId, onPersist]);

  // ── Open existing project ──────────────────────────────────────────────────
  const handleOpenProject = useCallback((id: string) => {
    setActiveProjectId(id);
    // The useEffect above will handle the screen switch
  }, [setActiveProjectId]);

  // ── Archive / duplicate ────────────────────────────────────────────────────
  const handleArchive = useCallback((id: string) => {
    setStudioProjects((prev) => {
      const updated = prev.map((p) =>
        p.id === id ? { ...p, archived: true, updatedAt: Date.now() } : p,
      );
      onPersist(updated);
      return updated;
    });
  }, [setStudioProjects, onPersist]);

  const handleUnarchive = useCallback((id: string) => {
    setStudioProjects((prev) => {
      const updated = prev.map((p) =>
        p.id === id ? { ...p, archived: false, updatedAt: Date.now() } : p,
      );
      onPersist(updated);
      return updated;
    });
  }, [setStudioProjects, onPersist]);

  const handleDuplicate = useCallback((id: string) => {
    const proj = studioProjects.find((p) => p.id === id);
    if (!proj) return;
    const copy: StudioProject = {
      ...proj,
      id:           Math.random().toString(36).substring(2, 10),
      name:         `${proj.name} (copy)`,
      status:       "ideating",
      outputMarkdown: undefined,
      citations:    undefined,
      error:        undefined,
      archived:     false,
      versions:     undefined,
      createdAt:    Date.now(),
      updatedAt:    Date.now(),
    };
    setStudioProjects((prev) => {
      const updated = [copy, ...prev];
      onPersist(updated);
      return updated;
    });
  }, [studioProjects, setStudioProjects, onPersist]);

  // ── Trigger generation (from ideation OR from editor Regenerate button) ────
  const handleGenerate = useCallback((params: GenerateParams) => {
    const projectId = activeProjectId;
    const proj = studioProjects.find((p) => p.id === projectId);
    if (!proj) return;

    const rawName = proj.name.startsWith("New ") && params.topicTitle ? params.topicTitle : proj.name;
    const newName = limitWords(rawName, 3);

    setStudioProjects((prev) => {
      const updated = prev.map((p) =>
        p.id === projectId
          ? {
              ...p,
              name:           newName,
              status:         "generating" as const,
              lastParams:     params,
              outputMarkdown: undefined,
              error:          undefined,
              updatedAt:      Date.now(),
            }
          : p,
      );
      onPersist(updated);
      return updated;
    });

    onStartGeneration(projectId, params, newName);
    setScreen("editor");
  }, [activeProjectId, studioProjects, setStudioProjects, onStartGeneration]);

  // ── Regenerate from editor (params may have been adjusted in sidebar) ──────
  const handleRegenerate = useCallback((params: GenerateParams, currentMarkdown?: string) => {
    const projectId = activeProjectId;
    const proj = studioProjects.find((p) => p.id === projectId);
    if (!proj) return;

    // Snapshot before overwriting
    if (currentMarkdown?.trim()) {
      onSaveVersion(projectId, "Before regeneration", currentMarkdown, false);
    }

    const rawName = proj.name.startsWith("New ") && params.topicTitle ? params.topicTitle : proj.name;
    const newName = limitWords(rawName, 3);

    setStudioProjects((prev) => {
      const updated = prev.map((p) =>
        p.id === projectId
          ? {
              ...p,
              name:           newName,
              status:         "generating" as const,
              lastParams:     params,
              outputMarkdown: undefined,
              error:          undefined,
              updatedAt:      Date.now(),
            }
          : p,
      );
      onPersist(updated);
      return updated;
    });

    onStartGeneration(projectId, params, newName);
    // Stay on editor — it will switch to generating state reactively
  }, [activeProjectId, studioProjects, setStudioProjects, onStartGeneration, onSaveVersion, onPersist]);

  // ── Update project params (from sidebar sliders) ───────────────────────────
  const handleUpdateParams = useCallback((updatedParams: Partial<GenerateParams>) => {
    setStudioProjects((prev) => {
      const updated = prev.map((p) =>
        p.id === activeProjectId
          ? {
              ...p,
              lastParams: { ...resolveParams(p), ...updatedParams },
              tone:       updatedParams.tone     ?? p.tone,
              depth:      updatedParams.depth    ?? p.depth,
              audience:   updatedParams.audience ?? p.audience,
              updatedAt:  Date.now(),
            }
          : p,
      );
      onPersist(updated);
      return updated;
    });
  }, [activeProjectId, setStudioProjects, onPersist]);

  function resolveParams(proj: StudioProject): GenerateParams {
    if (proj.lastParams) return proj.lastParams;
    return {
      mode:         proj.mode,
      platform:     proj.platform,
      tone:         proj.tone,
      depth:        proj.depth,
      audience:     proj.audience,
      topicTitle:   proj.selectedTopicTitle ?? "",
      customPrompt: proj.customPrompt ?? "",
      noteContext:  "",
    };
  }

  return (
    <div className="flex-1 flex flex-col w-full h-full overflow-hidden bg-background">
      {screen === "home" && (
        <StudioHome
          projects={studioProjects}
          onNewProject={handleNewProject}
          onOpenProject={handleOpenProject}
          onArchive={handleArchive}
          onUnarchive={handleUnarchive}
          onDuplicate={handleDuplicate}
        />
      )}

      {screen === "ideation" && activeProject && (
        <StudioIdeation
          project={activeProject}
          intelBlocks={intelBlocks}
          onBack={() => { setActiveProjectId(""); setScreen("home"); }}
          onGenerate={handleGenerate}
        />
      )}

      {screen === "editor" && activeProject && (
        <StudioGenerateView
          key={activeProject.id}
          project={activeProject}
          params={resolveParams(activeProject)}
          onBack={() => { setActiveProjectId(""); setScreen("home"); }}
          onRegenerate={handleRegenerate}
          onUpdateParams={handleUpdateParams}
          onHighlightNote={onHighlightNote}
          onSaveVersion={(label, markdown, isManual) =>
            onSaveVersion(activeProject.id, label, markdown, isManual)
          }
          onRevertToVersion={(versionId, currentMarkdown) =>
            onRevertToVersion(activeProject.id, versionId, currentMarkdown)
          }
        />
      )}
    </div>
  );
}
