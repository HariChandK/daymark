"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { loadDaymarkData, writeLegacyData, writeSupabaseData, type DataAction, type DataBackend } from "./supabase-data";
import InsightsPanel from "./insights-panel";
import type { LifeArea } from "./supabase-data";

type User = { id: string; displayName: string; email: string; fullName: string | null };
type Task = { id: string; title: string; dueDate: string; dueTime: string; priority: "low" | "medium" | "high"; completed: boolean; area: LifeArea; carriedCount: number };
type Entry = { id: string; entryDate: string; content: string; mood: number; energy: number; updatedAt: string };
type Data = { tasks: Task[]; entries: Entry[]; profile?: { displayName: string } | null };
type SaveState = "syncing" | "ready" | "saving" | "saved" | "failed";
type PendingSave = { action: DataAction; payload: Record<string, unknown> };

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const starter: Data = {
  tasks: [
    { id: "welcome-1", title: "Call Amma", dueDate: today, dueTime: "09:30", priority: "high", completed: false, area: "Relationships", carriedCount: 0 },
    { id: "welcome-2", title: "Finish the feature I've been avoiding", dueDate: today, dueTime: "12:30", priority: "medium", completed: false, area: "Work", carriedCount: 0 },
    { id: "welcome-3", title: "Sit outside for ten minutes", dueDate: today, dueTime: "20:00", priority: "low", completed: false, area: "Rest", carriedCount: 0 },
  ],
  entries: [],
};

function uid() { return crypto.randomUUID(); }
function dateLabel(date: string) { return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function fullDate(date: string) { return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }); }
function downloadFile(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  URL.revokeObjectURL(url);
}

