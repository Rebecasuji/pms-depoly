import "dotenv/config";
import { db } from "./db.ts";
import { users } from "../shared/schema.ts";
async function check() {
  const data = await db.select().from(users);
  console.log(data);
  process.exit(0);
}

check();
