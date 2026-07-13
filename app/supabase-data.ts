import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./supabase-auth";

export type DaymarkTask = { id: string; title: string; dueDate: string; dueTime: string; priority: "low" | "medium" | "high"; completed: boolean };
export type DaymarkEntry = { id: string; entryDate: string; content: string; mood: number; energy: number; updatedAt: string };
export type DaymarkData = { tasks: DaymarkTask[]; entries: DaymarkEntry[]; profile?: { displayName: string } | null };
export type DataBackend = "supabase" | "legacy";
export type DataAction = "upsertTask" | "deleteTask" | "upsertEntry" | "deleteEntry" | "upsertProfile";

function headers(accessToken: string, extra: Record<string, string> = {}) {
  return { apikey: SUPABASE_PUBLISHABLE_KEY, authorization: `Bearer ${accessToken}`, ...extra };
}

async function supabaseRequest(accessToken: string, path: string, init?: RequestInit) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...headers(accessToken), ...(init?.headers ?? {}) } });
  if (!response.ok) throw new Error(`Supabase data request failed (${response.status})`);
  return response;
}

export async function readSupabaseData(accessToken: string): Promise<DaymarkData> {
  const [tasksResponse, entriesResponse, profileResponse] = await Promise.all([
    supabaseRequest(accessToken, "tasks?select=id,title,due_date,due_time,priority,completed&order=due_date.asc,due_time.asc"),
    supabaseRequest(accessToken, "entries?select=id,entry_date,content,mood,energy,updated_at&order=entry_date.desc"),
    supabaseRequest(accessToken, "profiles?select=display_name&limit=1"),
  ]);
  const tasks = (await tasksResponse.json()) as Array<{ id: string; title: string; due_date: string; due_time: string; priority: DaymarkTask["priority"]; completed: boolean }>;
  const entries = (await entriesResponse.json()) as Array<{ id: string; entry_date: string; content: string; mood: number; energy: number; updated_at: string }>;
  const profiles = (await profileResponse.json()) as Array<{ display_name: string }>;
  return {
    tasks: tasks.map(task => ({ id: task.id, title: task.title, dueDate: task.due_date, dueTime: task.due_time.slice(0, 5), priority: task.priority, completed: task.completed })),
    entries: entries.map(entry => ({ id: entry.id, entryDate: entry.entry_date, content: entry.content, mood: entry.mood, energy: entry.energy, updatedAt: entry.updated_at })),
    profile: profiles[0] ? { displayName: profiles[0].display_name } : null,
  };
}

export async function writeSupabaseData(accessToken: string, userId: string, action: DataAction, payload: Record<string, unknown>) {
  const jsonHeaders = { "content-type": "application/json", prefer: "resolution=merge-duplicates,return=minimal" };
  if (action === "upsertTask") {
    await supabaseRequest(accessToken, "tasks?on_conflict=user_id,id", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ user_id: userId, id: payload.id, title: payload.title, due_date: payload.dueDate, due_time: payload.dueTime, priority: payload.priority, completed: payload.completed, updated_at: new Date().toISOString() }) });
  } else if (action === "deleteTask") {
    await supabaseRequest(accessToken, `tasks?user_id=eq.${encodeURIComponent(userId)}&id=eq.${encodeURIComponent(String(payload.id))}`, { method: "DELETE", headers: { prefer: "return=minimal" } });
  } else if (action === "upsertEntry") {
    await supabaseRequest(accessToken, "entries?on_conflict=user_id,entry_date", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ user_id: userId, id: payload.id, entry_date: payload.entryDate, content: payload.content, mood: payload.mood, energy: payload.energy, updated_at: payload.updatedAt }) });
  } else if (action === "deleteEntry") {
    await supabaseRequest(accessToken, `entries?user_id=eq.${encodeURIComponent(userId)}&id=eq.${encodeURIComponent(String(payload.id))}`, { method: "DELETE", headers: { prefer: "return=minimal" } });
  } else if (action === "upsertProfile") {
    await supabaseRequest(accessToken, "profiles?on_conflict=user_id", { method: "POST", headers: jsonHeaders, body: JSON.stringify({ user_id: userId, display_name: payload.displayName, updated_at: new Date().toISOString() }) });
  }
}

async function readLegacyData(accessToken: string, legacyUrl: string): Promise<DaymarkData> {
  const response = await fetch(legacyUrl, { headers: { authorization: `Bearer ${accessToken}` } });
  if (!response.ok) throw new Error("Legacy data request failed");
  return response.json() as Promise<DaymarkData>;
}

function hasData(data: DaymarkData) { return Boolean(data.profile || data.tasks.length || data.entries.length); }
function comparable(data: DaymarkData) {
  return JSON.stringify({
    profile: data.profile?.displayName ?? null,
    tasks: [...data.tasks].sort((a, b) => a.id.localeCompare(b.id)),
    entries: data.entries.map(entry => ({ id: entry.id, entryDate: entry.entryDate, content: entry.content, mood: entry.mood, energy: entry.energy })).sort((a, b) => a.id.localeCompare(b.id)),
  });
}

async function migrationComplete(accessToken: string) {
  const response = await supabaseRequest(accessToken, "migration_status?select=legacy_migrated_at&limit=1");
  return ((await response.json()) as unknown[]).length > 0;
}

async function markMigrationComplete(accessToken: string, userId: string) {
  await supabaseRequest(accessToken, "migration_status?on_conflict=user_id", { method: "POST", headers: { "content-type": "application/json", prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ user_id: userId, legacy_migrated_at: new Date().toISOString() }) });
}

async function migrateLegacyData(accessToken: string, userId: string, legacy: DaymarkData) {
  if (legacy.profile) await writeSupabaseData(accessToken, userId, "upsertProfile", { displayName: legacy.profile.displayName });
  for (const task of legacy.tasks) await writeSupabaseData(accessToken, userId, "upsertTask", task);
  for (const entry of legacy.entries) await writeSupabaseData(accessToken, userId, "upsertEntry", entry);
  const copied = await readSupabaseData(accessToken);
  if (comparable(legacy) !== comparable(copied)) throw new Error("Copied records did not match the D1 source");
  return copied;
}

export async function loadDaymarkData(accessToken: string, userId: string, legacyUrl: string): Promise<{ data: DaymarkData; backend: DataBackend }> {
  try {
    if (await migrationComplete(accessToken)) return { data: await readSupabaseData(accessToken), backend: "supabase" };
  } catch { /* The legacy fallback below keeps the app usable during setup. */ }
  let legacy: DaymarkData | null = null;
  try { legacy = await readLegacyData(accessToken, legacyUrl); } catch { /* D1 remains an optional migration source. */ }
  try {
    const current = await readSupabaseData(accessToken);
    const migrated = legacy && hasData(legacy) ? await migrateLegacyData(accessToken, userId, legacy) : current;
    await markMigrationComplete(accessToken, userId);
    return { data: migrated, backend: "supabase" };
  } catch (error) {
    if (legacy) return { data: legacy, backend: "legacy" };
    throw error;
  }
}

export async function writeLegacyData(accessToken: string, legacyUrl: string, action: DataAction, payload: Record<string, unknown>) {
  const response = await fetch(legacyUrl, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ action, payload }) });
  if (!response.ok) throw new Error("Legacy save failed");
}
