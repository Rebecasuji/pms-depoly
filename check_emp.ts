import "dotenv/config";
import { db } from "./server/db.ts";
import { employees } from "./shared/schema.ts";
import { eq } from "drizzle-orm";

async function checkEmp() {
    const id = "f55426e9-7043-4c63-bf3c-bf746bba2435";
    console.log(`🔍 Checking Employee ID: ${id}`);

    const [emp] = await db.select().from(employees).where(eq(employees.id, id));

    if (emp) {
        console.log("✅ Employee Found:", {
            id: emp.id,
            name: emp.name,
            code: emp.empCode
        });
    } else {
        console.log("❌ Employee not found!");
    }
    process.exit(0);
}

checkEmp().catch(err => {
    console.error(err);
    process.exit(1);
});
