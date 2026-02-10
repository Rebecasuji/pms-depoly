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
  // Optional physical/location field near client
  location: text("location"),

  status: text("status").notNull().default("open"),
  progress: integer("progress").notNull().default(0),

  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  // Track which employee created the project (optional)
  createdByEmployeeId: uuid("created_by_employee_id"),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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

  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),

  createdAt: timestamp("created_at").defaultNow(),
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

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
  createdAt: timestamp("created_at").defaultNow(),
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

/* ===============================
   TYPES
================================ */
export type User = typeof users.$inferSelect;
export type Employee = typeof employees.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type KeyStep = typeof keySteps.$inferSelect;
export type ProjectTask = typeof projectTasks.$inferSelect;
export type TaskMember = typeof taskMembers.$inferSelect;
export type Subtask = typeof subtasks.$inferSelect;
export type ProjectFile = typeof projectFiles.$inferSelect;
export type Vendor = typeof vendors.$inferSelect;
export type Session = typeof sessions.$inferSelect;
