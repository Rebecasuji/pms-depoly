import "dotenv/config";
import { db } from "./db";
import { users } from "../shared/schema";
async function check() {
  const data = await db.select().from(users);
  console.log(data);
  process.exit(0);
}

check();
