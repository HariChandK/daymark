import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

async function email() {
  const user = await getChatGPTUser();
  if (user) return user.email;
  if (process.env.NODE_ENV !== "production") return "local@daymark.app";
  return null;
}

async function setup() {
  await env.DB.batch([
    env.DB.prepare("CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, title TEXT NOT NULL, due_date TEXT NOT NULL, due_time TEXT NOT NULL, priority TEXT NOT NULL, completed INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL)"),
    env.DB.prepare("CREATE INDEX IF NOT EXISTS tasks_owner_date_idx ON tasks(owner_email, due_date)"),
    env.DB.prepare("CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY, owner_email TEXT NOT NULL, entry_date TEXT NOT NULL, content TEXT NOT NULL, mood INTEGER NOT NULL, energy INTEGER NOT NULL, updated_at TEXT NOT NULL)"),
    env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS entries_owner_date_idx ON entries(owner_email, entry_date)"),
  ]);
}

export async function GET() {
  const owner = await email();
  if (!owner) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await setup();
  const [taskRows, entryRows] = await Promise.all([
    env.DB.prepare("SELECT id, title, due_date as dueDate, due_time as dueTime, priority, completed FROM tasks WHERE owner_email = ? ORDER BY due_date, due_time").bind(owner).all(),
    env.DB.prepare("SELECT id, entry_date as entryDate, content, mood, energy, updated_at as updatedAt FROM entries WHERE owner_email = ? ORDER BY entry_date DESC").bind(owner).all(),
  ]);
  return Response.json({ tasks: taskRows.results.map((row: Record<string, unknown>) => ({ ...row, completed: Boolean(row.completed) })), entries: entryRows.results });
}

export async function POST(request: Request) {
  const owner = await email();
  if (!owner) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await setup();
  const { action, payload } = await request.json() as { action: string; payload: Record<string, unknown> };
  if (action === "upsertTask") await env.DB.prepare("INSERT INTO tasks (id, owner_email, title, due_date, due_time, priority, completed, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title=excluded.title, due_date=excluded.due_date, due_time=excluded.due_time, priority=excluded.priority, completed=excluded.completed, updated_at=excluded.updated_at WHERE owner_email = excluded.owner_email").bind(payload.id, owner, payload.title, payload.dueDate, payload.dueTime, payload.priority, payload.completed ? 1 : 0, new Date().toISOString()).run();
  else if (action === "deleteTask") await env.DB.prepare("DELETE FROM tasks WHERE id = ? AND owner_email = ?").bind(payload.id, owner).run();
  else if (action === "upsertEntry") await env.DB.prepare("INSERT INTO entries (id, owner_email, entry_date, content, mood, energy, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(owner_email, entry_date) DO UPDATE SET content=excluded.content, mood=excluded.mood, energy=excluded.energy, updated_at=excluded.updated_at").bind(payload.id, owner, payload.entryDate, payload.content, payload.mood, payload.energy, payload.updatedAt).run();
  else if (action === "deleteEntry") await env.DB.prepare("DELETE FROM entries WHERE id = ? AND owner_email = ?").bind(payload.id, owner).run();
  else return Response.json({ error: "Unknown action" }, { status: 400 });
  return Response.json({ ok: true });
}
