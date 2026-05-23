import { db } from "./server/db.ts";
import { projects, projectDepartments, employees, users } from "./shared/schema.ts";
import { eq, inArray } from "drizzle-orm";

// Helper: matches backend
function normalizeDept(input?: string | null) {
  if (!input) return "";
  let v = String(input).trim().toLowerCase().replace(/\s+/g, " ");
  if (v === 'presales') return v;
  if (v.length > 3 && v.endsWith("s")) v = v.slice(0, -1);
  return v;
}

async function check() {
  const empCode = "E0046";
  const [emp] = await db.select().from(employees).where(eq(employees.empCode, empCode));
  const allProjs = await db.select().from(projects);
  const projDepts = await db.select().from(projectDepartments);
  
  const deptMap = new Map();
  projDepts.forEach(d => {
    if (!deptMap.has(d.projectId)) deptMap.set(d.projectId, []);
    deptMap.get(d.projectId).push(normalizeDept(d.department));
  });

  const softDept = normalizeDept("software developer");
  
  console.log(`FILTERING FOR ${empCode} (${emp.name}):`);
  const visible = allProjs.filter(p => {
    const projectDepts = deptMap.get(p.id) || [];
    return projectDepts.includes(softDept);
  });

  visible.forEach(p => console.log(`- VISIBLE: ${p.title} Depts: [${deptMap.get(p.id)?.join(", ")}]`));
  const hiddenCount = allProjs.length - visible.length;
  console.log(`HIDDEN: ${hiddenCount} projects`);

  process.exit(0);
}

check();
