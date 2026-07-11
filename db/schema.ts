import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(), ownerEmail: text("owner_email").notNull(), title: text("title").notNull(),
  dueDate: text("due_date").notNull(), dueTime: text("due_time").notNull(), priority: text("priority").notNull(),
  completed: integer("completed", { mode: "boolean" }).notNull().default(false), updatedAt: text("updated_at").notNull(),
});
export const entries = sqliteTable("entries", {
  id: text("id").primaryKey(), ownerEmail: text("owner_email").notNull(), entryDate: text("entry_date").notNull(),
  content: text("content").notNull(), mood: integer("mood").notNull(), energy: integer("energy").notNull(), updatedAt: text("updated_at").notNull(),
}, table => [uniqueIndex("entries_owner_date_idx").on(table.ownerEmail, table.entryDate)]);

export const profiles = sqliteTable("profiles", {
  ownerEmail: text("owner_email").primaryKey(), displayName: text("display_name").notNull(), updatedAt: text("updated_at").notNull(),
});
