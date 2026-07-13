import type { DaymarkEntry, DaymarkTask, LifeArea } from "./supabase-data";

function monthKey(date: string) { return date.slice(0, 7); }
function monthName(key: string) { return new Date(`${key}-01T12:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" }); }

export default function InsightsPanel({ tasks, entries }: { tasks: DaymarkTask[]; entries: DaymarkEntry[] }) {
  const now = new Date();
  const weekStart = new Date(now.getTime() - 6 * 86400000).toISOString().slice(0, 10);
  const weekTasks = tasks.filter(task => task.dueDate >= weekStart);
  const completed = weekTasks.filter(task => task.completed);
  const areaCounts = completed.reduce<Record<string, number>>((counts, task) => ({ ...counts, [task.area]: (counts[task.area] ?? 0) + 1 }), {});
  const leadingArea = Object.entries(areaCounts).sort((a, b) => b[1] - a[1])[0];
  const following = tasks.filter(task => !task.completed && task.carriedCount > 0).sort((a, b) => b.carriedCount - a.carriedCount);
  const strongest = [...entries].sort((a, b) => b.energy - a.energy || b.entryDate.localeCompare(a.entryDate))[0];
  const goodDates = new Set(entries.filter(entry => entry.mood >= 4).map(entry => entry.entryDate));
  const goodAreas = tasks.filter(task => task.completed && goodDates.has(task.dueDate)).reduce<Record<string, number>>((counts, task) => ({ ...counts, [task.area]: (counts[task.area] ?? 0) + 1 }), {});
  const betterDayArea = Object.entries(goodAreas).sort((a, b) => b[1] - a[1])[0];
  const thisMonth = now.toISOString().slice(0, 7);
  const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousMonth = previousDate.toISOString().slice(0, 7);
  const monthDone = (key: string) => tasks.filter(task => task.completed && monthKey(task.dueDate) === key).length;
  const currentDone = monthDone(thisMonth);
  const previousDone = monthDone(previousMonth);

  return <section className="insights-page">
    <div className="insights-hero"><span className="kicker">WHAT YOUR DAYS ARE SHOWING</span><h2>Understand your days</h2><p>These observations come from your intentions and check-ins. They become more useful as you use Daymark.</p></div>
    <div className="insight-grid">
      <Insight title="Where did my attention go this week?" value={leadingArea ? leadingArea[0] : "Not enough recorded yet"} detail={leadingArea ? `${leadingArea[1]} completed intention${leadingArea[1] === 1 ? "" : "s"} in ${leadingArea[0].toLowerCase()}.` : "Complete a few intentions and Daymark will show the pattern."} />
      <Insight title="Which intentions keep following me?" value={following[0]?.title ?? "Nothing is following you"} detail={following[0] ? `Carried forward ${following[0].carriedCount} time${following[0].carriedCount === 1 ? "" : "s"}. It may need a smaller first step.` : "No repeatedly postponed intentions yet."} />
      <Insight title="When was my energy highest?" value={strongest ? new Date(`${strongest.entryDate}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }) : "No check-ins yet"} detail={strongest ? `Energy ${strongest.energy}/5 and mood ${strongest.mood}/5.` : "Your daily check-ins will reveal this."} />
      <Insight title="What appears on my better days?" value={betterDayArea?.[0] ?? "Still learning"} detail={betterDayArea ? `${betterDayArea[0]} appears most often among completed intentions on higher-mood days.` : "Daymark needs a few higher-mood days with completed intentions."} />
      <Insight title="What have I accomplished?" value={`${completed.length} this week`} detail={completed.length ? completed.slice(0, 3).map(task => task.title).join(" · ") : "Completed intentions will be remembered here."} />
      <Insight title="What changed month to month?" value={`${currentDone} completed in ${monthName(thisMonth)}`} detail={`${previousDone} completed in ${monthName(previousMonth)}. ${currentDone === previousDone ? "The pace is similar." : currentDone > previousDone ? "You have completed more this month so far." : "This month has asked for a different pace."}`} />
    </div>
    {following.length > 1 && <div className="following-list"><h3>Intentions carried forward</h3>{following.slice(0, 5).map(task => <div key={task.id}><span>{task.title}</span><strong>{task.carriedCount}×</strong><small>{task.area as LifeArea}</small></div>)}</div>}
  </section>;
}

function Insight({ title, value, detail }: { title: string; value: string; detail: string }) {
  return <article className="page-card insight-card"><span>{title}</span><strong>{value}</strong><p>{detail}</p></article>;
}
