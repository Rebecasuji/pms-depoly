
import { db } from "../server/db";
import { users, employees, projects, projectTasks, subtasks, subtaskMembers } from "../shared/schema";
import { eq } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

async function run() {
    console.log("Starting reproduction script (enhanced)...");

    try {
        // 1. Create dummy employee
        console.log("Creating dummy employee...");
        const [emp] = await db.insert(employees).values({
            name: "Test Employee",
            empCode: "EMP-TEST-" + Date.now(),
        }).returning();
        console.log("Employee created:", emp.id);

        // 2. Create dummy project
        const [project] = await db.insert(projects).values({
            title: "Repro Project",
            projectCode: `RP-${Date.now()}`,
            status: "Planned",
            startDate: new Date().toISOString().split('T')[0],
            endDate: new Date().toISOString().split('T')[0],
        } as any).returning();

        // 3. Create dummy task
        const [task] = await db.insert(projectTasks).values({
            projectId: project.id,
            taskName: "Repro Task",
            status: "pending",
            assignerId: emp.id,
        } as any).returning();

        // 4. Create dummy subtask
        const [subtask] = await db.insert(subtasks).values({
            taskId: task.id,
            title: "Repro Subtask",
            isCompleted: false,
        }).returning();

        // 5. Assign member to subtask
        console.log("Assigning member to subtask...");
        await db.insert(subtaskMembers).values({
            subtaskId: subtask.id,
            employeeId: emp.id
        });
        console.log("Member assigned.");

        // 6. Patch it (simulating the route handler)
        console.log("Attempting to patch subtask...");
        const updateData = { isCompleted: true };
        const [updated] = await db.update(subtasks)
            .set(updateData)
            .where(eq(subtasks.id, subtask.id))
            .returning();

        if (!updated) console.error("Update returned null/undefined!");
        else console.log("Update returning success, got id:", updated.id);

        // 7. Run the subtaskMembers query exactly as in routes.ts
        console.log("Running subtaskMembers query...");
        let assigned: string[] = [];
        try {
            const rows = await db.select({ employeeId: subtaskMembers.employeeId })
                .from(subtaskMembers)
                .where(eq(subtaskMembers.subtaskId, subtask.id));

            assigned = rows.map(r => r.employeeId);
            console.log("Query successful. Assigned:", assigned);
        } catch (e: any) {
            console.error("❌ Error in subtaskMembers query:", e);
            // Simulate fallback
            // assigned = updated.assignedTo ? [updated.assignedTo] : []; // TS might complain here if types wrong
            throw e;
        }

    } catch (err) {
        console.error("❌ Error caught in run():", err);
        process.exit(1);
    }
}

run();
