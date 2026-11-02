"use client";

// Supabase adapter. Cloud mode is on when both env vars are set at build time;
// without them the app runs local-only (localStorage), as in v1.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Entry, Op, Project, Settings, Tag } from "./store";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }) : null;

// ─── Row mapping ────────────────────────────────────────────────────────────

type EntryRow = {
  id: string;
  user_id: string;
  description: string;
  start_at: string;
  end_at: string | null;
  project_id: string | null;
  tag_ids: string[];
  billable: boolean;
};

const iso = (t: string) => new Date(t).toISOString();

export function entryFromRow(r: EntryRow): Entry {
  return {
    id: r.id,
    description: r.description,
    start: iso(r.start_at),
    end: r.end_at ? iso(r.end_at) : null,
    projectId: r.project_id,
    tagIds: r.tag_ids ?? [],
    billable: r.billable,
  };
}

function entryToRow(e: Entry, userId: string) {
  return {
    id: e.id,
    user_id: userId,
    description: e.description,
    start_at: e.start,
    end_at: e.end,
    project_id: e.projectId,
    tag_ids: e.tagIds,
    billable: e.billable,
    updated_at: new Date().toISOString(),
  };
}

// ─── Reads ──────────────────────────────────────────────────────────────────

export type Snapshot = { entries: Entry[]; projects: Project[]; tags: Tag[]; settings: Settings | null };

export async function fetchAll(db: SupabaseClient): Promise<Snapshot> {
  const [entries, projects, tags, settings] = await Promise.all([
    db.from("entries").select("*").order("start_at", { ascending: false }),
    db.from("projects").select("id, name, color").order("created_at"),
    db.from("tags").select("id, name").order("created_at"),
    db.from("settings").select("member, workspace").maybeSingle(),
  ]);
  const error = entries.error ?? projects.error ?? tags.error ?? settings.error;
  if (error) throw error;
  return {
    entries: (entries.data as EntryRow[]).map(entryFromRow),
    projects: projects.data as Project[],
    tags: tags.data as Tag[],
    settings: settings.data as Settings | null,
  };
}

// ─── Writes ─────────────────────────────────────────────────────────────────

/** Postgres/PostgREST rejected the write (vs. a network failure worth retrying). */
export function isPermanent(error: { code?: string } | null | undefined): boolean {
  return !!error?.code && error.code !== "" && !/^(08|57P)/.test(error.code);
}

const UNIQUE_VIOLATION = "23505";

export async function sendOp(db: SupabaseClient, userId: string, op: Op): Promise<{ code?: string; message: string } | null> {
  switch (op.t) {
    case "entry": {
      const row = entryToRow(op.row, userId);
      let { error } = await db.from("entries").upsert(row);
      if (error?.code === UNIQUE_VIOLATION && op.row.end === null) {
        // Another device started a timer we hadn't heard about yet. Stop it at
        // our start time, then retry, so the newest start wins (like Toggl).
        await db.from("entries").update({ end_at: op.row.start, updated_at: row.updated_at }).is("end_at", null).neq("id", op.row.id);
        ({ error } = await db.from("entries").upsert(row));
      }
      return error;
    }
    case "entry-del":
      return (await db.from("entries").delete().eq("id", op.id)).error;
    case "project":
      return (await db.from("projects").upsert({ ...op.row, user_id: userId })).error;
    case "tag":
      return (await db.from("tags").upsert({ ...op.row, user_id: userId })).error;
    case "settings":
      return (await db.from("settings").upsert({ ...op.row, user_id: userId })).error;
    case "replace": {
      for (const table of ["entries", "projects", "tags"] as const) {
        const { error } = await db.from(table).delete().eq("user_id", userId);
        if (error) return error;
      }
      const { projects, tags, entries, settings } = op.data;
      if (projects.length) {
        const { error } = await db.from("projects").insert(projects.map((p) => ({ ...p, user_id: userId })));
        if (error) return error;
      }
      if (tags.length) {
        const { error } = await db.from("tags").insert(tags.map((t) => ({ ...t, user_id: userId })));
        if (error) return error;
      }
      for (let i = 0; i < entries.length; i += 500) {
        const { error } = await db.from("entries").insert(entries.slice(i, i + 500).map((e) => entryToRow(e, userId)));
        if (error) return error;
      }
      return (await db.from("settings").upsert({ ...settings, user_id: userId })).error;
    }
  }
}
