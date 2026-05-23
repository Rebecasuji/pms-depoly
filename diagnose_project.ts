import "dotenv/config";
import { db } from "./server/db.ts";
import { projects, employees, projectTasks } from "./shared/schema.ts";
import { eq, ilike } from "drizzle-orm";

async function diagnose() {
    const projectTitle = "Office Support"; // Specific project from user screenshot
    console.log(`🔍 Diagnosing project: "${projectTitle}"`);

    // 1. Find the project
    const [project] = await db
        .select()
        .from(projects)
        .where(ilike(projects.title, `%${projectTitle}%`));

    if (!project) {
        console.error("❌ Project not found!");
        process.exit(1);
    }

    console.log("✅ Project Details:", {
        id: project.id,
        title: project.title,
        createdByEmployeeId: project.createdByEmployeeId,
    });

    if (project.createdByEmployeeId) {
        const [creator] = await db.select().from(employees).where(eq(employees.id, project.createdByEmployeeId));
        console.log("👤 Original Project Creator:", creator ? `${creator.name} (${creator.empCode})` : "Not found in employees table");
    } else {
        console.log("⚠️ No createdByEmployeeId found for this project.");
    }

    // 2. Check Tasks and their assigners
    const tasks = await db
        .select({
            taskId: projectTasks.id,
            taskName: projectTasks.taskName,
            assignerId: projectTasks.assignerId
        })
        .from(projectTasks)
        .where(eq(projectTasks.projectId, project.id));

    console.log(`\n📋 Project Tasks (${tasks.length}):`);
    for (const t of tasks) {
        const [assigner] = await db
            .select({ name: employees.name, code: employees.empCode })
            .from(employees)
            .where(eq(employees.id, t.assignerId));

        console.log(`  - ${t.taskName} (ID: ${t.taskId})`);
        console.log(`    Assigner: ${assigner ? `${assigner.name} (${assigner.code})` : "Unknown ID: " + t.assignerId}`);
    }

    process.exit(0);
}

diagnose().catch(err => {
    console.error(err);
    process.exit(1);
});
