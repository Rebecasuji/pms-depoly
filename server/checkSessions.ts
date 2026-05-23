import "dotenv/config";
import { db } from "./db.ts";
import { sessions } from "../shared/schema.ts";
import { sql } from "drizzle-orm";
async function check() {
  const activeSessions = await db.select().from(sessions);
  console.log("Total active sessions:", activeSessions.length);
  if (activeSessions.length > 0) {
    console.log("Sessions details:", activeSessions.map(s => ({
      empCode: s.empCode,
      role: s.role,
      createdAt: s.createdAt,
      expiresAt: s.expiresAt,
    })));
  }
  process.exit(0);
}
check();
