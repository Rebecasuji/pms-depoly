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
} from "drizzle-orm/pg-core";
import { z } from "zod";

/* ===============================
    USERS & EMPLOYEES
================================ */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const employees = pgTable("employees", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  empCode: text("emp_code").unique(),
  designation: text("designation"),
  email: text("email"),
  phone: text("phone"),
  createdAt: timestamp("created_at").defaultNow(),
});

/* ===============================
    PROJECTS
================================ */
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("open"),
  progress: integer("progress").default(0),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),

  assignerId: uuid("assigner_id"), // ✅ ADD THIS

  vendors: jsonb("vendors").default(sql`'[]'::jsonb`),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

/* ===============================
    KEY STEPS
================================ */
export const keySteps = pgTable("key_steps", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull(),
  header: varchar("header", { length: 255 }),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  requirements: text("requirements"),
  phase: integer("phase").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

/* ===============================
    PROJECT TASKS (Core Table)
================================ */
export const projectTasks = pgTable("project_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull(),
  keyStepId: uuid("key_step_id"), // Optional link to a specific phase
  taskName: text("task_name").notNull(),
  description: text("description"),
  status: text("status").default("pending"),
  priority: text("priority").default("medium"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  assignerId: uuid("assigner_id").notNull(), // The person creating the task
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

/* ===============================
    TASK MEMBERS (Many-to-Many Assignees)
================================ */
export const taskMembers = pgTable("task_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull(),
  employeeId: uuid("employee_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/* ===============================
    SUBTASKS
================================ */
export const subtasks = pgTable("subtasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  taskId: uuid("task_id").notNull(), // Parent project task
  title: text("title").notNull(),
  isCompleted: boolean("is_completed").default(false),
  assignedTo: uuid("assigned_to"), // Single employee assigned to this specific subtask
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

/* ===============================
    PROJECT FILES & VENDORS
================================ */
export const projectFiles = pgTable("project_files", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id").notNull(),
  fileName: text("file_name").notNull(),
  filePath: text("file_path").notNull(),
  fileUrl: text("file_url"),
  fileSize: integer("file_size"),
  uploadedBy: uuid("uploaded_by"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const vendors = pgTable("vendors", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  company: text("company"),
  createdAt: timestamp("created_at").defaultNow(),
});

/* ===============================
    ZOD VALIDATION SCHEMAS
================================ */
export const insertUserSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

export const insertProjectTaskSchema = z.object({
  projectId: z.string().uuid(),
  keyStepId: z.string().uuid().optional(),
  taskName: z.string().min(1),
  description: z.string().optional(),
  priority: z.string().default("medium"),
  status: z.string().default("pending"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  assignerId: z.string().uuid(),
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