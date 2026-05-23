import { db } from "./db.ts";
import { projectTasks, taskMembers, employees, projects, users } from "../shared/schema.ts";
import { eq, and, sql, or, inArray } from "drizzle-orm";
import { sendTaskAssignmentEmail } from "./email.ts";

// Default reminder timings (can be moved to a config table later)
const REMINDER_HOURS = [9, 13, 17, 21]; // 9 AM, 1 PM, 5 PM, 9 PM

export async function processReminders() {
  const now = new Date();
  const currentHour = now.getHours();

  // Basic check: we only send reminders at these specific hours
  const REMINDER_HOURS = [9, 13, 17, 21]; // 9 AM, 1 PM, 5 PM, 9 PM
  if (!REMINDER_HOURS.includes(currentHour)) {
    return;
  }

  console.log(`[REMINDERS] Checking for tasks to notify at ${currentHour}:00`);

  try {
    const todayStr = now.toISOString().split('T')[0];
    
    // Get all tasks that are not completed
    const pendingTasks = await db.select({
      id: projectTasks.id,
      taskName: projectTasks.taskName,
      status: projectTasks.status,
      priority: projectTasks.priority,
      startDate: projectTasks.startDate,
      endDate: projectTasks.endDate,
      taskPeriod: projectTasks.taskPeriod,
      reminderFrequency: projectTasks.reminderFrequency,
      projectId: projectTasks.projectId,
      assignerId: projectTasks.assignerId,
      lastNotifiedAt: projectTasks.lastNotifiedAt,
      createdAt: projectTasks.createdAt,
    })
    .from(projectTasks)
    .where(
      and(
        sql`LOWER(${projectTasks.status}) != 'completed'`,
        or(
          sql`${projectTasks.lastNotifiedAt} IS NULL`,
          and(
            // Use server-side today comparison
            sql`DATE(${projectTasks.lastNotifiedAt}) < ${todayStr}::DATE`,
            sql`${currentHour} = ${currentHour}` // placeholder to keep logic same
          ),
          and(
            sql`DATE(${projectTasks.lastNotifiedAt}) = ${todayStr}::DATE`,
            // Extract hour from the timestamp stored in DB (assumed to be in sync with server's new Date())
            // If DB is UTC and server is Local, this might still be off. 
            // Better: Compare as absolute timestamps.
            sql`EXTRACT(HOUR FROM ${projectTasks.lastNotifiedAt}) != ${currentHour}`
          )
        )
      )
    );

    console.log(`[REMINDERS] Found ${pendingTasks.length} pending tasks. Filtering by frequency...`);

    for (const task of pendingTasks) {
      const freq = (task.reminderFrequency || "4 times").toLowerCase();
      let shouldNotify = false;

      // Logic for different frequencies
      if (freq === "1 time" || freq === "daily") {
        shouldNotify = currentHour === 9;
      } else if (freq === "2 times") {
        shouldNotify = (currentHour === 9 || currentHour === 17);
      } else if (freq === "4 times") {
        shouldNotify = REMINDER_HOURS.includes(currentHour);
      } else if (freq === "weekly") {
        const createdDate = task.createdAt ? new Date(task.createdAt) : new Date();
        shouldNotify = (currentHour === 9 && now.getDay() === createdDate.getDay());
      } else if (freq === "monthly") {
        const createdDate = task.createdAt ? new Date(task.createdAt) : new Date();
        shouldNotify = (currentHour === 9 && now.getDate() === createdDate.getDate());
      } else {
        // Custom or anything else defaults to 4 times for safety
        shouldNotify = REMINDER_HOURS.includes(currentHour);
      }

      if (!shouldNotify) {
        // console.log(`[REMINDERS] Skipping task ${task.taskName} - doesn't match frequency ${freq} for hour ${currentHour}`);
        continue;
      }

      // 1. Get assignees
      const members = await db.select({
        id: employees.id,
        name: employees.name,
        email: employees.email,
        empCode: employees.empCode,
      })
      .from(taskMembers)
      .leftJoin(employees, eq(taskMembers.employeeId, employees.id))
      .where(eq(taskMembers.taskId, task.id));

      if (members.length === 0) {
        console.log(`[REMINDERS] No assignees for task: ${task.taskName}, skipping notification.`);
        continue;
      }

      // 2. Get project & assigner details
      const [project] = await db.select().from(projects).where(eq(projects.id, task.projectId)).limit(1);
      const [assigner] = await db.select().from(employees).where(eq(employees.id, task.assignerId)).limit(1);

      const periodLabel = task.taskPeriod && task.taskPeriod !== "custom" ? task.taskPeriod : "Active";

      for (const member of members) {
        if (member && member.email) {
          const [userRow] = await db.select().from(users).where(eq(users.employeeId, member.id as string)).limit(1);
          const role = userRow?.role?.toLowerCase() as 'employee' | 'hr' | 'admin' || 'employee';

          console.log(`[REMINDERS] Sending reminder (${freq}) to ${member.email} for task: ${task.taskName}`);

          await sendTaskAssignmentEmail(
            member.email,
            {
              name: member.name || 'Unknown',
              code: member.empCode || 'N/A',
              project: project?.title || 'Unknown Project',
              assigner: assigner?.name || 'System',
              dueDate: task.endDate || 'Not Set',
            },
            {
              name: `REMINDER: ${task.taskName} (${periodLabel})`,
              priority: task.priority || 'medium',
              startDate: task.startDate || 'N/A',
              endDate: task.endDate || 'N/A',
              status: task.status || 'pending',
            },
            role,
            `TASK REMINDER (${periodLabel}) - Frequency: ${task.reminderFrequency || 'Standard'}`
          );
        }
      }

      // Update lastNotifiedAt
      await db.update(projectTasks)
        .set({ lastNotifiedAt: new Date() })
        .where(eq(projectTasks.id, task.id));
    }
  } catch (err) {
    console.error("[REMINDERS-ERROR] Failed to process reminders:", err);
  }
}

// Start the reminder check interval (every 30 minutes)
export function startReminderService() {
  console.log("[REMINDERS] Starting reminder service...");
  // Run once immediately on start
  processReminders();
  
  // Check every 30 minutes
  setInterval(processReminders, 30 * 60 * 1000);
}
