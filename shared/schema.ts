import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
  jsonb,
  date,
  uuid,
  bigint,
} from "drizzle-orm/pg-core";
import { z } from "zod";

/* ===============================
   USERS
================================ */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  // Link to employee record (optional)
  employeeId: uuid("employee_id").references(() => employees.id),
  // Role: 'ADMIN' or 'EMPLOYEE'
  role: text("role").default("EMPLOYEE"),
  // Persistent filter preferences
  filterSettings: jsonb("filter_settings").default({}),
});

/* ===============================
   EMPLOYEES
================================ */
export const employees = pgTable("employees", {
  id: uuid("id").defaultRandom().primaryKey(),
  empCode: text("emp_code").unique(),
  name: text("name").notNull(),
  designation: text("designation"),
  department: text("department"),
  email: text("email"),
  phone: text("phone"),
  createdAt: timestamp("created_at").defaultNow(),
});

/* ===============================
   PROJECTS  ✅ NEON DATABASE
================================ */
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),

  title: text("title").notNull(),
  projectCode: text("project_code").notNull(),

  description: text("description"),

  clientName: text("client_name"),
  company: text("company"),
  // Optional physical/location field near client
  location: text("location"),
  holdReason: text("hold_reason"),

  status: text("status").notNull().default("Planned"),
  progress: integer("progress").notNull().default(0),

  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  // Track which employee created the project (optional)
  createdByEmployeeId: uuid("created_by_employee_id"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

/* add location to insert schema */

/* ===============================
   PROJECT DEPARTMENTS
================================ */
export const projectDepartments = pgTable("project_departments", {
  projectId: uuid("project_id").notNull(),
  department: text("department").notNull(),
});

/* ===============================
   PROJECT TEAM MEMBERS
================================ */
export const projectTeamMembers = pgTable("project_team_members", {
  projectId: uuid("project_id").notNull(),
  employeeId: uuid("employee_id").notNull(),
});

/* ===============================
   PROJECT VENDORS
================================ */
export const projectVendors = pgTable("project_vendors", {
  projectId: uuid("project_id").notNull(),
  vendorName: text("vendor_name").notNull(),
});

/* ===============================
   KEY STEPS (with nesting support)
================================ */
export const keySteps = pgTable("key_steps", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull(),
  parentKeyStepId: uuid("parent_key_step_id"), // For nested key steps

  header: varchar("header", { length: 255 }),
  title: varchar("title", { length: 255 }).notNull(),

  description: text("description"),
  requirements: text("requirements"),

  phase: integer("phase").notNull(),
  status: varchar("status", { length: 20 }).default("pending"),

  startDate: date("start_date"),
  endDate: date("end_date"),

  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  progress: integer("progress").default(0).notNull(),
});

/* ===============================
   KEY STEP TEMPLATES
================================ */
export const keyStepTemplates = pgTable("key_step_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const keyStepTemplateItems = pgTable("key_step_template_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  templateId: uuid("template_id").notNull().references(() => keyStepTemplates.id, { onDelete: "cascade" }),
  header: varchar("header", { length: 255 }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  requirements: text("requirements"),
  phase: integer("phase").notNull(),
});


/* ===============================
   PROJECT TASKS
================================ */
export const projectTasks = pgTable("project_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),

  projectId: uuid("project_id").notNull(),
  keyStepId: uuid("key_step_id"),

  taskName: text("task_name").notNull(),
  description: text("description"),

  status: text("status").default("pending"),
  priority: text("priority").default("medium"),

  startDate: date("start_date"),
  endDate: date("end_date"),

  assignerId: uuid("assigner_id").notNull(),
  taskPeriod: text("task_period").default("custom"), // Today, 1 Week, Fortnight, 1 Month, Quarterly, Half Yearly, Annual, custom
  reminderFrequency: text("reminder_frequency").default("4 times"), // 1 Time, 2 Times, 4 Times, Daily, Weekly, Monthly, Custom
  lastNotifiedAt: timestamp("last_notified_at"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  completedAt: timestamp("completed_at"),
  progress: integer("progress").default(0).notNull(),
  ticketId: uuid("ticket_id"),
});

/* ===============================
   TASK MEMBERS
================================ */
export const taskMembers = pgTable("task_members", {
  taskId: uuid("task_id").notNull(),
  employeeId: uuid("employee_id").notNull(),
});

