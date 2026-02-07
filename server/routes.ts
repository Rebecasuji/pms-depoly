import type { Express } from "express";
import type { Server } from "http";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { eq, inArray } from "drizzle-orm";
import { and, sql } from "drizzle-orm";

import { db, pool } from "./db.ts";
import {
  users,
  sessions,
  employees,
  projects,
  projectFiles,
  projectDepartments,
  projectTeamMembers,
  projectVendors,
  keySteps,
  projectTasks,
  taskMembers,
  subtasks,
} from "../shared/schema.ts";


/* ===============================
   FILE UPLOAD CONFIG
================================ */
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (_req, file, cb) => {
    cb(null, `${uuidv4()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

/* ===============================
   REGISTER ROUTES
================================ */
export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {

  // Helper: find session by token and attach user info
  async function getUserFromToken(token?: string | null) {
    if (!token) return null;
    const rows = await db
      .select()
      .from(sessions)
      .where(eq(sessions.token, token));
    if (!rows || rows.length === 0) return null;
    const sess = rows[0] as any;
    // Lookup employee (if linked) and user using raw SQL to avoid schema mismatch
    let user = null;
    let employee = null;
    
    if (sess.userId) {
      const userRows = await pool.query("SELECT * FROM users WHERE id = $1 LIMIT 1", [sess.userId]);
      if (userRows.rows.length > 0) user = userRows.rows[0];
    }
    
    if (sess.employeeId) {
      const empRows = await pool.query("SELECT * FROM employees WHERE id = $1 LIMIT 1", [sess.employeeId]);
      if (empRows.rows.length > 0) employee = empRows.rows[0];
    }
    
    return { session: sess, user, employee };
  }

  // Middleware to require authentication. Expects Authorization: Bearer <token>
  async function requireAuth(req: any, res: any, next: any) {
    try {
      const auth = req.headers.authorization || "";
      const parts = auth.split(" ");
      const token = parts.length === 2 && parts[0] === "Bearer" ? parts[1] : null;
      const info = await getUserFromToken(token);
      if (!info) return res.status(401).json({ error: "Unauthorized" });
      req.user = info.user || null;
      req.employee = info.employee || null;
      req.session = info.session || null;
      console.log("[AUTH] User info attached to request:", {
        userId: req.user?.id,
        username: req.user?.username,
        role: req.user?.role,
        employeeId: req.employee?.id,
      });
      next();
    } catch (err) {
      console.error("Auth middleware error:", err);
      res.status(500).json({ error: "Auth failed" });
    }
  }
  /* ===============================
      EMPLOYEES
  ================================ */
  app.get("/api/employees", async (_req, res) => {
    try {
      const rows = await db
        .select({
          id: employees.id,
          name: employees.name,
          designation: employees.designation,
        })
        .from(employees)
        .orderBy(employees.name);

      res.json(rows);
    } catch (err) {
      console.error("Employees fetch error:", err);
      res.status(500).json([]);
    }
  });

  // LOGIN - accepts employee code + password
  app.post("/api/login", async (req, res) => {
    try {
      const { employeeCode, password } = req.body;
      console.log("[LOGIN] Attempting login with employeeCode:", employeeCode);
      if (!employeeCode || !password) return res.status(400).json({ error: "employeeCode and password required" });

      // Lookup employee using raw query to avoid schema mismatch
      const empRes = await pool.query('SELECT * FROM employees WHERE emp_code = $1 LIMIT 1', [employeeCode]);
      const employee = empRes.rows[0];
      console.log("[LOGIN] Employee lookup result:", employee ? `Found ${employee.name}` : "Not found");
      if (!employee) return res.status(401).json({ error: "Invalid credentials" });

      // Find the user row linked to this employee using raw query
      const userRes = await pool.query('SELECT * FROM users WHERE employee_id = $1 LIMIT 1', [employee.id]);
      const user = userRes.rows[0];
      console.log("[LOGIN] User lookup result:", user ? `Found user ${user.username}` : "Not found");
      if (!user) return res.status(401).json({ error: "Invalid credentials" });

      // Plaintext password comparison for now (seed uses plaintext 'admin123')
      const passwordMatch = String(user.password) === String(password);
      console.log("[LOGIN] Password match:", passwordMatch, "stored:", user.password, "provided:", password);
      if (!passwordMatch) return res.status(401).json({ error: "Invalid credentials" });

      const token = uuidv4();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      await db.insert(sessions).values({
        token,
        userId: user.id,
        employeeId: employee.id,
        empCode: employee.empCode,
        role: user.role || "EMPLOYEE",
        expiresAt: expiresAt as any,
      } as any);

      console.log("Login success for employee:", employee.empCode, "userId:", user.id);

      res.json({ token, user: { id: user.id, username: user.username, role: user.role, employeeId: employee.id, empCode: employee.empCode, name: employee.name } });
    } catch (err) {
      console.error("Login error:", err);
      res.status(500).json({ error: "Login failed" });
    }
  });

  // LOGOUT - deletes current session
  app.post("/api/logout", requireAuth, async (req: any, res) => {
    try {
      const token = req.session?.token;
      if (token) await db.delete(sessions).where(eq(sessions.token, token));
      res.json({ success: true });
    } catch (err) {
      console.error("Logout error:", err);
      res.status(500).json({ error: "Logout failed" });
    }
  });

  // GET current user/profile
  app.get("/api/me", requireAuth, async (req: any, res) => {
    try {
      const user = req.user || null;
      const employee = req.employee || null;
      res.json({ user, employee });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  /* ===============================
      PROJECTS
  ================================ */

  // GET ALL PROJECTS (requires auth)
  app.get("/api/projects", requireAuth, async (req: any, res) => {
    try {
      const requestingEmployeeId = req.employee?.id || null;
      const isAdmin = req.user?.role === "ADMIN";

      let projectRows: any[] = [];

      if (isAdmin) {
        projectRows = await db
          .select({
            id: projects.id,
            title: projects.title,
            projectCode: projects.projectCode,
            description: projects.description,
            clientName: projects.clientName,
            status: projects.status,
            progress: projects.progress,
            startDate: projects.startDate,
            endDate: projects.endDate,
            createdAt: projects.createdAt,
            updatedAt: projects.updatedAt,
          })
          .from(projects)
          .orderBy(projects.createdAt);
      } else {
        if (!requestingEmployeeId) return res.status(403).json({ error: "Forbidden" });

        const membership = await db
          .select({ projectId: projectTeamMembers.projectId })
          .from(projectTeamMembers)
          .where(eq(projectTeamMembers.employeeId, requestingEmployeeId));

        const allowedProjectIds = membership.map((m) => m.projectId);
        if (allowedProjectIds.length === 0) return res.json([]);

        projectRows = await db
          .select({
            id: projects.id,
            title: projects.title,
            projectCode: projects.projectCode,
            description: projects.description,
            clientName: projects.clientName,
            status: projects.status,
            progress: projects.progress,
            startDate: projects.startDate,
            endDate: projects.endDate,
            createdAt: projects.createdAt,
            updatedAt: projects.updatedAt,
          })
          .from(projects)
          .where(inArray(projects.id, allowedProjectIds))
          .orderBy(projects.createdAt);
      }

      if (!projectRows.length) return res.json([]);

      const projectIds = projectRows.map((p) => p.id);

      // Get departments for each project
      const departments = await db
        .select()
        .from(projectDepartments)
        .where(inArray(projectDepartments.projectId, projectIds));

      // Get team members for each project
      const teamMembers = await db
        .select()
        .from(projectTeamMembers)
        .where(inArray(projectTeamMembers.projectId, projectIds));

      // Get vendors for each project
      const vendors = await db
        .select()
        .from(projectVendors)
        .where(inArray(projectVendors.projectId, projectIds));

      const result = projectRows.map((p) => {
        const depts = departments
          .filter((d) => d.projectId === p.id)
          .map((d) => d.department);

        const team = teamMembers
          .filter((m) => m.projectId === p.id)
          .map((m) => m.employeeId);

        const vendorList = vendors
          .filter((v) => v.projectId === p.id)
          .map((v) => v.vendorName);

        return {
          ...p,
          department: depts,
          team,
          vendors: vendorList,
        };
      });

      res.json(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Projects fetch error:", errorMessage);
      console.error("Full error:", err);
      res.status(500).json({ error: "Failed to fetch projects", details: errorMessage });
    }
  });

  // CREATE PROJECT (requires auth; team assignments require ADMIN)
  app.post("/api/projects", requireAuth, async (req: any, res) => {
    try {
      const {
        title,
        projectCode,
        department = [],
        description,
        clientName,
        status = "open",
        startDate,
        endDate,
        progress = 0,
        team = [],
        vendors: vendorList = [],
      } = req.body;

      console.log("[POST /api/projects] Request user role:", req.user?.role, "Team array:", team);

      // Validate required fields
      if (!title) {
        return res.status(400).json({ error: "Title is required" });
      }
      if (!projectCode) {
        return res.status(400).json({ error: "Project code is required" });
      }
      if (!startDate || !endDate) {
        return res.status(400).json({ error: "Start date and end date are required" });
      }

      // Convert dates to string format (YYYY-MM-DD) for DATE column
      const formatDate = (date: any) => {
        const d = new Date(date);
        return d.toISOString().split('T')[0];
      };

      // Create the project
      const [created] = await db
        .insert(projects)
        .values({
          title,
          projectCode,
          clientName: clientName || null,
          description: description || null,
          status,
          progress: Number(progress) || 0,
          startDate: formatDate(startDate) as any,
          endDate: formatDate(endDate) as any,
        })
        .returning();

      // Add departments
      if (Array.isArray(department) && department.length > 0) {
        await db.insert(projectDepartments).values(
          department.map((dept: string) => ({
            projectId: created.id,
            department: dept,
          }))
        );
      }

      // Add team members (any authenticated user—both ADMIN and EMPLOYEE—can assign team members)
      if (Array.isArray(team) && team.length > 0) {
        console.log("[POST /api/projects] Assigning team members. User role:", req.user?.role);
        await db.insert(projectTeamMembers).values(
          team.map((empId: string) => ({
            projectId: created.id,
            employeeId: empId,
          }))
        );
      }

      // Add vendors
      if (Array.isArray(vendorList) && vendorList.length > 0) {
        await db.insert(projectVendors).values(
          vendorList.map((vendor: string) => ({
            projectId: created.id,
            vendorName: vendor,
          }))
        );
      }

      // Return project with related data
      const result = {
        ...created,
        department: department || [],
        team: team || [],
        vendors: vendorList || [],
      };

      res.json(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Projects insert error:", errorMessage);
      console.error("Full error:", err);
      res.status(500).json({ error: "Failed to create project", details: errorMessage });
    }
  });

  // UPDATE PROJECT (requires auth; any authenticated user can update)
  app.put("/api/projects/:id", requireAuth, async (req: any, res) => {
    const { id } = req.params;
    try {
      const {
        title,
        projectCode,
        department = [],
        description,
        clientName,
        status,
        startDate,
        endDate,
        progress,
        team = [],
        vendors: vendorList = [],
      } = req.body;

      // Convert dates to string format (YYYY-MM-DD) for DATE column
      const formatDate = (date: any) => {
        if (!date) return undefined;
        const d = new Date(date);
        return d.toISOString().split('T')[0];
      };

      const updateData: any = {
        title,
        projectCode,
        clientName: clientName || null,
        description: description || null,
        status: status || "open",
        progress: Number(progress) || 0,
        updatedAt: new Date(),
      };

      if (startDate) updateData.startDate = formatDate(startDate);
      if (endDate) updateData.endDate = formatDate(endDate);

      const [updated] = await db
        .update(projects)
        .set(updateData)
        .where(eq(projects.id, id))
        .returning();

      if (!updated) return res.status(404).json({ error: "Project not found" });

      // Update departments
      await db.delete(projectDepartments).where(eq(projectDepartments.projectId, id));
      if (Array.isArray(department) && department.length > 0) {
        await db.insert(projectDepartments).values(
          department.map((dept: string) => ({
            projectId: id,
            department: dept,
          }))
        );
      }

      // Update team members
      await db.delete(projectTeamMembers).where(eq(projectTeamMembers.projectId, id));
      if (Array.isArray(team) && team.length > 0) {
        await db.insert(projectTeamMembers).values(
          team.map((empId: string) => ({
            projectId: id,
            employeeId: empId,
          }))
        );
      }

      // Update vendors
      await db.delete(projectVendors).where(eq(projectVendors.projectId, id));
      if (Array.isArray(vendorList) && vendorList.length > 0) {
        await db.insert(projectVendors).values(
          vendorList.map((vendor: string) => ({
            projectId: id,
            vendorName: vendor,
          }))
        );
      }

      const result = {
        ...updated,
        department,
        team,
        vendors: vendorList,
      };

      res.json(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Project update error:", errorMessage);
      res.status(500).json({ error: "Failed to update project", details: errorMessage });
    }
  });

  // DELETE PROJECT (requires auth; any authenticated user can delete)
  app.delete("/api/projects/:id", requireAuth, async (req: any, res) => {
    const { id } = req.params;
    try {
      // Delete related data
      await db.delete(projectDepartments).where(eq(projectDepartments.projectId, id));
      await db.delete(projectTeamMembers).where(eq(projectTeamMembers.projectId, id));
      await db.delete(projectVendors).where(eq(projectVendors.projectId, id));
      await db.delete(projectFiles).where(eq(projectFiles.projectId, id));

      // Delete the project
      await db.delete(projects).where(eq(projects.id, id));

      res.json({ success: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Project delete error:", errorMessage);
      res.status(500).json({ error: "Failed to delete project", details: errorMessage });
    }
  });

  /* ===============================
      KEY STEPS
  ================================ */
  app.post("/api/key-steps", async (req, res) => {
    try {
      const {
        projectId,
        parentKeyStepId,
        header,
        title,
        description,
        requirements,
        phase,
        status,
        startDate,
        endDate,
      } = req.body;

      console.log("🔵 Backend received payload:", {
        projectId,
        parentKeyStepId,
        header,
        title,
        description,
        requirements,
        phase,
        status,
        startDate,
        endDate,
      });

      // Validate required fields
      if (!projectId || !title || !startDate || !endDate) {
        return res.status(400).json({
          message: "Missing required fields",
          required: { projectId, title, startDate, endDate },
        });
      }

      // Format dates - ensure they're in YYYY-MM-DD format
      const formatDate = (date: any) => {
        if (!date) return undefined;
        if (typeof date === 'string') {
          // If already a date string, validate format
          if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            return date;
          }
        }
        const d = new Date(date);
        if (isNaN(d.getTime())) {
          throw new Error(`Invalid date: ${date}`);
        }
        return d.toISOString().split('T')[0];
      };

      const formattedStartDate = formatDate(startDate);
      const formattedEndDate = formatDate(endDate);

      console.log("🟢 Formatted dates:", {
        startDate: formattedStartDate,
        endDate: formattedEndDate,
      });
      let finalPhase = Number(phase) || 1;

      // Auto-increment phase for sub-milestones
      if (parentKeyStepId) {
        const existing = await db
          .select({ maxPhase: sql<number>`MAX(${keySteps.phase})` })
          .from(keySteps)
          .where(
            and(
              eq(keySteps.projectId, projectId),
              eq(keySteps.parentKeyStepId, parentKeyStepId)
            )
          );

        finalPhase = (existing[0]?.maxPhase ?? 0) + 1;
      }

      // Build values object explicitly
      const valueObj: any = {
        projectId,
        parentKeyStepId: parentKeyStepId || null,

        header: header ?? "",
        title: title.trim(),
        description: description ?? "",
        requirements: requirements ?? "",

        phase: finalPhase, // ✅ FIXED
        status: status ? String(status).toLowerCase() : "pending",
        startDate: formattedStartDate,
        endDate: formattedEndDate,
      };

      console.log("🟢 Values to insert:", valueObj);

      const insertedArr = await db
        .insert(keySteps)
        .values(valueObj)
        .returning();
      res.status(201).json(insertedArr[0]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("❌ Key step create error:", errorMessage);
      console.error("❌ Full error:", err);
      res.status(500).json({ message: "Failed to insert key step", details: errorMessage });
    }
  });

  app.get("/api/projects/:projectId/key-steps", async (req, res) => {
    try {
      const { projectId } = req.params;
      const steps = await db
        .select({
          id: keySteps.id,
          projectId: keySteps.projectId,
          parentKeyStepId: keySteps.parentKeyStepId,
          header: keySteps.header,
          title: keySteps.title,
          description: keySteps.description,
          requirements: keySteps.requirements,
          phase: keySteps.phase,
          status: keySteps.status,
          startDate: keySteps.startDate,
          endDate: keySteps.endDate,
          createdAt: keySteps.createdAt,
        })
        .from(keySteps)
        .where(eq(keySteps.projectId, projectId));

      res.json(steps);
    } catch (err) {
      console.error("Get key steps error:", err);
      res.status(500).json({ error: "Failed to fetch key steps", details: String(err) });
    }
  });

  // Get single key step by ID
  app.get("/api/key-steps/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const [step] = await db
        .select()
        .from(keySteps)
        .where(eq(keySteps.id, id));

      if (!step) {
        return res.status(404).json({ error: "Key step not found" });
      }
      res.json(step);
    } catch (err) {
      console.error("Get key step error:", err);
      res.status(500).json({ error: "Failed to fetch key step", details: String(err) });
    }
  });

  // Get nested key steps for a parent key step
  app.get("/api/key-steps/:keyStepId/children", async (req, res) => {
    try {
      const { keyStepId } = req.params;

      // Set a timeout for the query
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Query timeout")), 5000)
      );

      const queryPromise = db
        .select()
        .from(keySteps)
        .where(eq(keySteps.parentKeyStepId, keyStepId));

      const children = await Promise.race([queryPromise, timeoutPromise]);
      res.json(children);
    } catch (err) {
      console.error("Get key steps children error:", err);
      res.status(500).json({ error: "Failed to fetch children", details: String(err) });
    }
  });

  // Update key step
  app.put("/api/key-steps/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const {
        title,
        description,
        requirements,
        phase,
        status,
        startDate,
        endDate,
        header,
      } = req.body;

      const formatDate = (date: any) => {
        if (!date) return undefined;
        const d = new Date(date);
        return d.toISOString().split('T')[0];
      };

      const [updated] = await db
        .update(keySteps)
        .set({
          title: title?.trim(),
          description: description ?? "",
          requirements: requirements ?? "",
          header: header ?? "",
          phase: Number(phase) || 1,
          status: status ? String(status).toLowerCase() : "pending",
          startDate: startDate ? formatDate(startDate) : undefined,
          endDate: endDate ? formatDate(endDate) : undefined,
        })
        .where(eq(keySteps.id, id))
        .returning();

      if (!updated) return res.status(404).json({ message: "Key step not found" });
      res.json(updated);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Key step update error:", errorMessage);
      res.status(500).json({ message: "Update failed", details: errorMessage });
    }
  });

  // Delete key step
  app.delete("/api/key-steps/:id", async (req, res) => {
    try {
      const { id } = req.params;

      // Delete all child key steps
      await db.delete(keySteps).where(eq(keySteps.parentKeyStepId, id));

      // Delete the key step itself
      await db.delete(keySteps).where(eq(keySteps.id, id));

      res.json({ success: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Key step delete error:", errorMessage);
      res.status(500).json({ message: "Delete failed", details: errorMessage });
    }
  });

  /* ===============================
      TASKS
================================ */

  // CREATE TASK
  app.post("/api/tasks", async (req, res) => {
    try {
      const {
        projectId,
        keyStepId,
        taskName,
        description,
        status,
        priority,
        startDate,
        endDate,
        assignerId,
        taskMembers: memberList = [],
        subtasks: incomingSubtasks = [],
      } = req.body;

      if (!projectId || !taskName || !assignerId) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Format dates if provided
      const formatDate = (date: any) => {
        if (!date) return undefined;
        const d = new Date(date);
        return d.toISOString().split('T')[0];
      };

      // Insert task
      const [task] = await db
        .insert(projectTasks)
        .values({
          projectId,
          keyStepId: keyStepId || null,
          taskName,
          description: description || null,
          status: status || "pending",
          priority: priority || "medium",
          startDate: startDate ? formatDate(startDate) : null,
          endDate: endDate ? formatDate(endDate) : null,
          assignerId,
        } as any)
        .returning();

      // Insert members
      if (Array.isArray(memberList) && memberList.length > 0) {
        await db.insert(taskMembers).values(
          memberList.map((empId: string) => ({
            taskId: task.id,
            employeeId: empId,
          })),
        );
      }

      // Insert subtasks (if provided). The DB stores a single `assigned_to` per subtask;
      // if the incoming UI provides multiple assignees, store the first one.
      if (Array.isArray(incomingSubtasks) && incomingSubtasks.length > 0) {
        const rows = incomingSubtasks.map((st: any) => ({
          taskId: task.id,
          title: st.title || null,
          isCompleted: !!st.isCompleted,
          assignedTo: Array.isArray(st.assignedTo) && st.assignedTo.length > 0 ? st.assignedTo[0] : (typeof st.assignedTo === 'string' ? st.assignedTo : null),
        }));
        console.log("Inserting subtasks:", rows);
        await db.insert(subtasks).values(rows);
      }

      res.json(task);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Task create error:", errorMessage);
      console.error("Full error:", err);
      res.status(500).json({ message: "Task creation failed", details: errorMessage });
    }
  });

  // UPDATE TASK
  app.put("/api/tasks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const {
        taskName,
        description,
        status,
        priority,
        startDate,
        endDate,
        assignerId,
        keyStepId,
        taskMembers: memberList = [],
        subtasks: incomingSubtasks = [],
      } = req.body;

      // Temporary debug logs to inspect incoming payload and behavior
      console.log("[PUT /api/tasks/:id] incoming body:", JSON.stringify(req.body));

      // Format dates if provided
      const formatDate = (date: any) => {
        if (!date) return undefined;
        const d = new Date(date);
        return d.toISOString().split('T')[0];
      };

      const updateData: any = {
        taskName,
        description: description || null,
        status: status || "pending",
        priority: priority || "medium",
        assignerId,
        updatedAt: new Date(),
      };

      // Persist milestone (key step) changes when provided
      if (typeof keyStepId !== "undefined") {
        updateData.keyStepId = keyStepId || null;
      }

      console.log("[PUT /api/tasks/:id] computed updateData:", JSON.stringify(updateData));

      if (startDate) updateData.startDate = formatDate(startDate);
      if (endDate) updateData.endDate = formatDate(endDate);

      const [updated] = await db
        .update(projectTasks)
        .set(updateData)
        .where(eq(projectTasks.id, id))
        .returning();

      console.log("[PUT /api/tasks/:id] db returned:", JSON.stringify(updated));

      if (!updated) return res.status(404).json({ message: "Task not found" });

      // Update task members
      await db.delete(taskMembers).where(eq(taskMembers.taskId, id));
      if (Array.isArray(memberList) && memberList.length > 0) {
        await db.insert(taskMembers).values(
          memberList.map((empId: string) => ({
            taskId: id,
            employeeId: empId,
          })),
        );
      }

      // Update subtasks: remove existing and insert incoming ones
      await db.delete(subtasks).where(eq(subtasks.taskId, id));
      if (Array.isArray(incomingSubtasks) && incomingSubtasks.length > 0) {
        const rows = incomingSubtasks.map((st: any) => ({
          taskId: id,
          title: st.title || null,
          isCompleted: !!st.isCompleted,
          assignedTo: Array.isArray(st.assignedTo) && st.assignedTo.length > 0 ? st.assignedTo[0] : (typeof st.assignedTo === 'string' ? st.assignedTo : null),
        }));
        console.log("Updating subtasks:", rows);
        await db.insert(subtasks).values(rows);
      }

      res.json(updated);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Task update error:", errorMessage);
      console.error("Full error:", err);
      res.status(500).json({ message: "Task update failed", details: errorMessage });
    }
  });

  // DELETE TASK
  app.delete("/api/tasks/:id", async (req, res) => {
    try {
      const { id } = req.params;

      // Delete subtasks
      await db.delete(subtasks).where(eq(subtasks.taskId, id));

      // Delete task members
      await db.delete(taskMembers).where(eq(taskMembers.taskId, id));

      // Delete the task
      await db.delete(projectTasks).where(eq(projectTasks.id, id));

      res.json({ success: true });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Task delete error:", errorMessage);
      res.status(500).json({ message: "Task delete failed", details: errorMessage });
    }
  });

  // GET TASKS BY PROJECT
  app.get("/api/tasks/:projectId", async (req, res) => {
    try {
      const { projectId } = req.params;

      const tasks = await db
        .select()
        .from(projectTasks)
        .where(eq(projectTasks.projectId, projectId));

      if (!tasks.length) return res.json([]);

      const taskIds = tasks.map((t) => t.id);

      const members = await db
        .select({
          taskId: taskMembers.taskId,
          employeeId: taskMembers.employeeId,
        })
        .from(taskMembers)
        .where(inArray(taskMembers.taskId, taskIds));

      // Fetch subtasks for these tasks
      const subs = await db
        .select({
          id: subtasks.id,
          taskId: subtasks.taskId,
          title: subtasks.title,
          isCompleted: subtasks.isCompleted,
          assignedTo: subtasks.assignedTo,
        })
        .from(subtasks)
        .where(inArray(subtasks.taskId, taskIds));

      const result = tasks.map((t) => ({
        ...t,
        taskMembers: members
          .filter((m) => m.taskId === t.id)
          .map((m) => m.employeeId),
        subtasks: subs
          .filter((s) => s.taskId === t.id)
          .map((s) => ({ id: s.id, title: s.title, isCompleted: s.isCompleted, assignedTo: s.assignedTo ? [s.assignedTo] : [] })),
      }));

      res.json(result);
    } catch (err) {
      console.error("Task fetch error:", err);
      res.status(500).json([]);
    }
  });

  // GET SINGLE TASK BY ID
  app.get("/api/task/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const [task] = await db.select().from(projectTasks).where(eq(projectTasks.id, id)).limit(1);
      if (!task) return res.status(404).json({ message: "Task not found" });

      const members = await db
        .select({ taskId: taskMembers.taskId, employeeId: taskMembers.employeeId })
        .from(taskMembers)
        .where(eq(taskMembers.taskId, id));

      const subs = await db
        .select({ id: subtasks.id, title: subtasks.title, isCompleted: subtasks.isCompleted, assignedTo: subtasks.assignedTo })
        .from(subtasks)
        .where(eq(subtasks.taskId, id));

      const result = {
        ...task,
        taskMembers: members.map(m => m.employeeId),
        subtasks: subs.map(s => ({ id: s.id, title: s.title, isCompleted: s.isCompleted, assignedTo: s.assignedTo ? [s.assignedTo] : [] })),
      };

      res.json(result);
    } catch (err) {
      console.error("Get single task error:", err);
      res.status(500).json({ message: "Failed to fetch task" });
    }
  });

  /* ===============================
      FILES & VENDORS
  ================================ */
  app.post(
    "/api/projects/:id/upload",
    requireAuth,
    upload.single("file"),
    async (req: any, res) => {
      if (!req.file) return res.status(400).json({ error: "No file" });

      try {
        // ensure user can upload to this project
        const projectId = req.params.id;
        const isAdmin = req.user?.role === "ADMIN";
        if (!isAdmin) {
          const membership = await db
            .select()
            .from(projectTeamMembers)
            .where(and(eq(projectTeamMembers.projectId, projectId), eq(projectTeamMembers.employeeId, req.employee?.id)));
          if (!membership || membership.length === 0) return res.status(403).json({ error: "Unauthorized" });
        }
        const filePath = `/uploads/${req.file.filename}`;
        const [inserted] = await db
          .insert(projectFiles)
          .values({
            projectId: req.params.id,
            fileName: req.file.originalname,
            filePath: filePath, // Ensure column exists in DB
            fileUrl: filePath,
            fileSize: req.file.size,
            uploadedBy: req.user?.id || null,
          } as any)
          .returning();

        res.json(inserted);
      } catch (err) {
        console.error("Upload error:", err);
        res.status(500).json({
          error:
            "Upload failed. Please check if 'file_path' and 'uploaded_by' columns exist in your database.",
        });
      }
    },
  );

  app.get("/api/projects/:id/files", requireAuth, async (req: any, res) => {
    try {
      const projectId = req.params.id;
      const isAdmin = req.user?.role === "ADMIN";
      if (!isAdmin) {
        const membership = await db
          .select()
          .from(projectTeamMembers)
          .where(and(eq(projectTeamMembers.projectId, projectId), eq(projectTeamMembers.employeeId, req.employee?.id)));
        if (!membership || membership.length === 0) return res.status(403).json({ error: "Unauthorized" });
      }

      const files = await db
        .select()
        .from(projectFiles)
        .where(eq(projectFiles.projectId, projectId));
      res.json(files);
    } catch (err) {
      res.status(500).json([]);
    }
  });

  // Download file
  app.get("/api/projects/:projectId/files/:fileId/download", requireAuth, async (req: any, res) => {
    try {
      const { projectId, fileId } = req.params;
      const file = await db
        .select()
        .from(projectFiles)
        .where(eq(projectFiles.id, fileId))
        .limit(1);

      if (!file || file.length === 0) {
        return res.status(404).json({ error: "File not found" });
      }

      const fileRecord = file[0];
      if (fileRecord.projectId !== projectId) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      // Ensure user has access to the project
      const isAdmin = req.user?.role === "ADMIN";
      if (!isAdmin) {
        const membership = await db
          .select()
          .from(projectTeamMembers)
          .where(and(eq(projectTeamMembers.projectId, projectId), eq(projectTeamMembers.employeeId, req.employee?.id)));
        if (!membership || membership.length === 0) return res.status(403).json({ error: "Unauthorized" });
      }

      const filePath = fileRecord.filePath || fileRecord.storageUrl;
      if (!filePath) {
        return res.status(404).json({ error: "File path not found" });
      }

      // Construct full file path
      const fullPath = filePath.startsWith("/") 
        ? `${process.cwd()}${filePath}` 
        : `${process.cwd()}/${filePath}`;

      res.download(fullPath, fileRecord.fileName);
    } catch (err) {
      console.error("File download error:", err);
      res.status(500).json({ error: "Failed to download file" });
    }
  });

  {/* 
  app.get("/api/vendors", async (_req, res) => {
    try {
      const all = await db.select().from(vendors);
      res.json(all);
    } catch (err) {
      res.status(500).json([]);
    }
  });
*/}
  return httpServer;
}
