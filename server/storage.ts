import {
  users,
  employees,
  projects,
  projectTasks,
  taskMembers,
  type User,
  type Employee,
  type Project,
  type ProjectTask
} from "../shared/schema.ts";
import { db } from "./db.ts";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: typeof users.$inferInsert): Promise<User>;
  getEmployee(id: string): Promise<Employee | undefined>;

  getProject(id: string): Promise<Project | undefined>;
  getTaskMembers(taskId: string): Promise<string[]>;
  getTask(taskId: string): Promise<ProjectTask | undefined>;
  getAdminEmails(): Promise<string[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: typeof users.$inferInsert): Promise<User> {
    const [user] = await db.insert(users).values({
      ...insertUser,
      id: randomUUID(),
    } as any).returning();
    return user;
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.id, id));
    return employee;
  }

  async getProject(id: string): Promise<Project | undefined> {
    const [project] = await db.select().from(projects).where(eq(projects.id, id));
    return project;
  }

  async getTaskMembers(taskId: string): Promise<string[]> {
    const members = await db
      .select({ employeeId: taskMembers.employeeId })
      .from(taskMembers)
      .where(eq(taskMembers.taskId, taskId));
    return members.map((m) => m.employeeId);
  }

  async getTask(id: string): Promise<ProjectTask | undefined> {
    const [task] = await db.select().from(projectTasks).where(eq(projectTasks.id, id));
    return task;
  }

  async getAdminEmails(): Promise<string[]> {
    const admins = await db
      .select({ email: employees.email })
      .from(users)
      .innerJoin(employees, eq(users.employeeId, employees.id))
      .where(eq(users.role, "ADMIN"));

    return admins
      .map((a) => a.email)
      .filter((email): email is string => !!email);
  }
}

export const storage = new DatabaseStorage();