/* ===============================
   SUBTASK MEMBERS (many-to-many)
================================ */
export const subtaskMembers = pgTable("subtask_members", {
  subtaskId: uuid("subtask_id").notNull().references(() => subtasks.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id").notNull(),
});

/* ===============================
   SUBTASKS
================================ */
export const subtasks = pgTable("subtasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull().references(() => projectTasks.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").default(""),
  isCompleted: boolean("is_completed").default(false),
  assignedTo: uuid("assigned_to").references(() => employees.id),
  startDate: date("start_date"),
  endDate: date("end_date"),
  createdAt: timestamp("created_at").defaultNow(),
  progress: integer("progress").default(0).notNull(),
});

/* ===============================
   PROJECT FILES  ✅ NEON
================================ */
export const projectFiles = pgTable("project_files", {
  id: uuid("id").defaultRandom().primaryKey(),

  projectId: uuid("project_id").notNull(),

  fileName: text("file_name").notNull(),
  fileSize: bigint("file_size", { mode: "number" }).notNull(),
  mimeType: text("mime_type"),
  storageUrl: text("storage_url"),

  createdAt: timestamp("created_at").defaultNow(),
});

/* ===============================
   SESSIONS (server-side tokens)
================================ */
export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  token: text("token").notNull().unique(),
  userId: uuid("user_id").references(() => users.id),
  employeeId: uuid("employee_id").references(() => employees.id),
  empCode: text("emp_code"),
  role: text("role"),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
});

/* ===============================
   VENDORS
================================ */
export const vendors = pgTable("vendors", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  createdAt: timestamp("created_at").defaultNow(),
});

/* ===============================
   PROGRESS LOGS
================================ */
export const progressLogs = pgTable("progress_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id"),
  keyStepId: uuid("key_step_id"),
  taskId: uuid("task_id"),
  subtaskId: uuid("subtask_id"),
  percentage: integer("percentage").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
  updatedBy: uuid("updated_by"),
});

