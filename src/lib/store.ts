"use client";

// One store, two backends.
//
// Every change is an Op. applyOp() updates the in-memory state immediately so
// the UI never waits on the network. In local mode the state is then written
// to localStorage. In cloud mode the op also goes into a persisted outbox that
// is pushed to Supabase in order and retried when the network comes back.
// Changes from other devices arrive over Supabase realtime, so a timer started
// on the desktop shows up running on the phone.

import { useSyncExternalStore } from "react";
import { fetchAll, isPermanent, sendOp, supabase, entryFromRow, type Snapshot } from "./cloud";
import type { RealtimeChannel, User } from "@supabase/supabase-js";

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

export type Data = { entries: Entry[]; projects: Project[]; tags: Tag[]; settings: Settings };

export type SyncStatus = "synced" | "saving" | "offline";

export type State = Data & {
  /** Data (or, in cloud mode, the signed-out state) is known. */
  ready: boolean;
  mode: "local" | "cloud";
  user: { id: string; email: string } | null;
  sync: SyncStatus;
};

export type Op =
  | { t: "entry"; row: Entry }
  | { t: "entry-del"; id: string }
  | { t: "project"; row: Project }
  | { t: "tag"; row: Tag }
  | { t: "settings"; row: Settings }
  | { t: "replace"; data: Data };

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

const DEFAULT_SETTINGS: Settings = { member: "Me", workspace: "My Workspace" };
const EMPTY_DATA: Data = { entries: [], projects: [], tags: [], settings: DEFAULT_SETTINGS };

const SERVER_STATE: State = { ...EMPTY_DATA, ready: false, mode: supabase ? "cloud" : "local", user: null, sync: "synced" };

let state: State = SERVER_STATE;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function setState(next: State) {
  state = next;
  emit();
}

// ─── Op application ─────────────────────────────────────────────────────────

const upsertBy = <T extends { id: string }>(list: T[], row: T, prepend = false) =>
  list.some((x) => x.id === row.id) ? list.map((x) => (x.id === row.id ? row : x)) : prepend ? [row, ...list] : [...list, row];

function applyOp(d: Data, op: Op): Data {
  switch (op.t) {
    case "entry":
      return { ...d, entries: upsertBy(d.entries, op.row, true) };
    case "entry-del":
      return { ...d, entries: d.entries.filter((e) => e.id !== op.id) };
    case "project":
      return { ...d, projects: upsertBy(d.projects, op.row) };
    case "tag":
      return { ...d, tags: upsertBy(d.tags, op.row) };
    case "settings":
      return { ...d, settings: op.row };
    case "replace":
      return op.data;
  }
}

const opId = (op: Op) => (op.t === "entry" || op.t === "project" || op.t === "tag" ? op.row.id : op.t === "entry-del" ? op.id : op.t);

// ─── Persistence helpers ────────────────────────────────────────────────────

const LOCAL_KEY = "clockme:v1";
const cacheKey = (uid: string) => `clockme:cache:${uid}`;
const outboxKey = (uid: string) => `clockme:outbox:${uid}`;

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked; in-memory state still works for this tab.
  }
}

const dataOf = ({ entries, projects, tags, settings }: State): Data => ({ entries, projects, tags, settings });

// ─── Local mode ─────────────────────────────────────────────────────────────

function initLocal() {
  setState({ ...state, ...EMPTY_DATA, ...read<Data>(LOCAL_KEY), ready: true });
  window.addEventListener("storage", (e) => {
    if (e.key === LOCAL_KEY) setState({ ...state, ...EMPTY_DATA, ...read<Data>(LOCAL_KEY) });
  });
}

// ─── Cloud mode ─────────────────────────────────────────────────────────────

let outbox: Op[] = [];
let flushing = false;
let channel: RealtimeChannel | null = null;

function syncStatus(): SyncStatus {
  if (typeof navigator !== "undefined" && !navigator.onLine) return "offline";
  return outbox.length ? "saving" : "synced";
}

function saveOutbox() {
  if (state.user) write(outboxKey(state.user.id), outbox);
  if (state.sync !== syncStatus()) setState({ ...state, sync: syncStatus() });
}

