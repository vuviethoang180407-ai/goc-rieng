import { sqliteTable, text, integer, primaryKey, index } from "drizzle-orm/sqlite-core";
export const profiles = sqliteTable("profiles", {
 id: text("id").primaryKey(), name: text("name").notNull(), bio: text("bio").notNull().default(""),
 code: text("code").notNull().unique(), created: text("created").notNull(),
});
export const spaces = sqliteTable("spaces", {
 userId: text("user_id").primaryKey().references(()=>profiles.id), data: text("data").notNull(),
});
export const friendships = sqliteTable("friendships", {
 a: text("a").notNull().references(()=>profiles.id), b: text("b").notNull().references(()=>profiles.id),
 sender: text("sender").notNull().references(()=>profiles.id), status: text("status").notNull(),
 created: text("created").notNull(),
}, t=>[primaryKey({columns:[t.a,t.b]})]);
export const messages = sqliteTable("messages", {
 id: text("id").primaryKey(), sender: text("sender").notNull().references(()=>profiles.id),
 recipient: text("recipient").notNull().references(()=>profiles.id), body:text("body").notNull(), created:text("created").notNull(),
},t=>[index("message_pair").on(t.sender,t.recipient,t.created)]);
export const plans = sqliteTable("plans",{
 id:text("id").primaryKey(), owner:text("owner").notNull().references(()=>profiles.id),
 title:text("title").notNull(), description:text("description").notNull().default(""),
 eventAt:text("event_at"), created:text("created").notNull(),
});
export const members=sqliteTable("members",{
 planId:text("plan_id").notNull().references(()=>plans.id), userId:text("user_id").notNull().references(()=>profiles.id),
 status:text("status").notNull(),
},t=>[primaryKey({columns:[t.planId,t.userId]})]);
export const tasks=sqliteTable("tasks",{
 id:text("id").primaryKey(), planId:text("plan_id").notNull().references(()=>plans.id),
 title:text("title").notNull(), assignee:text("assignee").references(()=>profiles.id),
 dueAt:text("due_at"), done:integer("done").notNull().default(0), created:text("created").notNull(),
},t=>[index("tasks_plan").on(t.planId)]);

export const publications=sqliteTable("publications",{
 userId:text("user_id").primaryKey().references(()=>profiles.id),
 token:text("token").notNull().unique(),data:text("data").notNull(),
 active:integer("active").notNull().default(1),updated:text("updated").notNull(),
});