/* ===============================
   DISCUSSIONS
================================ */
export const discussions = pgTable("discussions", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  createdBy: uuid("created_by").notNull().references(() => employees.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* ===============================
   DISCUSSION REPLIES
================================ */
export const discussionReplies = pgTable("discussion_replies", {
  id: uuid("id").defaultRandom().primaryKey(),
  discussionId: uuid("discussion_id").notNull().references(() => discussions.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdBy: uuid("created_by").notNull().references(() => employees.id),
  createdAt: timestamp("created_at").defaultNow(),
});

/* ===============================
   DISCUSSION PARTICIPANTS
================================ */
export const discussionParticipants = pgTable("discussion_participants", {
  discussionId: uuid("discussion_id").notNull().references(() => discussions.id, { onDelete: "cascade" }),
  employeeId: uuid("employee_id").notNull().references(() => employees.id, { onDelete: "cascade" }),
});

/* ===============================
   DISCUSSION ATTACHMENTS
================================ */
export const discussionAttachments = pgTable("discussion_attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  discussionId: uuid("discussion_id").references(() => discussions.id, { onDelete: "cascade" }),
  replyId: uuid("reply_id").references(() => discussionReplies.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileSize: bigint("file_size", { mode: "number" }).notNull(),
  mimeType: text("mime_type"),
  storageUrl: text("storage_url").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
/* ===============================
   SITE REPORTS
================================ */
export const siteReports = pgTable("site_reports", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  taskId: uuid("task_id").references(() => projectTasks.id, { onDelete: "set null" }),
  subtaskId: uuid("subtask_id").references(() => subtasks.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdBy: uuid("created_by").notNull().references(() => employees.id),
  clientEmail: text("client_email"),
  createdAt: timestamp("created_at").defaultNow(),
});

/* ===============================
   SITE REPORT ATTACHMENTS
================================ */
export const siteReportAttachments = pgTable("site_report_attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  reportId: uuid("report_id").notNull().references(() => siteReports.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileSize: bigint("file_size", { mode: "number" }).notNull(),
  mimeType: text("mime_type"),
  storageUrl: text("storage_url").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

/* ===============================
   TICKETS
================================ */
export const tickets = pgTable("tickets", {
  id: uuid("id").defaultRandom().primaryKey(),
  ticketCode: text("ticket_code").notNull().unique(), // Auto-generated ID like TKT-001
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  priority: text("priority").notNull().default("Medium"), // Critical, High, Medium, Low
  department: text("department").notNull(),
  projectId: uuid("project_id").references(() => projects.id),
  status: text("status").notNull().default("Open"), // Open, In Progress, Resolved, Closed
  createdBy: uuid("created_by").notNull().references(() => employees.id),
  assignedTo: uuid("assigned_to").references(() => employees.id),
  manualProject: text("manual_project"),
  companyName: text("company_name"),
  participants: jsonb("participants").default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
  taskId: uuid("task_id"),
});

/* ===============================
   TICKET COMMENTS
================================ */
export const ticketComments = pgTable("ticket_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  ticketId: uuid("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdBy: uuid("created_by").notNull().references(() => employees.id),
  createdAt: timestamp("created_at").defaultNow(),
});

/* ===============================
   TICKET ATTACHMENTS
================================ */
export const ticketAttachments = pgTable("ticket_attachments", {
  id: uuid("id").defaultRandom().primaryKey(),
  ticketId: uuid("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileSize: bigint("file_size", { mode: "number" }).notNull(),
  mimeType: text("mime_type"),
  storageUrl: text("storage_url").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

/* ===============================
   EMAIL GROUPS
================================ */
export const emailGroups = pgTable("email_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  emails: text("emails").notNull(), // Comma-separated emails
  createdBy: uuid("created_by").notNull().references(() => employees.id),
  createdAt: timestamp("created_at").defaultNow(),
});

/* ===============================
   TASK COMMENTS
================================ */
export const taskComments = pgTable("task_comments", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull().references(() => projectTasks.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdBy: uuid("created_by").notNull().references(() => employees.id),
  createdAt: timestamp("created_at").defaultNow(),
});

/* ===============================
   ZOD SCHEMAS
================================ */
export const insertProjectSchema = z.object({
  title: z.string().min(1),
  projectCode: z.string().optional(),
  department: z.array(z.string()).optional(),
  description: z.string().optional(),

  clientName: z.string().optional(), // ✅ REQUIRED FOR UI
  location: z.string().optional(),

  status: z.string().optional(),
  progress: z.number().optional(),

  startDate: z.string().optional(),
  endDate: z.string().optional(),

  assignerId: z.string().uuid().optional(),

  vendors: z.array(z.string()).optional(),
});

export const insertTicketSchema = z.object({
  title: z.string().optional().default("No Title"),
  description: z.string().optional().default(""),
  category: z.string().optional().default("Other"),
  priority: z.string().default("Medium"),
  department: z.string().optional().default("General"),
  projectId: z.string().uuid().optional().nullable(),
  manualProject: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  participants: z.array(z.string()).optional().default([]),
  assignedTo: z.string().uuid().optional().nullable(),
});

export const insertKeyStepTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional(),
});

export const insertKeyStepTemplateItemSchema = z.object({
  templateId: z.string().uuid(),
  header: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  requirements: z.string().optional(),
  phase: z.number().int(),
});

/* ===============================
   TYPES
================================ */
export type User = typeof users.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type KeyStep = typeof keySteps.$inferSelect;
export type ProjectTask = typeof projectTasks.$inferSelect;
export type TaskMember = typeof taskMembers.$inferSelect;
export type Subtask = typeof subtasks.$inferSelect & {
  startDate?: string;
  endDate?: string;
  isCompleted: boolean;
};
export type ProjectFile = typeof projectFiles.$inferSelect;
export type Vendor = typeof vendors.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type ProgressLog = typeof progressLogs.$inferSelect;
export type Discussion = typeof discussions.$inferSelect;
export type DiscussionReply = typeof discussionReplies.$inferSelect;
export type DiscussionParticipant = typeof discussionParticipants.$inferSelect;
export type DiscussionAttachment = typeof discussionAttachments.$inferSelect;

export type Ticket = typeof tickets.$inferSelect;
export type TicketComment = typeof ticketComments.$inferSelect;
export type TicketAttachment = typeof ticketAttachments.$inferSelect;
export type TaskComment = typeof taskComments.$inferSelect;

export type KeyStepTemplate = typeof keyStepTemplates.$inferSelect;
export type KeyStepTemplateItem = typeof keyStepTemplateItems.$inferSelect;