function enqueue(op: Op) {
  // Collapse repeated edits to the same row (e.g. typing a description) into
  // one pending write. The head of the queue may be in flight, so leave it.
  const id = opId(op);
  const i = outbox.findIndex((o, idx) => idx > 0 && o.t === op.t && opId(o) === id);
  if (i > 0 && op.t !== "replace") outbox[i] = op;
  else outbox.push(op);
  saveOutbox();
  void flush();
}

async function flush() {
  if (flushing || !supabase || !state.user) return;
  flushing = true;
  const userId = state.user.id;
  try {
    while (outbox.length && state.user?.id === userId) {
      const error = await sendOp(supabase, userId, outbox[0]);
      if (error && !isPermanent(error)) break; // network trouble: retry later
      if (error) console.error("clockme: dropped a change the server rejected", error, outbox[0]);
      outbox.shift();
      saveOutbox();
    }
  } finally {
    flushing = false;
    if (state.sync !== syncStatus()) setState({ ...state, sync: syncStatus() });
  }
}

/** Server data with not-yet-sent local changes replayed on top. */
function merge(remote: Snapshot): Data {
  const base: Data = { entries: remote.entries, projects: remote.projects, tags: remote.tags, settings: remote.settings ?? state.settings };
  return outbox.reduce(applyOp, base);
}

async function refresh() {
  if (!supabase || !state.user) return;
  try {
    const remote = await fetchAll(supabase);
    const data = merge(remote);
    setState({ ...state, ...data, ready: true, sync: syncStatus() });
    write(cacheKey(state.user.id), data);
  } catch (e) {
    console.warn("clockme: refresh failed", e);
    setState({ ...state, ready: true, sync: syncStatus() });
  }
  void flush();
}

function hasPending(id: string) {
  return outbox.some((o) => opId(o) === id || o.t === "replace");
}

function subscribeRealtime(userId: string) {
  if (!supabase) return;
  const onRow = (table: "entries" | "projects" | "tags" | "settings") => (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
    if (state.user?.id !== userId) return;
    let d = dataOf(state);
    if (payload.eventType === "DELETE") {
      const id = payload.old.id as string | undefined;
      if (!id || hasPending(id)) return;
      if (table === "entries") d = { ...d, entries: d.entries.filter((e) => e.id !== id) };
      if (table === "projects") d = { ...d, projects: d.projects.filter((p) => p.id !== id) };
      if (table === "tags") d = { ...d, tags: d.tags.filter((t) => t.id !== id) };
    } else {
      const row = payload.new;
      if (table === "settings") {
        if (hasPending("settings")) return;
        d = { ...d, settings: { member: row.member as string, workspace: row.workspace as string } };
      } else {
        const id = row.id as string;
        if (hasPending(id)) return; // our own newer edit is still on its way up
        if (table === "entries") d = applyOp(d, { t: "entry", row: entryFromRow(row as Parameters<typeof entryFromRow>[0]) });
        if (table === "projects") d = applyOp(d, { t: "project", row: { id, name: row.name as string, color: row.color as string } });
        if (table === "tags") d = applyOp(d, { t: "tag", row: { id, name: row.name as string } });
      }
    }
    setState({ ...state, ...d });
    write(cacheKey(userId), d);
  };

  channel = supabase.channel(`clockme-${userId}`);
  // RLS limits inserts/updates to this user's rows; deletes carry only the id.
  for (const table of ["entries", "projects", "tags", "settings"] as const) {
    channel.on("postgres_changes", { event: "*", schema: "public", table }, onRow(table));
  }
  channel.subscribe((status) => {
    // After a dropped connection (phone asleep, network switch), catch up on
    // anything that happened while we weren't listening.
    if (status === "SUBSCRIBED") void refresh();
  });
}

function signedIn(user: User) {
  if (state.user?.id === user.id) return;
  const u = { id: user.id, email: user.email ?? "" };
  outbox = read<Op[]>(outboxKey(u.id)) ?? [];
  const cached = read<Data>(cacheKey(u.id));
  // Show the cached copy instantly; realtime + refresh bring it up to date.
  setState({ ...state, ...EMPTY_DATA, ...cached, user: u, ready: !!cached, sync: syncStatus() });
  subscribeRealtime(u.id);
  void refresh();
}

function signedOut() {
  if (channel) void supabase?.removeChannel(channel);
  channel = null;
  outbox = [];
  setState({ ...state, ...EMPTY_DATA, user: null, ready: true, sync: "synced" });
}

