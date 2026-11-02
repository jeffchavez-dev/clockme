"use client";

// Local-first store. All state lives in localStorage under one key and is read
// through useSyncExternalStore, so every component sees the same snapshot and
// other tabs stay in sync via the storage event. Swapping this for Supabase
// later means replacing load/persist; the actions keep their shape.

import { useSyncExternalStore } from "react";

export type Entry = {
  id: string;
  description: string;
  /** ISO timestamp. */
  start: string;
  /** ISO timestamp; null while the timer is running. */
  end: string | null;
  projectId: string | null;
  tagIds: string[];
  billable: boolean;
};

export type Project = { id: string; name: string; color: string };
export type Tag = { id: string; name: string };

export type Settings = { member: string; workspace: string };

export type State = {
  ready: boolean;
  entries: Entry[];
  projects: Project[];
  tags: Tag[];
  settings: Settings;
};

const KEY = "clockme:v1";

export const PROJECT_COLORS = [
  "#C2410C", // burnt orange
  "#0F766E", // teal
  "#4338CA", // indigo
  "#A16207", // ochre
  "#BE185D", // raspberry
  "#15803D", // green
  "#334155", // slate
  "#7C3AED", // violet
];

const EMPTY: State = {
  ready: false,
  entries: [],
  projects: [],
  tags: [],
  settings: { member: "Me", workspace: "My Workspace" },
};

let state: State = EMPTY;
const listeners = new Set<() => void>();

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...EMPTY, ...JSON.parse(raw), ready: true };
  } catch {
    // Corrupt or blocked storage: start clean rather than crash.
  }
  return { ...EMPTY, ready: true };
}

function persist() {
  try {
    const { entries, projects, tags, settings } = state;
    localStorage.setItem(KEY, JSON.stringify({ entries, projects, tags, settings }));
  } catch {
    // Storage full or blocked; the in-memory state still works for this tab.
  }
}

function emit() {
  for (const l of listeners) l();
}

function set(next: (s: State) => State) {
  state = next(state);
  persist();
  emit();
}

function subscribe(listener: () => void) {
  if (!state.ready) state = load();
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      state = load();
      emit();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  if (!state.ready) state = load();
  return state;
}

export function useStore(): State {
  return useSyncExternalStore(subscribe, getSnapshot, () => EMPTY);
}

const uid = () => crypto.randomUUID();

// ─── Actions ────────────────────────────────────────────────────────────────

export type Draft = Pick<Entry, "description" | "projectId" | "tagIds" | "billable">;

export function startTimer(draft: Draft) {
  const now = new Date().toISOString();
  set((s) => ({
    ...s,
    entries: [
      { id: uid(), ...draft, start: now, end: null },
      // Only one timer runs at a time; starting a new one stops the old one.
      ...s.entries.map((e) => (e.end === null ? { ...e, end: now } : e)),
    ],
  }));
}

export function stopTimer() {
  const now = new Date().toISOString();
  set((s) => ({ ...s, entries: s.entries.map((e) => (e.end === null ? { ...e, end: now } : e)) }));
}

export function addEntry(entry: Omit<Entry, "id">) {
  set((s) => ({ ...s, entries: [{ id: uid(), ...entry }, ...s.entries] }));
}

export function updateEntry(id: string, patch: Partial<Omit<Entry, "id">>) {
  set((s) => ({ ...s, entries: s.entries.map((e) => (e.id === id ? { ...e, ...patch } : e)) }));
}

export function deleteEntry(id: string): Entry | undefined {
  const removed = state.entries.find((e) => e.id === id);
  set((s) => ({ ...s, entries: s.entries.filter((e) => e.id !== id) }));
  return removed;
}

export function restoreEntry(entry: Entry) {
  set((s) => ({ ...s, entries: [entry, ...s.entries] }));
}

export function addProject(name: string): Project {
  const project = { id: uid(), name: name.trim(), color: PROJECT_COLORS[state.projects.length % PROJECT_COLORS.length] };
  set((s) => ({ ...s, projects: [...s.projects, project] }));
  return project;
}

export function addTag(name: string): Tag {
  const tag = { id: uid(), name: name.trim() };
  set((s) => ({ ...s, tags: [...s.tags, tag] }));
  return tag;
}

export function updateSettings(patch: Partial<Settings>) {
  set((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
}

export function replaceAll(next: Omit<State, "ready">) {
  set(() => ({ ...next, ready: true }));
}

// ─── Selectors ──────────────────────────────────────────────────────────────

export function durationOf(e: Entry, now = Date.now()): number {
  return (e.end ? Date.parse(e.end) : now) - Date.parse(e.start);
}

export function runningEntry(s: State): Entry | undefined {
  return s.entries.find((e) => e.end === null);
}