export default function DaymarkClient({ user, accessToken, onSignOut }: { user: User; accessToken: string; onSignOut: () => void }) {
  const dataApiUrl = typeof window !== "undefined" && window.location.hostname.endsWith("pages.dev")
    ? "https://daymark-daily-journal.harichankona.chatgpt.site/api/data"
    : "/api/data";
  const [data, setData] = useState<Data>(starter);
  const [selectedDate, setSelectedDate] = useState(today);
  const [view, setView] = useState<"today" | "timeline" | "journal" | "insights">("today");
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskTime, setTaskTime] = useState("09:00");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [area, setArea] = useState<LifeArea>("Personal");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTime, setEditTime] = useState("09:00");
  const [editPriority, setEditPriority] = useState<Task["priority"]>("medium");
  const [editArea, setEditArea] = useState<LifeArea>("Personal");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [journal, setJournal] = useState("");
  const [mood, setMood] = useState(4);
  const [energy, setEnergy] = useState(3);
  const [saveState, setSaveState] = useState<SaveState>("syncing");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [pendingSave, setPendingSave] = useState<PendingSave | null>(null);
  const [backend, setBackend] = useState<DataBackend>("supabase");
  const [profileName, setProfileName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [onboarding, setOnboarding] = useState<"loading" | "open" | "done">("loading");

  useEffect(() => {
    loadDaymarkData(accessToken, user.id, dataApiUrl).then(({ data: saved, backend: selectedBackend }) => {
      setBackend(selectedBackend);
      if (saved.tasks.length || saved.entries.length) setData(saved);
      if (saved.profile?.displayName) { setProfileName(saved.profile.displayName); setOnboarding("done"); }
      else { setNameDraft(user.fullName?.split(" ")[0] ?? ""); setOnboarding("open"); }
      const savedToday = saved.entries.find(entry => entry.entryDate === selectedDate);
      const draft = localStorage.getItem(`daymark.draft.${user.email}.${selectedDate}`);
      if (savedToday) { setJournal(draft ?? savedToday.content); setMood(savedToday.mood); setEnergy(savedToday.energy); }
      else if (draft) setJournal(draft);
      setSaveState("ready");
    }).catch(() => { setProfileName(user.fullName?.split(" ")[0] ?? user.displayName); setOnboarding("done"); setSaveState("failed"); });
  }, [accessToken, dataApiUrl, selectedDate, user.displayName, user.email, user.fullName, user.id]);

  const dayEntry = data.entries.find(entry => entry.entryDate === selectedDate);

  function chooseDate(date: string) {
    const entry = data.entries.find(item => item.entryDate === date);
    const draft = localStorage.getItem(`daymark.draft.${user.email}.${date}`);
    setSelectedDate(date); setJournal(draft ?? entry?.content ?? ""); setMood(entry?.mood ?? 4); setEnergy(entry?.energy ?? 3);
  }

  const dayTasks = useMemo(() => data.tasks.filter(task => task.dueDate === selectedDate).sort((a, b) => a.dueTime.localeCompare(b.dueTime)), [data.tasks, selectedDate]);
  const upcoming = useMemo(() => data.tasks.filter(task => !task.completed).sort((a, b) => `${a.dueDate}${a.dueTime}`.localeCompare(`${b.dueDate}${b.dueTime}`)), [data.tasks]);
  const complete = dayTasks.filter(task => task.completed).length;
  const progress = dayTasks.length ? Math.round((complete / dayTasks.length) * 100) : 0;

  async function persist(action: DataAction, payload: Record<string, unknown>) {
    setSaveState("saving");
    try {
      if (backend === "supabase") await writeSupabaseData(accessToken, user.id, action, payload);
      else await writeLegacyData(accessToken, dataApiUrl, action, payload);
      setPendingSave(null); setLastSavedAt(new Date()); setSaveState("saved");
      return true;
    } catch {
      setPendingSave({ action, payload }); setSaveState("failed");
      return false;
    }
  }

  function retrySave() { if (pendingSave) void persist(pendingSave.action, pendingSave.payload); }

  function updateJournal(value: string) {
    setJournal(value);
    localStorage.setItem(`daymark.draft.${user.email}.${selectedDate}`, value);
  }

  function addTask(event: FormEvent) {
    event.preventDefault();
    if (!taskTitle.trim()) return;
    const task: Task = { id: uid(), title: taskTitle.trim(), dueDate: selectedDate, dueTime: taskTime, priority, completed: false, area, carriedCount: 0 };
    setData(current => ({ ...current, tasks: [...current.tasks, task] }));
    persist("upsertTask", task);
    setTaskTitle(""); setShowTaskForm(false);
  }

  function toggleTask(task: Task) {
    const next = { ...task, completed: !task.completed };
    setData(current => ({ ...current, tasks: current.tasks.map(item => item.id === task.id ? next : item) }));
    persist("upsertTask", next);
  }

  function deleteTask(id: string) {
    setData(current => ({ ...current, tasks: current.tasks.filter(task => task.id !== id) }));
    persist("deleteTask", { id });
  }

  function startEdit(task: Task) {
    setEditingId(task.id); setEditTitle(task.title); setEditTime(task.dueTime); setEditPriority(task.priority); setEditArea(task.area);
  }

  function saveTaskEdit(task: Task) {
    if (!editTitle.trim()) return;
    const next = { ...task, title: editTitle.trim(), dueTime: editTime, priority: editPriority, area: editArea };
    setData(current => ({ ...current, tasks: current.tasks.map(item => item.id === task.id ? next : item) }));
    persist("upsertTask", next); setEditingId(null);
  }

  async function closeDay() {
    const unfinished = dayTasks.filter(task => !task.completed);
    const tomorrow = new Date(new Date(`${selectedDate}T12:00:00`).getTime() + 86400000).toISOString().slice(0, 10);
    const moved = unfinished.map(task => ({ ...task, dueDate: tomorrow, carriedCount: task.carriedCount + 1 }));
    const movedIds = new Set(moved.map(task => task.id));
    setData(current => ({ ...current, tasks: current.tasks.map(task => movedIds.has(task.id) ? moved.find(item => item.id === task.id)! : task) }));
    const closure = `Today is saved. ${complete} completed${unfinished.length ? `, ${unfinished.length} carried forward` : ""}. Tomorrow is still open.`;
    const content = journal.trim() ? `${journal.trim()}\n\n${closure}` : closure;
    const entry: Entry = { id: dayEntry?.id ?? uid(), entryDate: selectedDate, content, mood, energy, updatedAt: new Date().toISOString() };
    setJournal(content);
    setData(current => ({ ...current, entries: [...current.entries.filter(item => item.entryDate !== selectedDate), entry] }));
    const entrySaved = await persist("upsertEntry", entry);
    if (!entrySaved) return;
    for (const task of moved) {
      if (!(await persist("upsertTask", task))) return;
    }
    localStorage.removeItem(`daymark.draft.${user.email}.${selectedDate}`);
    setReviewOpen(false);
  }

  async function saveJournal() {
    if (!journal.trim()) return;
    const entry: Entry = { id: dayEntry?.id ?? uid(), entryDate: selectedDate, content: journal.trim(), mood, energy, updatedAt: new Date().toISOString() };
    setData(current => ({ ...current, entries: [...current.entries.filter(item => item.entryDate !== selectedDate), entry] }));
    if (await persist("upsertEntry", entry)) localStorage.removeItem(`daymark.draft.${user.email}.${selectedDate}`);
  }

  function deleteJournal() {
    if (!dayEntry) { setJournal(""); localStorage.removeItem(`daymark.draft.${user.email}.${selectedDate}`); return; }
    setData(current => ({ ...current, entries: current.entries.filter(item => item.id !== dayEntry.id) }));
    setJournal(""); localStorage.removeItem(`daymark.draft.${user.email}.${selectedDate}`); persist("deleteEntry", { id: dayEntry.id });
  }

  async function saveName(event: FormEvent) {
    event.preventDefault();
    const cleanName = nameDraft.trim().slice(0, 40);
    if (!cleanName) return;
    setProfileName(cleanName); setOnboarding("done");
    await persist("upsertProfile", { displayName: cleanName });
  }

  const name = profileName || (user.fullName ?? user.displayName).split(" ")[0];
  const saveLabel = saveState === "saving" ? "Saving" : saveState === "saved" && lastSavedAt ? `Saved securely at ${lastSavedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : saveState === "failed" ? "Save failed" : saveState === "syncing" ? "Syncing your day" : "Ready";

  function exportJson() {
    downloadFile(`daymark-export-${today}.json`, JSON.stringify({ exportedAt: new Date().toISOString(), profile: data.profile ?? { displayName: name }, tasks: data.tasks, entries: data.entries }, null, 2), "application/json");
  }

  function exportMarkdown() {
    const tasksByDate = new Map<string, Task[]>();
    data.tasks.forEach(task => tasksByDate.set(task.dueDate, [...(tasksByDate.get(task.dueDate) ?? []), task]));
    const dates = [...new Set([...data.entries.map(entry => entry.entryDate), ...data.tasks.map(task => task.dueDate)])].sort().reverse();
    const markdown = [`# ${name}'s Daymark`, "", `Exported ${new Date().toLocaleString()}`, "", ...dates.flatMap(date => {
      const entry = data.entries.find(item => item.entryDate === date);
      const tasks = tasksByDate.get(date) ?? [];
      return [`## ${fullDate(date)}`, "", ...(tasks.length ? ["### Intentions", "", ...tasks.map(task => `- [${task.completed ? "x" : " "}] ${task.title} (${task.dueTime}, ${task.priority})`), ""] : []), ...(entry ? ["### Reflection", "", entry.content, "", `Mood: ${entry.mood}/5  `, `Energy: ${entry.energy}/5`, ""] : [])];
    })].join("\n");
    downloadFile(`daymark-export-${today}.md`, markdown, "text/markdown");
  }
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">D</span><div><strong>Daymark</strong><small>your days, held gently</small></div></div>
        <nav aria-label="Main navigation">
          <button className={view === "today" ? "active" : ""} onClick={() => setView("today")}><span>⌂</span> Today</button>
          <button className={view === "timeline" ? "active" : ""} onClick={() => setView("timeline")}><span>◷</span> Timeline</button>
          <button className={view === "journal" ? "active" : ""} onClick={() => setView("journal")}><span>✎</span> Journal</button>
          <button className={view === "insights" ? "active" : ""} onClick={() => setView("insights")}><span>✦</span> Insights</button>
        </nav>
        <div className="sidebar-note"><span>“</span><p>What became of your day?</p></div>
        <div className="account"><div className="avatar">{name.charAt(0).toUpperCase()}</div><div><strong>{name}</strong><small className={saveState === "failed" ? "save-error" : ""}>{saveLabel}</small>{saveState === "failed" && pendingSave && <button className="retry-save" onClick={retrySave}>Retry</button>}</div><button className="sign-out" onClick={onSignOut} aria-label="Sign out">↗</button></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">{fullDate(selectedDate)}</p><h1>{selectedDate === today ? `Welcome back, ${name}.` : fullDate(selectedDate)}</h1><p>Every day receives your time. Daymark helps you see where it went.</p></div>
          <div className="date-control"><button onClick={() => chooseDate(new Date(new Date(`${selectedDate}T12:00:00`).getTime() - 86400000).toISOString().slice(0,10))} aria-label="Previous day">‹</button><input aria-label="Choose date" type="date" value={selectedDate} onChange={e => chooseDate(e.target.value)} /><button onClick={() => chooseDate(new Date(new Date(`${selectedDate}T12:00:00`).getTime() + 86400000).toISOString().slice(0,10))} aria-label="Next day">›</button></div>
        </header>

        {view === "insights" ? <InsightsPanel tasks={data.tasks} entries={data.entries} /> : view === "timeline" ? (
          <section className="page-card timeline-page"><div className="section-heading"><div><span className="kicker">THE ROAD AHEAD</span><h2>Your timeline</h2></div><span>{upcoming.length} open tasks</span></div>{upcoming.length ? upcoming.map(task => <div className="timeline-row" key={task.id}><time>{dateLabel(task.dueDate)}<small>{task.dueTime}</small></time><span className={`timeline-dot ${task.priority}`}></span><div><strong>{task.title}</strong><small>{task.priority} priority</small></div><button onClick={() => toggleTask(task)}>Mark done</button></div>) : <Empty text="Your road ahead is clear." />}</section>
        ) : view === "journal" ? (
          <section className="page-card journal-history"><div className="section-heading"><div><span className="kicker">YOUR DAYS</span><h2>Journal</h2></div><div className="export-actions"><button onClick={exportMarkdown}>Export Markdown</button><button onClick={exportJson}>Export JSON</button><span>{data.entries.length} entries</span></div></div>{data.entries.length ? [...data.entries].sort((a,b) => b.entryDate.localeCompare(a.entryDate)).map(entry => <button className="history-entry" key={entry.id} onClick={() => { chooseDate(entry.entryDate); setView("today"); }}><time>{fullDate(entry.entryDate)}</time><p>{entry.content}</p><span>Mood {entry.mood}/5 · Energy {entry.energy}/5</span></button>) : <Empty text="Your first page is waiting for you." />}</section>
        ) : (
          <div className="dashboard-grid">
            <div className="main-column">
              <section className="page-card tasks-card">
                <div className="section-heading"><div><span className="kicker">TODAY’S INTENTIONS</span><h2>What deserves your attention today?</h2></div><div className="progress-ring" style={{"--progress": `${progress * 3.6}deg`} as React.CSSProperties}><span>{progress}%</span></div></div>
                <div className="task-list">{dayTasks.length ? dayTasks.map(task => editingId === task.id ? <form className="task edit-task" key={task.id} onSubmit={event => { event.preventDefault(); saveTaskEdit(task); }}><span className="edit-mark">✎</span><div className="edit-fields"><input autoFocus aria-label="Edit task title" value={editTitle} onChange={e => setEditTitle(e.target.value)} /><div><input aria-label="Edit task time" type="time" value={editTime} onChange={e => setEditTime(e.target.value)} /><select aria-label="Edit task priority" value={editPriority} onChange={e => setEditPriority(e.target.value as Task["priority"])}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select><select aria-label="Edit life area" value={editArea} onChange={e => setEditArea(e.target.value as LifeArea)}>{["Work","Health","Learning","Relationships","Rest","Personal"].map(item => <option key={item}>{item}</option>)}</select></div></div><div className="task-actions"><button className="save-mini" type="submit" aria-label="Save task changes">✓</button><button className="delete" type="button" onClick={() => setEditingId(null)} aria-label="Cancel editing">×</button></div></form> : <article className={`task ${task.completed ? "done" : ""}`} key={task.id}><button className="check" onClick={() => toggleTask(task)} aria-label={`${task.completed ? "Reopen" : "Complete"} ${task.title}`}>{task.completed ? "✓" : ""}</button><div><strong>{task.title}</strong><span><time>{task.dueTime}</time> · <em className={task.priority}>{task.priority}</em> · {task.area}{task.carriedCount ? ` · carried ${task.carriedCount}×` : ""}</span></div><div className="task-actions"><button className="edit" onClick={() => startEdit(task)} aria-label={`Edit ${task.title}`}>✎</button><button className="delete" onClick={() => deleteTask(task.id)} aria-label={`Delete ${task.title}`}>×</button></div></article>) : <Empty text="Nothing here yet. Add what matters today. You don't need to add everything." />}</div>
                {showTaskForm ? <form className="task-form" onSubmit={addTask}><input autoFocus aria-label="Task title" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="What needs your attention?" /><input aria-label="Due time" type="time" value={taskTime} onChange={e => setTaskTime(e.target.value)} /><select aria-label="Priority" value={priority} onChange={e => setPriority(e.target.value as Task["priority"])}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select><select aria-label="Life area" value={area} onChange={e => setArea(e.target.value as LifeArea)}>{["Work","Health","Learning","Relationships","Rest","Personal"].map(item => <option key={item}>{item}</option>)}</select><button type="submit" className="primary">Add</button><button type="button" onClick={() => setShowTaskForm(false)}>Cancel</button></form> : <button className="add-row" onClick={() => setShowTaskForm(true)}>＋ Add an intention</button>}
              </section>

              <section className="page-card rhythm-card"><div className="section-heading"><div><span className="kicker">A GENTLE RHYTHM</span><h2>Today, at a glance</h2></div><span>{complete} of {dayTasks.length} complete</span></div><div className="rhythm-track">{dayTasks.map(task => <div key={task.id} className={task.completed ? "complete" : ""}><span></span><time>{task.dueTime}</time><small>{task.title}</small></div>)}</div></section>
              <section className="page-card closure-card"><div><span className="kicker">THE DAYMARK RITUAL</span><h2>Today doesn&apos;t need to feel complete.</h2><p>Review what became of today before carrying anything forward.</p></div><div className="closure-stats"><strong>{complete}</strong><span>done</span><strong>{dayTasks.length - complete}</strong><span>to review</span></div><button className="primary" onClick={() => setReviewOpen(true)}>Review and close today</button></section>
            </div>

            <div className="side-column">
              <section className="page-card journal-card"><div className="section-heading"><div><span className="kicker">A NOTE TO SELF</span><h2>Before today slips away...</h2></div><button className="delete" onClick={deleteJournal} aria-label="Delete journal entry">{dayEntry ? "Delete" : "Clear"}</button></div><textarea value={journal} onChange={e => updateJournal(e.target.value)} placeholder="Leave a few words so you can remember today later." aria-label="Journal entry" /><div className="journal-actions"><span>{journal.length} characters · {saveLabel}</span><button className="primary" onClick={saveJournal}>Save reflection</button></div>{saveState === "failed" && pendingSave && <button className="retry-save journal-retry" onClick={retrySave}>Save failed. Retry</button>}</section>
              <section className="page-card checkin-card"><span className="kicker">DAILY CHECK-IN</span><h2>How are you feeling today?</h2><label>Mood <span>{["Heavy", "Low", "Steady", "Good", "Bright"][mood-1]}</span></label><div className="scale">{[1,2,3,4,5].map(value => <button key={value} className={mood === value ? "selected" : ""} onClick={() => setMood(value)} aria-label={`Mood ${value} of 5`}>{["☂", "◔", "◐", "☀", "✦"][value-1]}</button>)}</div><label>Energy <span>{energy}/5</span></label><input type="range" min="1" max="5" value={energy} onChange={e => setEnergy(Number(e.target.value))} aria-label="Energy level" /></section>
              <section className="insight"><span>✦</span><div><strong>A small observation</strong><p>{progress >= 75 ? "You may have done more today than you remember." : progress > 0 ? "Where your attention went is part of what today became." : "Not every day needs a lesson. Sometimes it is enough to remember what happened."}</p></div></section>
            </div>
          </div>
        )}
      </section>

      <nav className="mobile-nav" aria-label="Mobile navigation"><button className={view === "today" ? "active" : ""} onClick={() => setView("today")}><span>⌂</span>Today</button><button className={view === "timeline" ? "active" : ""} onClick={() => setView("timeline")}><span>◷</span>Timeline</button><button className={view === "journal" ? "active" : ""} onClick={() => setView("journal")}><span>✎</span>Journal</button><button className={view === "insights" ? "active" : ""} onClick={() => setView("insights")}><span>✦</span>Insights</button></nav>
      {reviewOpen && <div className="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="review-title"><section className="welcome-card review-card"><span className="kicker">WHAT BECAME OF TODAY?</span><h2 id="review-title">Your day, before it closes</h2><div className="review-summary"><div><strong>{complete}</strong><span>completed</span></div><div><strong>{dayTasks.length - complete}</strong><span>moving forward</span></div><div><strong>{mood}/5</strong><span>mood</span></div><div><strong>{energy}/5</strong><span>energy</span></div></div><p>{complete ? `You completed ${dayTasks.filter(task => task.completed).map(task => task.title).join(", ")}.` : "Nothing needed to be completed for today to count."}</p>{dayTasks.some(task => !task.completed) && <p>{dayTasks.filter(task => !task.completed).map(task => task.title).join(", ")} will remain visible tomorrow. Daymark will remember how often each intention is carried.</p>}<button className="primary" onClick={closeDay}>Close today and carry forward</button><button className="review-cancel" onClick={() => setReviewOpen(false)}>Go back to today</button></section></div>}
      {onboarding === "open" && <div className="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title"><form className="welcome-card" onSubmit={saveName}><span className="welcome-mark">D</span><span className="kicker">WELCOME TO DAYMARK</span><h2 id="welcome-title">What should we call you?</h2><p>This name is only used to make your private space feel like yours. You can use your first name, nickname, or anything you like.</p><label htmlFor="display-name">Your name</label><input id="display-name" autoFocus value={nameDraft} onChange={event => setNameDraft(event.target.value)} placeholder="e.g. Hari" maxLength={40} required /><button className="primary" type="submit">Enter my Daymark</button><small>Signed in as {user.email}</small></form></div>}
    </main>
  );
}

function Empty({ text }: { text: string }) { return <div className="empty"><span>✦</span><p>{text}</p></div>; }