function initCloud() {
  const db = supabase!;
  db.auth.onAuthStateChange((event, session) => {
    // Defer: supabase-js warns against awaiting its own calls inside this callback.
    setTimeout(() => (session?.user ? signedIn(session.user) : signedOut()), 0);
  });
  const wake = () => {
    if (document.visibilityState !== "visible") return;
    void refresh();
  };
  document.addEventListener("visibilitychange", wake);
  window.addEventListener("online", () => void refresh());
  window.addEventListener("offline", () => setState({ ...state, sync: "offline" }));
  setInterval(() => outbox.length && void flush(), 15_000);
}

// ─── Wiring ─────────────────────────────────────────────────────────────────

let initialized = false;

function init() {
  if (initialized) return;
  initialized = true;
  if (supabase) initCloud();
  else initLocal();
}

function subscribe(listener: () => void) {
  init();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useStore(): State {
  return useSyncExternalStore(subscribe, () => state, () => SERVER_STATE);
}

function commit(...ops: Op[]) {
  const d = ops.reduce(applyOp, dataOf(state));
  setState({ ...state, ...d });
  if (state.mode === "local") {
    write(LOCAL_KEY, d);
    return;
  }
  if (!state.user) return;
  write(cacheKey(state.user.id), d);
  ops.forEach(enqueue);
}

const uid = () => crypto.randomUUID();

// ─── Auth ───────────────────────────────────────────────────────────────────

export async function sendSignInEmail(email: string) {
  const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
  if (error) throw error;
}

export async function verifyCode(email: string, token: string) {
  const { error } = await supabase!.auth.verifyOtp({ email, token, type: "email" });
  if (error) throw error;
}

export async function signOut() {
  const userId = state.user?.id;
  await supabase?.auth.signOut();
  if (userId) {
    try {
      localStorage.removeItem(cacheKey(userId));
    } catch {}
  }
}

/** Unsent changes, so sign-out can warn before discarding them. */
export const pendingChanges = () => outbox.length;

// ─── Actions ────────────────────────────────────────────────────────────────

export type Draft = Pick<Entry, "description" | "projectId" | "tagIds" | "billable">;

export function startTimer(draft: Draft) {
  const now = new Date().toISOString();
  // Only one timer runs at a time; starting a new one stops the old one first.
  const stops: Op[] = state.entries.filter((e) => e.end === null).map((e) => ({ t: "entry", row: { ...e, end: now } }));
  commit(...stops, { t: "entry", row: { id: uid(), ...draft, start: now, end: null } });
}

export function stopTimer() {
  const now = new Date().toISOString();
  commit(...state.entries.filter((e) => e.end === null).map((e): Op => ({ t: "entry", row: { ...e, end: now } })));
}

export function addEntry(entry: Omit<Entry, "id">) {
  commit({ t: "entry", row: { id: uid(), ...entry } });
}

export function updateEntry(id: string, patch: Partial<Omit<Entry, "id">>) {
  const e = state.entries.find((e) => e.id === id);
  if (e) commit({ t: "entry", row: { ...e, ...patch } });
}

export function deleteEntry(id: string): Entry | undefined {
  const removed = state.entries.find((e) => e.id === id);
  commit({ t: "entry-del", id });
  return removed;
}

export function restoreEntry(entry: Entry) {
  commit({ t: "entry", row: entry });
}

export function addProject(name: string): Project {
  const project = { id: uid(), name: name.trim(), color: PROJECT_COLORS[state.projects.length % PROJECT_COLORS.length] };
  commit({ t: "project", row: project });
  return project;
}

export function addTag(name: string): Tag {
  const tag = { id: uid(), name: name.trim() };
  commit({ t: "tag", row: tag });
  return tag;
}

export function updateSettings(patch: Partial<Settings>) {
  commit({ t: "settings", row: { ...state.settings, ...patch } });
}

export function replaceAll(next: Data) {
  commit({ t: "replace", data: next });
}

// ─── Selectors ──────────────────────────────────────────────────────────────

export function durationOf(e: Entry, now = Date.now()): number {
  return (e.end ? Date.parse(e.end) : now) - Date.parse(e.start);
}

export function runningEntry(s: State): Entry | undefined {
  return s.entries.find((e) => e.end === null);
}
