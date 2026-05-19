"use client";

import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";

// ─── Public Types ────────────────────────────────────────────────────────────

export interface SearchResult {
  blockId: string;
  projectId: string;
  projectName: string;
  text: string;
  snippet: string;
  score: number;
  contentType: string;
}

export interface SearchState {
  query: string;
  results: SearchResult[];
  selectedIndex: number;
  isSearching: boolean;
  lastSearchId: string | null;
  mode: "semantic" | "text" | "hybrid";
  modelStatus: "idle" | "loading" | "ready" | "error";
  recentSearches: string[];
}

export type SearchAction =
  | { type: "SET_QUERY"; payload: string }
  | { type: "SET_RESULTS"; payload: SearchResult[] }
  | {
      type: "SET_SELECTED";
      payload: { direction: "up" | "down" | "index"; index?: number };
    }
  | { type: "SET_SEARCHING"; payload: boolean }
  | { type: "SET_MODE"; payload: SearchState["mode"] }
  | { type: "SET_MODEL_STATUS"; payload: SearchState["modelStatus"] }
  | { type: "RESET" }
  | { type: "RESTORE_LAST"; payload: PersistedSearch }
  | { type: "ADD_RECENT_SEARCH"; payload: string }
  | { type: "CLEAR_RECENT_SEARCHES" }
  | { type: "LOAD_RECENT_SEARCHES"; payload: string[] };

export interface PersistedSearch {
  query: string;
  results: SearchResult[];
  selectedIndex: number;
  lastSearchId: string | null;
  mode: SearchState["mode"];
}

// ─── Constants ───────────────────────────────────────────────────────────────

const STORAGE_KEY = "fikr-studio_last_search";

const DEFAULT_STATE: SearchState = {
  query: "",
  results: [],
  selectedIndex: 0,
  isSearching: false,
  lastSearchId: null,
  mode: "hybrid",
  modelStatus: "idle",
  recentSearches: [],
};

// ─── Helper Functions (pure, not hooks) ──────────────────────────────────────

/**
 * Generate a UUID v4 for search session tracking.
 */
export function createSearchId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Create a short excerpt from text, centered around the first few characters.
 * Attempts to break on word boundaries and adds ellipsis where truncated.
 */
export function generateSnippet(text: string, maxLength: number = 120): string {
  if (!text || text.length <= maxLength) return text;

  // Try to find a good break point near the end
  let end = Math.min(maxLength, text.length);

  // Look backwards for a space to avoid cutting words in half
  const spaceIndex = text.lastIndexOf(" ", end);
  if (spaceIndex > maxLength * 0.5) {
    end = spaceIndex;
  }

  return text.slice(0, end).trim() + "…";
}

// ─── Reducer ─────────────────────────────────────────────────────────────────

function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case "SET_QUERY":
      return {
        ...state,
        query: action.payload,
        selectedIndex: 0,
      };

    case "SET_RESULTS": {
      return {
        ...state,
        results: action.payload,
        selectedIndex:
          state.selectedIndex >= action.payload.length
            ? action.payload.length > 0
              ? action.payload.length - 1
              : 0
            : state.selectedIndex,
      };
    }

    case "SET_SELECTED": {
      const { direction, index } = action.payload;

      if (direction === "index" && index !== undefined) {
        return {
          ...state,
          selectedIndex: Math.max(0, Math.min(index, state.results.length - 1)),
        };
      }

      if (state.results.length === 0) return state;

      if (direction === "up") {
        const newIndex =
          state.selectedIndex === 0
            ? state.results.length - 1
            : state.selectedIndex - 1;
        return { ...state, selectedIndex: newIndex };
      }

      if (direction === "down") {
        const newIndex =
          state.selectedIndex >= state.results.length - 1
            ? 0
            : state.selectedIndex + 1;
        return { ...state, selectedIndex: newIndex };
      }

      return state;
    }

    case "SET_SEARCHING":
      return { ...state, isSearching: action.payload };

    case "SET_MODE":
      return { ...state, mode: action.payload };

    case "SET_MODEL_STATUS":
      return { ...state, modelStatus: action.payload };

    case "RESET":
      return { ...DEFAULT_STATE };

    case "RESTORE_LAST": {
      const { query, results, selectedIndex, lastSearchId, mode } =
        action.payload;
      return {
        query,
        results,
        selectedIndex:
          results.length > 0 ? Math.min(selectedIndex, results.length - 1) : 0,
        isSearching: false,
        lastSearchId,
        mode,
        modelStatus: "idle",
        recentSearches: state.recentSearches,
      };
    }

    case "ADD_RECENT_SEARCH": {
      const newSearches = [
        action.payload,
        ...state.recentSearches.filter((s) => s !== action.payload),
      ].slice(0, 5);
      return { ...state, recentSearches: newSearches };
    }

    case "CLEAR_RECENT_SEARCHES":
      return { ...state, recentSearches: [] };

    case "LOAD_RECENT_SEARCHES":
      return { ...state, recentSearches: action.payload };

    default:
      return state;
  }
}

