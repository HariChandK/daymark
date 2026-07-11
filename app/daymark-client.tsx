"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type User = { displayName: string; email: string; fullName: string | null };
type Task = { id: string; title: string; dueDate: string; dueTime: string; priority: "low" | "medium" | "high"; completed: boolean };
type Entry = { id: string; entryDate: string; content: string; mood: number; energy: number; updatedAt: string };
type Data = { tasks: Task[]; entries: Entry[]; profile?: { displayName: string } | null };

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
const starter: Data = {
  tasks: [
    { id: "welcome-1", title: "Shape the week ahead", dueDate: today, dueTime: "09:30", priority: "high", completed: false },
    { id: "welcome-2", title: "Take a quiet lunch break", dueDate: today, dueTime: "12:30", priority: "medium", completed: false },
    { id: "welcome-3", title: "Write three lines about today", dueDate: today, dueTime: "20:00", priority: "low", completed: false },
  ],
  entries: [],
};

function uid() { return crypto.randomUUID(); }
function dateLabel(date: string) { return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }); }
function fullDate(date: string) { return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }); }

export default function DaymarkClient({ user }: { user: User }) {
  const [data, setData] = useState<Data>(starter);
  const [selectedDate, setSelectedDate] = useState(today);
  const [view, setView] = useState<"today" | "timeline" | "journal">("today");
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskTime, setTaskTime] = useState("09:00");
  const [priority, setPriority] = useState<Task["priority"]>("medium");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTime, setEditTime] = useState("09:00");
  const [editPriority, setEditPriority] = useState<Task["priority"]>("medium");
  const [journal, setJournal] = useState("");
  const [mood, setMood] = useState(4);
  const [energy, setEnergy] = useState(3);
  const [status, setStatus] = useState("Syncing your day…");
  const [profileName, setProfileName] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [onboarding, setOnboarding] = useState<"loading" | "open" | "done">("loading");

  useEffect(() => {
    fetch("/api/data").then(r => r.ok ? r.json() : Promise.reject()).then((saved: Data) => {
      if (saved.tasks.length || saved.entries.length) setData(saved);
      if (saved.profile?.displayName) { setProfileName(saved.profile.displayName); setOnboarding("done"); }
      else { setNameDraft(user.fullName?.split(" ")[0] ?? ""); setOnboarding("open"); }
      const savedToday = saved.entries.find(entry => entry.entryDate === selectedDate);
      if (savedToday) { setJournal(savedToday.content); setMood(savedToday.mood); setEnergy(savedToday.energy); }
      setStatus("Synced");
    }).catch(() => { setProfileName(user.fullName?.split(" ")[0] ?? user.displayName); setOnboarding("done"); setStatus("Local preview"); });
  }, [selectedDate, user.displayName, user.fullName]);

  const dayEntry = data.entries.find(entry => entry.entryDate === selectedDate);

  function chooseDate(date: string) {
    const entry = data.entries.find(item => item.entryDate === date);
    setSelectedDate(date); setJournal(entry?.content ?? ""); setMood(entry?.mood ?? 4); setEnergy(entry?.energy ?? 3);
  }

  const dayTasks = useMemo(() => data.tasks.filter(task => task.dueDate === selectedDate).sort((a, b) => a.dueTime.localeCompare(b.dueTime)), [data.tasks, selectedDate]);
  const upcoming = useMemo(() => data.tasks.filter(task => !task.completed).sort((a, b) => `${a.dueDate}${a.dueTime}`.localeCompare(`${b.dueDate}${b.dueTime}`)), [data.tasks]);
  const complete = dayTasks.filter(task => task.completed).length;
  const progress = dayTasks.length ? Math.round((complete / dayTasks.length) * 100) : 0;

  async function persist(action: string, payload: unknown) {
    setStatus("Saving…");
    try {
      const res = await fetch("/api/data", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, payload }) });
      if (!res.ok) throw new Error();
      setStatus("Saved");
    } catch { setStatus("Saved in preview"); }
  }

  function addTask(event: FormEvent) {
    event.preventDefault();
    if (!taskTitle.trim()) return;
    const task: Task = { id: uid(), title: taskTitle.trim(), dueDate: selectedDate, dueTime: taskTime, priority, completed: false };
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
    setEditingId(task.id); setEditTitle(task.title); setEditTime(task.dueTime); setEditPriority(task.priority);
  }

  function saveTaskEdit(task: Task) {
    if (!editTitle.trim()) return;
    const next = { ...task, title: editTitle.trim(), dueTime: editTime, priority: editPriority };
    setData(current => ({ ...current, tasks: current.tasks.map(item => item.id === task.id ? next : item) }));
    persist("upsertTask", next); setEditingId(null);
  }

  function closeDay() {
    const unfinished = dayTasks.filter(task => !task.completed);
    const tomorrow = new Date(new Date(`${selectedDate}T12:00:00`).getTime() + 86400000).toISOString().slice(0, 10);
    const moved = unfinished.map(task => ({ ...task, dueDate: tomorrow }));
    const movedIds = new Set(moved.map(task => task.id));
    setData(current => ({ ...current, tasks: current.tasks.map(task => movedIds.has(task.id) ? moved.find(item => item.id === task.id)! : task) }));
    moved.forEach(task => persist("upsertTask", task));
    const closure = `Day closed — ${complete} completed${unfinished.length ? `, ${unfinished.length} carried forward` : ""}.`;
    const content = journal.trim() ? `${journal.trim()}\n\n${closure}` : closure;
    const entry: Entry = { id: dayEntry?.id ?? uid(), entryDate: selectedDate, content, mood, energy, updatedAt: new Date().toISOString() };
    setJournal(content);
    setData(current => ({ ...current, entries: [...current.entries.filter(item => item.entryDate !== selectedDate), entry] }));
    persist("upsertEntry", entry);
    setStatus("Day closed gently");
  }

  function saveJournal() {
    if (!journal.trim()) return;
    const entry: Entry = { id: dayEntry?.id ?? uid(), entryDate: selectedDate, content: journal.trim(), mood, energy, updatedAt: new Date().toISOString() };
    setData(current => ({ ...current, entries: [...current.entries.filter(item => item.entryDate !== selectedDate), entry] }));
    persist("upsertEntry", entry);
  }

  function deleteJournal() {
    if (!dayEntry) { setJournal(""); return; }
    setData(current => ({ ...current, entries: current.entries.filter(item => item.id !== dayEntry.id) }));
    setJournal(""); persist("deleteEntry", { id: dayEntry.id });
  }

  async function saveName(event: FormEvent) {
    event.preventDefault();
    const cleanName = nameDraft.trim().slice(0, 40);
    if (!cleanName) return;
    setProfileName(cleanName); setOnboarding("done");
    await persist("upsertProfile", { displayName: cleanName });
  }

  const name = profileName || (user.fullName ?? user.displayName).split(" ")[0];
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">D</span><div><strong>Daymark</strong><small>your days, held gently</small></div></div>
        <nav aria-label="Main navigation">
          <button className={view === "today" ? "active" : ""} onClick={() => setView("today")}><span>⌂</span> Today</button>
          <button className={view === "timeline" ? "active" : ""} onClick={() => setView("timeline")}><span>◷</span> Timeline</button>
          <button className={view === "journal" ? "active" : ""} onClick={() => setView("journal")}><span>✎</span> Journal</button>
        </nav>
        <div className="sidebar-note"><span>“</span><p>Small steps, honestly remembered, become a life.</p></div>
        <div className="account"><div className="avatar">{name.charAt(0).toUpperCase()}</div><div><strong>{name}</strong><small>{status}</small></div><a href="/signout-with-chatgpt?return_to=%2F" aria-label="Sign out">↗</a></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div><p className="eyebrow">{fullDate(selectedDate)}</p><h1>{selectedDate === today ? `Good day, ${name}.` : fullDate(selectedDate)}</h1><p>Make room for what matters, and leave a trace of the day.</p></div>
          <div className="date-control"><button onClick={() => chooseDate(new Date(new Date(`${selectedDate}T12:00:00`).getTime() - 86400000).toISOString().slice(0,10))} aria-label="Previous day">‹</button><input aria-label="Choose date" type="date" value={selectedDate} onChange={e => chooseDate(e.target.value)} /><button onClick={() => chooseDate(new Date(new Date(`${selectedDate}T12:00:00`).getTime() + 86400000).toISOString().slice(0,10))} aria-label="Next day">›</button></div>
        </header>

        {view === "timeline" ? (
          <section className="page-card timeline-page"><div className="section-heading"><div><span className="kicker">THE ROAD AHEAD</span><h2>Your timeline</h2></div><span>{upcoming.length} open tasks</span></div>{upcoming.length ? upcoming.map(task => <div className="timeline-row" key={task.id}><time>{dateLabel(task.dueDate)}<small>{task.dueTime}</small></time><span className={`timeline-dot ${task.priority}`}></span><div><strong>{task.title}</strong><small>{task.priority} priority</small></div><button onClick={() => toggleTask(task)}>Mark done</button></div>) : <Empty text="Your road ahead is clear." />}</section>
        ) : view === "journal" ? (
          <section className="page-card journal-history"><div className="section-heading"><div><span className="kicker">YOUR DAYS</span><h2>Journal</h2></div><span>{data.entries.length} entries</span></div>{data.entries.length ? [...data.entries].sort((a,b) => b.entryDate.localeCompare(a.entryDate)).map(entry => <button className="history-entry" key={entry.id} onClick={() => { chooseDate(entry.entryDate); setView("today"); }}><time>{fullDate(entry.entryDate)}</time><p>{entry.content}</p><span>Mood {entry.mood}/5 · Energy {entry.energy}/5</span></button>) : <Empty text="Your first page is waiting for you." />}</section>
        ) : (
          <div className="dashboard-grid">
            <div className="main-column">
              <section className="page-card tasks-card">
                <div className="section-heading"><div><span className="kicker">TODAY’S INTENTIONS</span><h2>Things to tend to</h2></div><div className="progress-ring" style={{"--progress": `${progress * 3.6}deg`} as React.CSSProperties}><span>{progress}%</span></div></div>
                <div className="task-list">{dayTasks.length ? dayTasks.map(task => editingId === task.id ? <form className="task edit-task" key={task.id} onSubmit={event => { event.preventDefault(); saveTaskEdit(task); }}><span className="edit-mark">✎</span><div className="edit-fields"><input autoFocus aria-label="Edit task title" value={editTitle} onChange={e => setEditTitle(e.target.value)} /><div><input aria-label="Edit task time" type="time" value={editTime} onChange={e => setEditTime(e.target.value)} /><select aria-label="Edit task priority" value={editPriority} onChange={e => setEditPriority(e.target.value as Task["priority"])}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div></div><div className="task-actions"><button className="save-mini" type="submit" aria-label="Save task changes">✓</button><button className="delete" type="button" onClick={() => setEditingId(null)} aria-label="Cancel editing">×</button></div></form> : <article className={`task ${task.completed ? "done" : ""}`} key={task.id}><button className="check" onClick={() => toggleTask(task)} aria-label={`${task.completed ? "Reopen" : "Complete"} ${task.title}`}>{task.completed ? "✓" : ""}</button><div><strong>{task.title}</strong><span><time>{task.dueTime}</time> · <em className={task.priority}>{task.priority}</em></span></div><div className="task-actions"><button className="edit" onClick={() => startEdit(task)} aria-label={`Edit ${task.title}`}>✎</button><button className="delete" onClick={() => deleteTask(task.id)} aria-label={`Delete ${task.title}`}>×</button></div></article>) : <Empty text="Nothing is asking for your attention yet." />}</div>
                {showTaskForm ? <form className="task-form" onSubmit={addTask}><input autoFocus aria-label="Task title" value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="What needs your attention?" /><input aria-label="Due time" type="time" value={taskTime} onChange={e => setTaskTime(e.target.value)} /><select aria-label="Priority" value={priority} onChange={e => setPriority(e.target.value as Task["priority"])}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select><button type="submit" className="primary">Add</button><button type="button" onClick={() => setShowTaskForm(false)}>Cancel</button></form> : <button className="add-row" onClick={() => setShowTaskForm(true)}>＋ Add an intention</button>}
              </section>

              <section className="page-card rhythm-card"><div className="section-heading"><div><span className="kicker">A GENTLE RHYTHM</span><h2>Today, at a glance</h2></div><span>{complete} of {dayTasks.length} complete</span></div><div className="rhythm-track">{dayTasks.map(task => <div key={task.id} className={task.completed ? "complete" : ""}><span></span><time>{task.dueTime}</time><small>{task.title}</small></div>)}</div></section>
              <section className="page-card closure-card"><div><span className="kicker">THE DAYMARK RITUAL</span><h2>Close the day, not just the list.</h2><p>Daymark writes a closing line into today’s journal and carries unfinished intentions into tomorrow—so nothing quietly disappears.</p></div><div className="closure-stats"><strong>{complete}</strong><span>done</span><strong>{dayTasks.length - complete}</strong><span>to carry</span></div><button className="primary" onClick={closeDay}>Close today & carry forward</button></section>
            </div>

            <div className="side-column">
              <section className="page-card journal-card"><div className="section-heading"><div><span className="kicker">A NOTE TO SELF</span><h2>How was your day?</h2></div><button className="delete" onClick={deleteJournal} aria-label="Delete journal entry">{dayEntry ? "Delete" : "Clear"}</button></div><textarea value={journal} onChange={e => setJournal(e.target.value)} placeholder="A thought, a feeling, a small moment worth keeping…" aria-label="Journal entry" /><div className="journal-actions"><span>{journal.length} characters</span><button className="primary" onClick={saveJournal}>Save reflection</button></div></section>
              <section className="page-card checkin-card"><span className="kicker">DAILY CHECK-IN</span><h2>Your inner weather</h2><label>Mood <span>{["Heavy", "Low", "Steady", "Good", "Bright"][mood-1]}</span></label><div className="scale">{[1,2,3,4,5].map(value => <button key={value} className={mood === value ? "selected" : ""} onClick={() => setMood(value)} aria-label={`Mood ${value} of 5`}>{["☂", "◔", "◐", "☀", "✦"][value-1]}</button>)}</div><label>Energy <span>{energy}/5</span></label><input type="range" min="1" max="5" value={energy} onChange={e => setEnergy(Number(e.target.value))} aria-label="Energy level" /></section>
              <section className="insight"><span>✦</span><div><strong>A small observation</strong><p>{progress >= 75 ? "You followed through beautifully today. Leave some room to rest." : progress > 0 ? "Momentum is already here. One gentle next step is enough." : "Begin with the smallest honest step. The day can grow from there."}</p></div></section>
            </div>
          </div>
        )}
      </section>

      <nav className="mobile-nav" aria-label="Mobile navigation"><button className={view === "today" ? "active" : ""} onClick={() => setView("today")}><span>⌂</span>Today</button><button className={view === "timeline" ? "active" : ""} onClick={() => setView("timeline")}><span>◷</span>Timeline</button><button className={view === "journal" ? "active" : ""} onClick={() => setView("journal")}><span>✎</span>Journal</button></nav>
      {onboarding === "open" && <div className="welcome-overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title"><form className="welcome-card" onSubmit={saveName}><span className="welcome-mark">D</span><span className="kicker">WELCOME TO DAYMARK</span><h2 id="welcome-title">What should we call you?</h2><p>This name is only used to make your private space feel like yours. You can use your first name, nickname, or anything you like.</p><label htmlFor="display-name">Your name</label><input id="display-name" autoFocus value={nameDraft} onChange={event => setNameDraft(event.target.value)} placeholder="e.g. Hari" maxLength={40} required /><button className="primary" type="submit">Enter my Daymark</button><small>Signed in as {user.email}</small></form></div>}
    </main>
  );
}

function Empty({ text }: { text: string }) { return <div className="empty"><span>✦</span><p>{text}</p></div>; }