// ─── Context + Provider ──────────────────────────────────────────────────────

interface SearchContextValue {
  state: SearchState;
  dispatch: React.Dispatch<SearchAction>;
  // Convenience wrappers
  setQuery: (query: string) => void;
  setResults: (results: SearchResult[]) => void;
  selectNext: () => void;
  selectPrev: () => void;
  selectIndex: (index: number) => void;
  setSearching: (isSearching: boolean) => void;
  setMode: (mode: SearchState["mode"]) => void;
  setModelStatus: (status: SearchState["modelStatus"]) => void;
  reset: () => void;
  currentSearchId: string | null;
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

/**
 * Persist the current search state to sessionStorage so it can
 * be restored on next load.
 */
function persistState(state: SearchState): void {
  if (typeof window === "undefined") return;
  try {
    const payload: PersistedSearch = {
      query: state.query,
      results: state.results,
      selectedIndex: state.selectedIndex,
      lastSearchId: state.lastSearchId,
      mode: state.mode,
    };
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    localStorage.setItem("fikr-studio_recent_searches", JSON.stringify(state.recentSearches));
  } catch {
    // sessionStorage may be unavailable (private browsing, quota)
  }
}

/**
 * Load a previously persisted search from sessionStorage, or null.
 */
function loadPersistedState(): PersistedSearch | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedSearch;
  } catch {
    return null;
  }
}

export function SearchProvider({ children }: { children: ReactNode }) {
  // Determine initial state: restore from sessionStorage or start fresh
  const initialPersisted = loadPersistedState();

  const [state, dispatch] = useReducer(
    searchReducer,
    DEFAULT_STATE,
    (): SearchState => {
      if (initialPersisted) {
        const restored: SearchState = {
          query: initialPersisted.query,
          results: initialPersisted.results,
          selectedIndex:
            initialPersisted.results.length > 0
              ? Math.min(
                  initialPersisted.selectedIndex,
                  initialPersisted.results.length - 1,
                )
              : 0,
          isSearching: false,
          lastSearchId: initialPersisted.lastSearchId,
          mode: initialPersisted.mode,
          modelStatus: "idle",
          recentSearches: [],
        };
        return restored;
      }
      return DEFAULT_STATE;
    },
  );

  // Load recent searches from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const raw = localStorage.getItem("fikr-studio_recent_searches");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            dispatch({ type: "LOAD_RECENT_SEARCHES", payload: parsed });
          }
        }
      } catch {
        // noop
      }
    }
  }, []);

  // Persist state changes to sessionStorage
  useEffect(() => {
    persistState(state);
  }, [state]);

  // Convenience dispatch wrappers
  const setQuery = useCallback((query: string) => {
    dispatch({ type: "SET_QUERY", payload: query });
  }, []);

  const setResults = useCallback((results: SearchResult[]) => {
    dispatch({ type: "SET_RESULTS", payload: results });
  }, []);

  const selectNext = useCallback(() => {
    dispatch({ type: "SET_SELECTED", payload: { direction: "down" } });
  }, []);

  const selectPrev = useCallback(() => {
    dispatch({ type: "SET_SELECTED", payload: { direction: "up" } });
  }, []);

  const selectIndex = useCallback((index: number) => {
    dispatch({ type: "SET_SELECTED", payload: { direction: "index", index } });
  }, []);

  const setSearching = useCallback((isSearching: boolean) => {
    dispatch({ type: "SET_SEARCHING", payload: isSearching });
  }, []);

  const setMode = useCallback((mode: SearchState["mode"]) => {
    dispatch({ type: "SET_MODE", payload: mode });
  }, []);

  const setModelStatus = useCallback((status: SearchState["modelStatus"]) => {
    dispatch({ type: "SET_MODEL_STATUS", payload: status });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: "RESET" });
    if (typeof window !== "undefined") {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* noop */
      }
    }
  }, []);

  const currentSearchId = state.lastSearchId;

  const addRecentSearch = useCallback((query: string) => {
    dispatch({ type: "ADD_RECENT_SEARCH", payload: query });
  }, []);

  const clearRecentSearches = useCallback(() => {
    dispatch({ type: "CLEAR_RECENT_SEARCHES" });
  }, []);

  const value = {
    state,
    dispatch,
    setQuery,
    setResults,
    selectNext,
    selectPrev,
    selectIndex,
    setSearching,
    setMode,
    setModelStatus,
    reset,
    currentSearchId,
    addRecentSearch,
    clearRecentSearches,
  };

  return React.createElement(SearchContext.Provider, { value }, children);
}

// ─── Hook ────────────────────────────────────────────────────────────────────

/**
 * Access the search state and dispatch from anywhere within a SearchProvider.
 * Throws if called outside the provider.
 */
export function useSearch(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) {
    throw new Error("useSearch must be used within a SearchProvider");
  }
  return ctx;
}
