import type { Express } from "express";
import type { Server } from "http";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { eq, inArray } from "drizzle-orm";
import { and, sql } from "drizzle-orm";

import { db, pool } from "./db.ts";
import { DataValidator } from "../shared/dataValidator.ts";
import { storage as storageHelper } from "./storage.ts";
import { sendTaskAssignmentEmail, sendSubtaskAssignmentEmail, sendProjectCompletionEmail } from "./email.ts";
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
  subtaskMembers,
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

  // Helper: normalize department strings for robust matching
  function normalizeDept(input?: string | null) {
    if (!input) return "";
    // Trim, collapse multi-spaces, lowercase
    let v = String(input).trim().toLowerCase().replace(/\s+/g, " ");

    // EXCEPTION: Don't normalize 'presales' to 'presale'
    if (v === 'presales') return v;

    // Basic plural normalization: turn trailing 's' into singular (operations -> operation)
    if (v.length > 3 && v.endsWith("s")) v = v.slice(0, -1);
    return v;
  }

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
          empCode: employees.empCode,
          name: employees.name,
          designation: employees.designation,
          department: employees.department,
          email: employees.email,
          phone: employees.phone,
        })
        .from(employees)
        .orderBy(employees.name);

      res.json(rows);
    } catch (err) {
      console.error("Employees fetch error:", err);
      res.status(500).json([]);
    }
  });

  // GET UNIQUE DEPARTMENTS
  app.get("/api/departments", async (_req, res) => {
    try {
      const rows = await db
        .select({ department: employees.department })
        .from(employees)
        .where(sql`${employees.department} IS NOT NULL AND ${employees.department} != ''`)
        .groupBy(employees.department)
        .orderBy(employees.department);

      const departments = rows.map(r => r.department).filter(Boolean);
      res.json(departments);
    } catch (err) {
      console.error("Departments fetch error:", err);
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

  // FORGOT PASSWORD - reset password using employee code
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { employeeCode, newPassword, confirmPassword } = req.body;
      console.log("[FORGOT-PASSWORD] Reset request for employeeCode:", employeeCode);

      if (!employeeCode || !newPassword || !confirmPassword) {
        return res.status(400).json({ error: "All fields are required" });
      }

      if (newPassword !== confirmPassword) {
        return res.status(400).json({ error: "Passwords do not match" });
      }

      // Lookup employee
      const empRes = await pool.query('SELECT * FROM employees WHERE emp_code = $1 LIMIT 1', [employeeCode]);
      const employee = empRes.rows[0];
      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      // Find user
      const userRes = await pool.query('SELECT * FROM users WHERE employee_id = $1 LIMIT 1', [employee.id]);
      const user = userRes.rows[0];
      if (!user) {
        return res.status(404).json({ error: "User record not found for this employee" });
      }

      // Update password (using plaintext for consistency)
      await pool.query('UPDATE users SET password = $1 WHERE id = $2', [newPassword, user.id]);

      console.log("[FORGOT-PASSWORD] Password updated successfully for employee:", employeeCode);
      res.json({ success: true, message: "Password updated successfully" });
    } catch (err) {
      console.error("Forgot password error:", err);
      res.status(500).json({ error: "Failed to reset password" });
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
      console.log('[TRACE] /api/projects handler entered - req.user/employee:', { user: req.user ? { id: req.user.id, role: req.user.role, username: req.user.username } : null, employee: req.employee ? { id: req.employee.id, empCode: req.employee.empCode } : null });
      // TEMP TEST: ensure handler executes and error paths are visible
      // throw new Error('early-fail-test');
      const requestingEmployeeId = req.employee?.id || null;
      const requestingEmployeeDepartment = req.employee?.department || null;
      const isAdmin = req.user?.role === "ADMIN";

      let projectRows: any[] = [];
      let departments: any[] = [];
      let teamMembers: any[] = [];
      let vendors: any[] = [];

      // DEBUG: inspect `projects` export before querying
      console.log('[DEBUG] projects object keys:', Object.keys(projects || {}));
      console.log('[DEBUG] projects.createdAt present:', !!projects?.createdAt);

      // (Raw SQL fallback removed)


      // Load projects using Drizzle where possible; if Drizzle's generated SQL
      // references columns that don't exist in the DB, gracefully fall back to
      // a minimal raw select so the endpoint continues to work.
      let allProjects: any[] = [];
      try {
        allProjects = await db.select().from(projects);
      } catch (drizzleErr) {
        console.warn('[WARN] /api/projects - Drizzle select failed, falling back to minimal raw select', drizzleErr && (drizzleErr.message || drizzleErr));
        const fallback = await pool.query(
          `SELECT id, title, project_code AS "projectCode", description, client_name AS "clientName", status, progress, start_date AS "startDate", end_date AS "endDate", created_at AS "createdAt" FROM projects ORDER BY created_at DESC`
        );
        allProjects = (fallback.rows || []).map((r: any) => ({
          id: r.id,
          title: r.title,
          projectCode: r.projectCode,
          description: r.description,
          clientName: r.clientName,
          status: r.status,
          progress: r.progress,
          startDate: r.startDate,
          endDate: r.endDate,
          createdAt: r.createdAt,
        }));
      }

      const allProjectIds = allProjects.map((p) => p.id);
      console.log('[DEBUG] /api/projects - allProjectIds sample =', allProjectIds.slice(0, 10));

      // Fetch all related data in parallel - ONCE
      const [deptResults, teamResults, vendorResults, membershipResults] = await Promise.all([
        db.select().from(projectDepartments).where(inArray(projectDepartments.projectId, allProjectIds)),
        db.select().from(projectTeamMembers).where(inArray(projectTeamMembers.projectId, allProjectIds)),
        db.select().from(projectVendors).where(inArray(projectVendors.projectId, allProjectIds)),
        !isAdmin ? db.select({ projectId: projectTeamMembers.projectId }).from(projectTeamMembers).where(eq(projectTeamMembers.employeeId, requestingEmployeeId)) : Promise.resolve([]),
      ]);

      console.log('[DEBUG] /api/projects - dept/team/vendor/membership lengths =',
        Array.isArray(deptResults) ? deptResults.length : typeof deptResults,
        Array.isArray(teamResults) ? teamResults.length : typeof teamResults,
        Array.isArray(vendorResults) ? vendorResults.length : typeof vendorResults,
        Array.isArray(membershipResults) ? membershipResults.length : typeof membershipResults
      );

      departments = deptResults;
      teamMembers = teamResults;
      vendors = vendorResults;

      // Build maps for O(1) lookups
      const departmentMap = new Map();
      const teamMap = new Map();
      const vendorMap = new Map();

      // Normalize and index related rows for robust comparisons
      departments.forEach((d) => {
        const pid = String(d.projectId);
        const dept = normalizeDept((d.department || "").toString());
        if (!departmentMap.has(pid)) departmentMap.set(pid, [] as string[]);
        if (dept && !departmentMap.get(pid).includes(dept)) departmentMap.get(pid).push(dept);
      });

      teamMembers.forEach((m) => {
        const pid = String(m.projectId);
        const empId = String(m.employeeId);
        if (!teamMap.has(pid)) teamMap.set(pid, [] as string[]);
        teamMap.get(pid).push(empId);
      });

      vendors.forEach((v) => {
        const pid = String(v.projectId);
        if (!vendorMap.has(pid)) vendorMap.set(pid, [] as string[]);
        vendorMap.get(pid).push(v.vendorName);
      });

      // Filter projects based on access level
      const isE0001 = req.employee?.empCode === "E0001";

      if (isAdmin || isE0001) {
        projectRows = allProjects;
      } else {
        if (!requestingEmployeeId) return res.status(403).json({ error: "Forbidden" });

        // Normalize requester's department for robust matching
        const reqDeptNorm = normalizeDept(requestingEmployeeDepartment);
        const teamProjectIds = new Set((membershipResults as any[]).map((m) => String(m.projectId)));

        projectRows = allProjects.filter((p) => {
          const pid = String(p.id);
          const isTeamMember = teamProjectIds.has(pid);
          const projectDepartments = departmentMap.get(pid) || [];
          const isDepartmentMatch = reqDeptNorm && projectDepartments.includes(reqDeptNorm);
          return Boolean(isTeamMember || isDepartmentMatch);
        });
      }

      // Sanity-check projectRows to avoid spreading null/undefined
      const falsyEntries = projectRows.filter((pr) => !pr);
      if (falsyEntries.length > 0) {
        console.warn('[WARN] /api/projects - removing falsy entries from projectRows', falsyEntries.length);
      }
      projectRows = projectRows.filter(Boolean);

      // Build response with cached data (defensive)
      try {
        const result = projectRows.map((p) => {
          try {
            const id = p && typeof p === 'object' ? p.id : undefined;
            return {
              ...(p || {}),
              department: (typeof departmentMap !== 'undefined' && departmentMap.get ? departmentMap.get(id) : []) || [],
              team: (typeof teamMap !== 'undefined' && teamMap.get ? teamMap.get(id) : []) || [],
              vendors: (typeof vendorMap !== 'undefined' && vendorMap.get ? vendorMap.get(id) : []) || [],
            };
          } catch (inner) {
            console.warn('[WARN] /api/projects - failed to map single project, returning minimal', inner);
            return { id: p && p.id ? p.id : null, title: p && p.title ? p.title : 'Unknown', department: [], team: [], vendors: [] };
          }
        });
        return res.json(result);
      } catch (mapErr) {
        console.error('[ERROR] /api/projects - mapping failed', mapErr && (mapErr.stack || mapErr));
        // fallback: send minimal projects so UI shows something
        const fallback = (projectRows || []).map((p: any) => ({ id: p?.id ?? null, title: p?.title ?? 'Unknown', department: [], team: [], vendors: [] }));
        return res.json(fallback);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Projects fetch error:", errorMessage, err && (err.stack || err));
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
        company,
        location,
        status = "Planned",
        startDate,
        endDate,
        progress = 0,
        team = [],
        vendors: vendorList = [],
      } = req.body;

      // Validate required fields using validator
      const validationErrors = DataValidator.validateProject({
        title,
        startDate,
        endDate,
        progress,
        department,
        team,
        vendors: vendorList,
      });

      if (validationErrors.length > 0) {
        console.warn("❌ Project validation failed:", validationErrors);
        return res.status(400).json({
          error: "Validation failed",
          details: validationErrors
        });
      }

      const formatDate = (date: any) => {
        const formatted = DataValidator.formatDate(date);
        if (!formatted) {
          throw new Error(`Invalid date format: ${date}`);
        }
        return formatted;
      };

      // Generate projectCode only if provided
      let finalProjectCode = projectCode?.trim() || `P-${Date.now()}`;

      // Format required dates
      const finalStartDate = formatDate(startDate);
      const finalEndDate = formatDate(endDate);

      console.log("✅ Project validation passed, creating project:", { title, finalProjectCode });

      // Create the project - minimal payload for speed
      const [created] = await db
        .insert(projects)
        .values({
          title: title.trim(),
          projectCode: finalProjectCode,
          clientName: clientName?.trim() || null,
          location: location?.trim() || null,
          description: description?.trim() || null,
          status: status || "Planned",
          progress: Math.min(100, Math.max(0, Number(progress) || 0)),
          startDate: finalStartDate as any,
          endDate: finalEndDate as any,
          createdByEmployeeId: req.employee?.id || null,
        })
        .returning();

      // Batch insert all related records efficiently
      const projectId = created.id;
      const insertPromises: Promise<any>[] = [];

      // Only add if not empty
      if (Array.isArray(department) && department.length > 0) {
        insertPromises.push(
          db.insert(projectDepartments).values(
            department
              .filter(d => d?.trim())
              .map((dept: string) => ({
                projectId,
                department: normalizeDept(dept),
              }))
          )
        );
      }

      if (Array.isArray(team) && team.length > 0) {
        insertPromises.push(
          db.insert(projectTeamMembers).values(
            team.filter(t => t?.trim()).map((empId: string) => ({
              projectId,
              employeeId: empId.trim(),
            }))
          )
        );
      }

      if (Array.isArray(vendorList) && vendorList.length > 0) {
        insertPromises.push(
          db.insert(projectVendors).values(
            vendorList.filter(v => v?.trim()).map((vendor: string) => ({
              projectId,
              vendorName: vendor.trim(),
            }))
          )
        );
      }

      // Execute all batch inserts in parallel
      if (insertPromises.length > 0) {
        await Promise.all(insertPromises);
      }

      // Return minimal project data
      const result = {
        ...created,
        department: department || [],
        team: team || [],
        vendors: vendorList || [],
        createdByEmployeeId: created.createdByEmployeeId || null,
      };

      console.log("✅ Project created successfully:", created.id);
      res.json(result);
    } catch (err: any) {
      let errorMessage = err instanceof Error ? err.message : String(err);
      let statusCode = 500;

      // Check for duplicate projectCode error (PostgreSQL error code 23505 = unique violation)
      if (err.code === '23505' || err.constraint === 'projects_project_code_key') {
        errorMessage = `Project code already exists. Please use a different project code or leave it empty to auto-generate.`;
        statusCode = 409; // Conflict
      } else if (errorMessage.includes("validation")) {
        statusCode = 400;
      } else if (errorMessage.includes("unique")) {
        statusCode = 409;
        errorMessage = "A project with this code already exists";
      }

      console.error("❌ Project creation failed:", errorMessage);
      if (statusCode !== 409) {
        console.error("Full error:", err);
      }
      res.status(statusCode).json({ error: "Failed to create project", details: errorMessage });
    }
  });

  // UPDATE PROJECT (requires auth; any authenticated user can update)
  app.put("/api/projects/:id", requireAuth, async (req: any, res) => {
    const { id } = req.params;
    try {
      // Fetch current project state before update to detect status transitions
      const oldProject = await storageHelper.getProject(id);

      const {
        title,
        projectCode,
        department = [],
        description,
        clientName,
        company,
        location,
        status,
        startDate,
        endDate,
        progress = 0,
        team = [],
        vendors: vendorList = [],
      } = req.body;

      // Validate required fields using shared validator for consistency
      const validationErrors = DataValidator.validateProject({
        title,
        startDate,
        endDate,
        progress,
        department,
        team,
        vendors: vendorList,
      });

      if (validationErrors.length > 0) {
        console.warn("❌ Project update validation failed:", validationErrors);
        return res.status(400).json({
          error: "Validation failed",
          details: validationErrors
        });
      }

      const formatDate = (date: any) => {
        const formatted = DataValidator.formatDate(date);
        if (!formatted) throw new Error(`Invalid date format: ${date}`);
        return formatted;
      };

      const updateData: any = {
        title: title.trim(),
        projectCode: projectCode?.trim() || null,
        clientName: clientName?.trim() || null,
        location: location?.trim() || null,
        description: description?.trim() || null,
        status: status || "Planned",
        progress: Math.min(100, Math.max(0, Number(progress) || 0)),
        updatedAt: new Date(),
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
      };

      console.log("✅ Project update validation passed, updating project:", { id, title });

      const [updated] = await db
        .update(projects)
        .set(updateData)
        .where(eq(projects.id, id))
        .returning();

      if (!updated) return res.status(404).json({ error: "Project not found" });

      // Update related records - ONLY if provided in the request
      // This prevents accidental wiping of data when performing partial updates (like status changes)

      const updateDepartments = req.body.department !== undefined;
      const updateTeam = req.body.team !== undefined;
      const updateVendors = req.body.vendors !== undefined;

      if (updateDepartments) {
        await db.delete(projectDepartments).where(eq(projectDepartments.projectId, id));
        const deptArray = Array.isArray(req.body.department) ? req.body.department : [];
        if (deptArray.length > 0) {
          await db.insert(projectDepartments).values(
            deptArray.filter((d: any) => d?.trim()).map((dept: string) => ({
              projectId: id,
              department: normalizeDept(dept),
            }))
          );
        }
      }

      if (updateTeam) {
        await db.delete(projectTeamMembers).where(eq(projectTeamMembers.projectId, id));
        const teamArray = Array.isArray(req.body.team) ? req.body.team : [];
        if (teamArray.length > 0) {
          await db.insert(projectTeamMembers).values(
            teamArray.filter((t: any) => t?.trim()).map((empId: string) => ({
              projectId: id,
              employeeId: empId,
            }))
          );
        }
      }

      if (updateVendors) {
        await db.delete(projectVendors).where(eq(projectVendors.projectId, id));
        const vendorsArray = Array.isArray(req.body.vendors) ? req.body.vendors : [];
        if (vendorsArray.length > 0) {
          await db.insert(projectVendors).values(
            vendorsArray.filter((v: any) => v?.trim()).map((vendor: string) => ({
              projectId: id,
              vendorName: vendor,
            }))
          );
        }
      }

      // --- ADMIN NOTIFICATION LOGIC ---
      // Triggered only when status transitions TO 'Completed'
      if (updated && updated.status === "Completed" && oldProject?.status !== "Completed") {
        try {
          const adminEmails = await storageHelper.getAdminEmails();
          if (adminEmails.length > 0) {
            // Find the original assigner (creator of project)
            // This ensures "Assigned By" shows the person who started the work (e.g. DurgaDevi E)
            let originalAssignerName = "System Administrator";

            if (updated.createdByEmployeeId) {
              const creator = await storageHelper.getEmployee(updated.createdByEmployeeId);
              if (creator) {
                originalAssignerName = creator.name;
                console.log(`📧 Project Completion Email: Found creator from createdByEmployeeId: ${originalAssignerName}`);
              }
            } else {
              // Fallback: Use task assigner or current user if no creator ID
              const taskAssigners = await db
                .select({ assignerName: employees.name })
                .from(projectTasks)
                .innerJoin(employees, eq(projectTasks.assignerId, employees.id))
                .where(eq(projectTasks.projectId, id));

              const firstTaskAssigner = taskAssigners[0]?.assignerName;
              console.log(`📧 Project Completion Email: Fallback search found ${taskAssigners.length} task assigners. First one: ${firstTaskAssigner || "None"}`);

              originalAssignerName = firstTaskAssigner || req.employee?.name || "System Administrator";
            }
            console.log(`📧 Project Completion Email: Final Assigned By will be: ${originalAssignerName}`);

            // Find first team member details for the email "Employee Name" field
            // Fetch directly from DB to ensure we get the actual assigned personnel (e.g. DurgaDevi E)
            let firstMemberName = "Team Member";
            let firstMemberCode = "N/A";

            // (1) Check Project-level Team Members
            const dbTeamMembers = await db
              .select({
                name: employees.name,
                code: employees.empCode
              })
              .from(projectTeamMembers)
              .innerJoin(employees, eq(projectTeamMembers.employeeId, employees.id))
              .where(eq(projectTeamMembers.projectId, id))
              .limit(1);

            if (dbTeamMembers.length > 0) {
              firstMemberName = dbTeamMembers[0].name;
              firstMemberCode = dbTeamMembers[0].code || "N/A";
            } else {
              // (2) FALLBACK: If project-level team is empty, check Task-level Assignees
              // This handles projects where users are assigned to tasks but not the project team
              const dbTaskAssignees = await db
                .select({
                  name: employees.name,
                  code: employees.empCode
                })
                .from(taskMembers)
                .innerJoin(projectTasks, eq(taskMembers.taskId, projectTasks.id))
                .innerJoin(employees, eq(taskMembers.employeeId, employees.id))
                .where(eq(projectTasks.projectId, id))
                .limit(1);

              if (dbTaskAssignees.length > 0) {
                firstMemberName = dbTaskAssignees[0].name;
                firstMemberCode = dbTaskAssignees[0].code || "N/A";
              }
            }

            for (const adminEmail of adminEmails) {
              await sendProjectCompletionEmail(adminEmail, {
                title: updated.title,
                projectCode: updated.projectCode,
                clientName: updated.clientName || 'N/A',
                startDate: updated.startDate ? new Date(updated.startDate).toLocaleDateString() : 'N/A',
                endDate: updated.endDate ? new Date(updated.endDate).toLocaleDateString() : 'N/A',
                progress: updated.progress,
                assigner: originalAssignerName,
                employeeName: firstMemberName,
                employeeCode: firstMemberCode
              });
            }
          }
        } catch (adminNotifyErr) {
          console.warn("[ADMIN NOTIFY] Failed to dispatch project completion alerts:", adminNotifyErr);
        }
      }

      const result = {
        ...updated,
        department: department || [],
        team: team || [],
        vendors: vendorList || [],
      };

      console.log("✅ Project updated successfully:", id);
      res.json(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("❌ Project update failed:", errorMessage);
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

      console.log("🔵 Backend received keystep payload:", {
        projectId,
        parentKeyStepId,
        title,
        startDate,
        endDate,
      });

      // Validate using validator
      const validationErrors = DataValidator.validateKeystep({
        projectId,
        title,
        startDate,
        endDate,
        phase,
        status,
      });

      if (validationErrors.length > 0) {
        console.warn("❌ Keystep validation failed:", validationErrors);
        return res.status(400).json({
          error: "Validation failed",
          details: validationErrors,
        });
      }

      // Format dates with validation
      const formattedStartDate = DataValidator.formatDate(startDate);
      const formattedEndDate = DataValidator.formatDate(endDate);

      if (!formattedStartDate || !formattedEndDate) {
        return res.status(400).json({
          error: "Date formatting failed",
          details: [
            { field: "startDate", message: `Cannot format date: ${startDate}` },
            { field: "endDate", message: `Cannot format date: ${endDate}` },
          ],
        });
      }

      console.log("🟢 Keystep validation passed, formatted dates:", {
        startDate: formattedStartDate,
        endDate: formattedEndDate,
      });

      let finalPhase = Number(phase) || 1;

      // Auto-increment phase for sub-keysteps
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
        phase: finalPhase,
        status: status ? String(status).toLowerCase() : "pending",
        startDate: formattedStartDate,
        endDate: formattedEndDate,
      };

      console.log("🟢 Inserting keystep values:", valueObj);

      const insertedArr = await db
        .insert(keySteps)
        .values(valueObj)
        .returning();

      console.log("✅ Keystep created successfully:", insertedArr[0].id);
      res.status(201).json(insertedArr[0]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("❌ Keystep creation failed:", errorMessage);
      console.error("❌ Full error:", err);
      res.status(500).json({
        error: "Failed to create keystep",
        message: errorMessage,
      });
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

  // CLONE KEY STEP (duplicate with sub-keysteps)
  app.post("/api/key-steps/:id/clone", async (req, res) => {
    try {
      const { id } = req.params;
      const { newTitle } = req.body;

      // Get original keystep
      const [originalKeyStep] = await db
        .select()
        .from(keySteps)
        .where(eq(keySteps.id, id));

      if (!originalKeyStep) {
        return res.status(404).json({ error: "Key step not found" });
      }

      // Create new keystep with cloned data
      const newKeyStepId = uuidv4();
      await db.insert(keySteps).values({
        id: newKeyStepId,
        projectId: originalKeyStep.projectId,
        header: originalKeyStep.header,
        title: newTitle || `${originalKeyStep.title} (Copy)`,
        description: originalKeyStep.description,
        requirements: originalKeyStep.requirements,
        phase: originalKeyStep.phase,
        status: originalKeyStep.status,
        startDate: originalKeyStep.startDate,
        endDate: originalKeyStep.endDate,
        parentKeyStepId: originalKeyStep.parentKeyStepId,
      });

      // Clone child keysteps
      const originalChildren = await db
        .select()
        .from(keySteps)
        .where(eq(keySteps.parentKeyStepId, id));

      if (originalChildren.length > 0) {
        for (const originalChild of originalChildren) {
          const newChildId = uuidv4();

          await db.insert(keySteps).values({
            id: newChildId,
            projectId: originalChild.projectId,
            header: originalChild.header,
            title: originalChild.title,
            description: originalChild.description,
            requirements: originalChild.requirements,
            phase: originalChild.phase,
            status: originalChild.status,
            startDate: originalChild.startDate,
            endDate: originalChild.endDate,
            parentKeyStepId: newKeyStepId, // Point to the new parent
          });
        }
      }

      console.log(`✅ Key step cloned: ${id} -> ${newKeyStepId}`);
      res.json({
        success: true,
        newKeyStepId,
        message: `Key step cloned successfully as "${newTitle || `${originalKeyStep.title} (Copy)`}"`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Key step clone error:", errorMessage);
      res.status(500).json({ error: "Clone failed", details: errorMessage });
    }
  });

  /* ===============================
      TASKS
================================ */

  // CREATE TASK
  app.post("/api/tasks", requireAuth, async (req: any, res) => {
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

      // assignerId is optional; default to the authenticated employee if available
      const finalAssignerId = assignerId || req.employee?.id || null;

      // Validate using validator
      const validationErrors = DataValidator.validateTask({
        projectId,
        taskName,
        assignerId: finalAssignerId,
        status,
        priority,
        startDate,
        endDate,
        taskMembers: memberList,
        subtasks: incomingSubtasks,
      });

      if (validationErrors.length > 0) {
        console.warn("❌ Task validation failed:", validationErrors);
        return res.status(400).json({
          error: "Validation failed",
          details: validationErrors,
        });
      }

      if (!projectId || !taskName) {
        return res.status(400).json({
          error: "Validation failed",
          details: [
            { field: "projectId", message: "Project ID is required" },
            { field: "taskName", message: "Task name is required" },
          ]
        });
      }

      // Format dates if provided
      let formattedStartDate = null;
      let formattedEndDate = null;

      if (startDate) {
        formattedStartDate = DataValidator.formatDate(startDate);
        if (!formattedStartDate) {
          return res.status(400).json({
            error: "Invalid start date format",
            details: [{ field: "startDate", message: `Cannot parse date: ${startDate}` }],
          });
        }
      }

      if (endDate) {
        formattedEndDate = DataValidator.formatDate(endDate);
        if (!formattedEndDate) {
          return res.status(400).json({
            error: "Invalid end date format",
            details: [{ field: "endDate", message: `Cannot parse date: ${endDate}` }],
          });
        }
      }

      console.log("✅ Task validation passed, creating task:", { projectId, taskName });

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
          startDate: formattedStartDate,
          endDate: formattedEndDate,
          assignerId: finalAssignerId,
        } as any)
        .returning();

      console.log("✅ Task created:", task.id);

      // Insert members
      if (Array.isArray(memberList) && memberList.length > 0) {
        await db.insert(taskMembers).values(
          memberList.map((empId: string) => ({
            taskId: task.id,
            employeeId: empId,
          })),
        );
        console.log("✅ Task members inserted:", memberList.length);
      }

      // Insert subtasks (if provided)
      if (Array.isArray(incomingSubtasks) && incomingSubtasks.length > 0) {
        const rows = incomingSubtasks.map((st: any) => ({
          taskId: task.id,
          title: st.title || null,
          description: st.description || "",
          isCompleted: !!st.isCompleted,
          assignedTo: Array.isArray(st.assignedTo) && st.assignedTo.length > 0
            ? st.assignedTo[0]
            : (typeof st.assignedTo === 'string' ? st.assignedTo : null),
        }));

        console.log("Inserting subtasks:", rows.length);
        const inserted = await db.insert(subtasks).values(rows).returning();

        // If there are subtask members provided as arrays, insert into subtask_members mapping
        try {
          const memberInserts: any[] = [];
          inserted.forEach((ins: any, idx: number) => {
            const incoming = incomingSubtasks[idx];
            if (Array.isArray(incoming.assignedTo) && incoming.assignedTo.length > 0) {
              incoming.assignedTo.forEach((empId: string) =>
                memberInserts.push({ subtaskId: ins.id, employeeId: empId })
              );
            }
          });
          if (memberInserts.length > 0) {
            await db.insert(subtaskMembers).values(memberInserts);
            console.log("✅ Subtask members inserted:", memberInserts.length);
          }
        } catch (err) {
          console.warn("Failed to insert subtask_members mapping:", err);
        }

        console.log("✅ Subtasks inserted:", inserted.length);
      }

      console.log("✅ Task created successfully with all related data");

      // --- EMAIL NOTIFICATION LOGIC ---
      try {
        const assigner = await storageHelper.getEmployee(finalAssignerId);
        const project = await storageHelper.getProject(projectId);

        if (Array.isArray(memberList) && memberList.length > 0) {
          for (const empId of memberList) {
            const employee = await storageHelper.getEmployee(empId);
            if (employee && employee.email) {
              const [userRow] = await db.select().from(users).where(eq(users.employeeId, empId));
              const role = userRow?.role || 'EMPLOYEE';

              await sendTaskAssignmentEmail(
                employee.email,
                {
                  name: employee.name,
                  code: employee.empCode || 'N/A',
                  project: project?.title || 'Unknown Project',
                  assigner: assigner?.name || 'Admin',
                  dueDate: formattedEndDate || 'Not Set',
                },
                {
                  name: taskName,
                  priority: priority || 'medium',
                  startDate: formattedStartDate || 'N/A',
                  endDate: formattedEndDate || 'N/A',
                  status: status || 'pending',
                },
                role.toLowerCase() as any
              );
            }
          }
        }

        // --- SUBTASK EMAIL NOTIFICATIONS ---
        if (Array.isArray(incomingSubtasks) && incomingSubtasks.length > 0) {
          for (const st of incomingSubtasks) {
            const stMembers = Array.isArray(st.assignedTo)
              ? st.assignedTo
              : (typeof st.assignedTo === 'string' ? [st.assignedTo] : []);

            if (stMembers.length > 0) {
              for (const empId of stMembers) {
                const employee = await storageHelper.getEmployee(empId);
                if (employee && employee.email) {
                  const [userRow] = await db.select().from(users).where(eq(users.employeeId, empId));
                  const role = userRow?.role || 'EMPLOYEE';

                  await sendSubtaskAssignmentEmail(
                    employee.email,
                    {
                      name: employee.name,
                      code: employee.empCode || 'N/A',
                      project: project?.title || 'Unknown Project',
                      assigner: assigner?.name || 'Admin',
                      dueDate: st.endDate || 'Not Set',
                    },
                    {
                      name: st.title,
                      priority: priority || 'medium',
                      startDate: st.startDate || 'N/A',
                      endDate: st.endDate || 'N/A',
                      status: 'pending',
                      parentTaskName: taskName
                    },
                    role.toLowerCase() as any
                  );
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn("[POST /api/tasks] Notification failure:", err);
      }

      res.json(task);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("❌ Task creation failed:", errorMessage);
      console.error("❌ Full error:", err);
      res.status(500).json({
        error: "Task creation failed",
        message: errorMessage
      });
    }
  });

  // UPDATE TASK
  app.put("/api/tasks/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;

      // Fetch current members to identify newly added ones later
      const oldMemberIds = await storageHelper.getTaskMembers(id);

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

      // If assignerId is omitted, default to authenticated employee (if any)
      const finalAssignerId = typeof assignerId !== 'undefined' ? assignerId : req.employee?.id || null;

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
        assignerId: finalAssignerId,
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
          description: st.description || "",
          isCompleted: !!st.isCompleted,
          assignedTo: Array.isArray(st.assignedTo) && st.assignedTo.length > 0 ? st.assignedTo[0] : (typeof st.assignedTo === 'string' ? st.assignedTo : null),
          startDate: st.startDate || null,
          endDate: st.endDate || null,
        }));
        console.log("Updating subtasks:", rows);
        const inserted = await db.insert(subtasks).values(rows).returning();

        // persist subtask members mapping
        try {
          const memberInserts: any[] = [];
          inserted.forEach((ins: any, idx: number) => {
            const incoming = incomingSubtasks[idx];
            if (Array.isArray(incoming.assignedTo) && incoming.assignedTo.length > 0) {
              incoming.assignedTo.forEach((empId: string) => memberInserts.push({ subtaskId: ins.id, employeeId: empId }));
            }
          });
          if (memberInserts.length > 0) {
            await db.insert(subtaskMembers).values(memberInserts);
          }
        } catch (err) {
          console.warn("Failed to insert subtask_members mapping:", err);
        }
      }

      try {
        const assigner = await storageHelper.getEmployee(finalAssignerId);
        const project = await storageHelper.getProject(updateData.projectId || updated.projectId);

        // Identify newly added members
        const newMembers = (memberList || []).filter((id: string) => !oldMemberIds.includes(id));

        if (newMembers.length > 0) {

          for (const empId of newMembers) {
            const employee = await storageHelper.getEmployee(empId);
            if (employee && employee.email) {
              const [userRow] = await db.select().from(users).where(eq(users.employeeId, empId));
              const role = userRow?.role || 'EMPLOYEE';

              await sendTaskAssignmentEmail(
                employee.email,
                {
                  name: employee.name,
                  code: employee.empCode || 'N/A',
                  project: project?.title || 'Unknown Project',
                  assigner: assigner?.name || 'Admin',
                  dueDate: updateData.endDate || 'Not Set',
                },
                {
                  name: taskName,
                  priority: updateData.priority || 'medium',
                  startDate: updateData.startDate || 'N/A',
                  endDate: updateData.endDate || 'N/A',
                  status: updateData.status || 'pending',
                },
                role.toLowerCase() as any
              );
            }
          }
        }

        // --- SUBTASK EMAIL NOTIFICATIONS ---
        if (Array.isArray(incomingSubtasks) && incomingSubtasks.length > 0) {
          for (const st of incomingSubtasks) {
            const stMembers = Array.isArray(st.assignedTo)
              ? st.assignedTo
              : (typeof st.assignedTo === 'string' ? [st.assignedTo] : []);

            if (stMembers.length > 0) {
              for (const empId of stMembers) {
                const employee = await storageHelper.getEmployee(empId);
                if (employee && employee.email) {
                  const [userRow] = await db.select().from(users).where(eq(users.employeeId, empId));
                  const role = userRow?.role || 'EMPLOYEE';

                  await sendSubtaskAssignmentEmail(
                    employee.email,
                    {
                      name: employee.name,
                      code: employee.empCode || 'N/A',
                      project: project?.title || 'Unknown Project',
                      assigner: assigner?.name || 'Admin',
                      dueDate: st.endDate || 'Not Set',
                    },
                    {
                      name: st.title,
                      priority: updateData.priority || 'medium',
                      startDate: st.startDate || 'N/A',
                      endDate: st.endDate || 'N/A',
                      status: 'pending',
                      parentTaskName: taskName || updated.taskName
                    },
                    role.toLowerCase() as any
                  );
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn("[PUT /api/tasks/:id] Notification failure:", err);
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

  // CLONE TASK (duplicate with subtasks and members)
  app.post("/api/tasks/:id/clone", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { newName } = req.body;

      // Get original task
      const [originalTask] = await db
        .select()
        .from(projectTasks)
        .where(eq(projectTasks.id, id));

      if (!originalTask) {
        return res.status(404).json({ error: "Task not found" });
      }

      // Create new task with cloned data
      const newTaskId = uuidv4();
      await db.insert(projectTasks).values({
        id: newTaskId,
        projectId: originalTask.projectId,
        keyStepId: originalTask.keyStepId,
        taskName: newName || `${originalTask.taskName} (Copy)`,
        description: originalTask.description,
        status: originalTask.status,
        priority: originalTask.priority,
        startDate: originalTask.startDate,
        endDate: originalTask.endDate,
        assignerId: originalTask.assignerId,
      });

      // Clone task members
      const originalMembers = await db
        .select()
        .from(taskMembers)
        .where(eq(taskMembers.taskId, id));

      if (originalMembers.length > 0) {
        await db.insert(taskMembers).values(
          originalMembers.map(m => ({
            taskId: newTaskId,
            employeeId: m.employeeId,
          }))
        );
      }

      // Clone subtasks
      const originalSubtasks = await db
        .select()
        .from(subtasks)
        .where(eq(subtasks.taskId, id));

      if (originalSubtasks.length > 0) {
        const subtaskIds = new Map<string, string>();

        for (const originalSubtask of originalSubtasks) {
          const newSubtaskId = uuidv4();
          subtaskIds.set(originalSubtask.id, newSubtaskId);

          await db.insert(subtasks).values({
            id: newSubtaskId,
            taskId: newTaskId,
            title: originalSubtask.title,
            description: originalSubtask.description || "",
            isCompleted: false,
            assignedTo: originalSubtask.assignedTo,
            startDate: originalSubtask.startDate || null,
            endDate: originalSubtask.endDate || null,
          });

          // Clone subtask members
          const subMembers = await db
            .select()
            .from(subtaskMembers)
            .where(eq(subtaskMembers.subtaskId, originalSubtask.id));

          if (subMembers.length > 0) {
            await db.insert(subtaskMembers).values(
              subMembers.map(m => ({
                subtaskId: newSubtaskId,
                employeeId: m.employeeId,
              }))
            );
          }
        }
      }

      res.json({
        success: true,
        newTaskId,
        message: `Task cloned successfully as "${newName || `${originalTask.taskName} (Copy)`}"`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Task clone error:", errorMessage);
      res.status(500).json({ error: "Clone failed", details: errorMessage });
    }
  });

  // CREATE SUBTASK (standalone endpoint for quick add)
  app.post("/api/subtasks", requireAuth, async (req: any, res) => {
    try {
      const { taskId, title, description = "", startDate = null, endDate = null } = req.body;

      if (!taskId || !title) {
        return res.status(400).json({ error: "taskId and title are required" });
      }

      const newSubtaskId = uuidv4();
      await db.insert(subtasks).values({
        id: newSubtaskId,
        taskId,
        title: title.trim(),
        description: description || "",
        isCompleted: false,
        assignedTo: null,
        startDate: startDate || null,
        endDate: endDate || null,
      });

      res.json({
        success: true,
        id: newSubtaskId,
        message: "Subtask created successfully",
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Subtask create error:", errorMessage);
      res.status(500).json({ error: "Failed to create subtask", details: errorMessage });
    }
  });

  // PATCH single subtask (toggle complete / update dates)
  app.patch("/api/subtasks/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { isCompleted, startDate, endDate } = req.body;

      const updateData: any = {};
      if (typeof isCompleted !== 'undefined') updateData.isCompleted = !!isCompleted;
      if (typeof startDate !== 'undefined') updateData.startDate = startDate || null;
      if (typeof endDate !== 'undefined') updateData.endDate = endDate || null;

      // DEBUG: log incoming update payload
      console.debug('[PATCH /api/subtasks/:id] id=', id, 'updateData=', updateData);

      const [updated] = await db.update(subtasks).set(updateData).where(eq(subtasks.id, id)).returning();
      console.debug('[PATCH /api/subtasks/:id] db returned updated=', updated);

      if (!updated) return res.status(404).json({ message: 'Subtask not found' });

      // Build assignedTo array from mapping (if any)
      let assigned: string[] = [];
      try {
        const rows = await db.select({ employeeId: subtaskMembers.employeeId }).from(subtaskMembers).where(eq(subtaskMembers.subtaskId, id));
        assigned = rows.map(r => r.employeeId);
      } catch (e) {
        assigned = updated.assignedTo ? [updated.assignedTo] : [];
      }

      res.json({ id: updated.id, title: updated.title, description: updated.description || "", isCompleted: updated.isCompleted, assignedTo: assigned, startDate: updated.startDate || null, endDate: updated.endDate || null });
    } catch (err) {
      console.error('Failed to patch subtask:', err);
      res.status(500).json({ message: 'Failed to update subtask' });
    }
  });

  // CLONE SUBTASK
  app.post("/api/subtasks/:id/clone", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { newTitle } = req.body;

      // Get original subtask
      const [originalSubtask] = await db
        .select()
        .from(subtasks)
        .where(eq(subtasks.id, id));

      if (!originalSubtask) {
        return res.status(404).json({ error: "Subtask not found" });
      }

      // Create new subtask
      const newSubtaskId = uuidv4();
      await db.insert(subtasks).values({
        id: newSubtaskId,
        taskId: originalSubtask.taskId,
        title: newTitle || `${originalSubtask.title} (Copy)`,
        description: originalSubtask.description,
        isCompleted: false,
        assignedTo: originalSubtask.assignedTo,
      });

      // Clone subtask members
      const originalMembers = await db
        .select()
        .from(subtaskMembers)
        .where(eq(subtaskMembers.subtaskId, id));

      if (originalMembers.length > 0) {
        await db.insert(subtaskMembers).values(
          originalMembers.map(m => ({
            subtaskId: newSubtaskId,
            employeeId: m.employeeId,
          }))
        );
      }

      res.json({
        success: true,
        newSubtaskId,
        message: `Subtask cloned successfully as "${newTitle || `${originalSubtask.title} (Copy)`}"`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Subtask clone error:", errorMessage);
      res.status(500).json({ error: "Clone failed", details: errorMessage });
    }
  });

  // BULK ASSIGN MEMBERS TO TASKS
  app.post("/api/tasks/bulk-assign", requireAuth, async (req: any, res) => {
    try {
      const { taskIds, employeeIds } = req.body;

      if (!Array.isArray(taskIds) || !Array.isArray(employeeIds) || taskIds.length === 0) {
        return res.status(400).json({ error: "taskIds (non-empty array) and employeeIds (array) are required" });
      }

      // We'll perform each task's membership update
      // This involves deleting existing members and inserting new ones
      await db.transaction(async (tx) => {
        for (const taskId of taskIds) {
          // Delete existing members for this task
          await tx.delete(taskMembers).where(eq(taskMembers.taskId, taskId));

          // Insert new members if any
          if (employeeIds.length > 0) {
            await tx.insert(taskMembers).values(
              employeeIds.map((empId) => ({
                taskId,
                employeeId: empId,
              }))
            );
          }
        }
      });

      res.json({ success: true, message: `Assigned members to ${taskIds.length} tasks` });
    } catch (err) {
      console.error("Bulk assign error:", err);
      res.status(500).json({ error: "Bulk assignment failed" });
    }
  });

  // BULK FETCH ALL TASKS (all tasks for all authenticated users)
  app.get("/api/tasks/bulk", requireAuth, async (req: any, res) => {
    try {
      // Fetch ALL tasks from all projects for any authenticated user
      const tasks = await db.select().from(projectTasks);

      if (!tasks.length) return res.json([]);

      const taskIds = tasks.map((t) => t.id);

      // Fetch members and subtasks in parallel for better performance
      const [members, subs] = await Promise.all([
        db
          .select()
          .from(taskMembers)
          .where(inArray(taskMembers.taskId, taskIds)),
        db
          .select()
          .from(subtasks)
          .where(inArray(subtasks.taskId, taskIds)),
      ]);

      // Build maps for O(1) lookups instead of O(n) filtering
      const memberMap = new Map<string, string[]>();
      const subtaskMap = new Map<string, any[]>();

      members.forEach((m) => {
        if (!memberMap.has(m.taskId)) memberMap.set(m.taskId, []);
        memberMap.get(m.taskId)!.push(m.employeeId);
      });

      subs.forEach((s) => {
        if (!subtaskMap.has(s.taskId)) subtaskMap.set(s.taskId, []);
        subtaskMap.get(s.taskId)!.push(s);
      });

      // Build result with members and subtasks
      const result = tasks.map((task) => ({
        ...task,
        assignedMembers: memberMap.get(task.id) || [],
        subtasks: subtaskMap.get(task.id) || [],
      }));

      res.json(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Bulk tasks fetch error:", errorMessage);
      res.status(500).json({ error: "Failed to fetch tasks", details: errorMessage });
    }
  });

  // BULK FETCH ALL KEY STEPS (all key steps for all authenticated users)
  app.get("/api/keysteps/bulk", requireAuth, async (req: any, res) => {
    try {
      // Fetch ALL key steps from all projects for any authenticated user
      const steps = await db
        .select()
        .from(keySteps)
        .orderBy(keySteps.createdAt);

      res.json(steps);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Bulk keysteps fetch error:", errorMessage);
      res.status(500).json({ error: "Failed to fetch keysteps", details: errorMessage });
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

      // Fetch members and subtasks in parallel
      const [members, subs] = await Promise.all([
        db
          .select({
            taskId: taskMembers.taskId,
            employeeId: taskMembers.employeeId,
          })
          .from(taskMembers)
          .where(inArray(taskMembers.taskId, taskIds)),
        db
          .select({
            id: subtasks.id,
            taskId: subtasks.taskId,
            title: subtasks.title,
            description: subtasks.description,
            isCompleted: subtasks.isCompleted,
            assignedTo: subtasks.assignedTo,
            startDate: subtasks.startDate,
            endDate: subtasks.endDate,
          })
          .from(subtasks)
          .where(inArray(subtasks.taskId, taskIds)),
      ]);

      // Fetch subtask member mappings for subtasks we just retrieved
      let subtaskMemberRows: any[] = [];
      try {
        const subtaskIds = subs.map((s: any) => s.id).filter(Boolean);
        if (subtaskIds.length > 0) {
          subtaskMemberRows = await db
            .select({ subtaskId: subtaskMembers.subtaskId, employeeId: subtaskMembers.employeeId })
            .from(subtaskMembers)
            .where(inArray(subtaskMembers.subtaskId, subtaskIds));
        }
      } catch (e) {
        subtaskMemberRows = [];
      }

      // Build maps for O(1) lookups
      const memberMap = new Map<string, string[]>();
      const subtaskMap = new Map<string, any[]>();

      members.forEach((m) => {
        if (!memberMap.has(m.taskId)) memberMap.set(m.taskId, []);
        memberMap.get(m.taskId)!.push(m.employeeId);
      });

      // Build a map of subtaskId -> assigned employee ids (supports many-to-many)
      const subtaskMembersMap = new Map<string, string[]>();
      (subtaskMemberRows || []).forEach((r: any) => {
        if (!subtaskMembersMap.has(r.subtaskId)) subtaskMembersMap.set(r.subtaskId, []);
        subtaskMembersMap.get(r.subtaskId)!.push(r.employeeId);
      });

      subs.forEach((s) => {
        if (!subtaskMap.has(s.taskId)) subtaskMap.set(s.taskId, []);
        const assigned = subtaskMembersMap.get(s.id) || (s.assignedTo ? [s.assignedTo] : []);
        subtaskMap.get(s.taskId)!.push({
          id: s.id,
          title: s.title,
          description: s.description || "",
          isCompleted: s.isCompleted,
          assignedTo: assigned,
          startDate: s.startDate || null,
          endDate: s.endDate || null,
        });
      });

      const result = tasks.map((t) => ({
        ...t,
        taskMembers: memberMap.get(t.id) || [],
        subtasks: subtaskMap.get(t.id) || [],
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
        .select({ id: subtasks.id, title: subtasks.title, description: subtasks.description, isCompleted: subtasks.isCompleted, assignedTo: subtasks.assignedTo, startDate: subtasks.startDate, endDate: subtasks.endDate })
        .from(subtasks)
        .where(eq(subtasks.taskId, id));

      // Fetch subtask members mapping for these subtasks
      const subtaskIds = subs.map((s: any) => s.id).filter(Boolean);
      let subtaskMemberRows: any[] = [];
      if (subtaskIds.length > 0) {
        try {
          subtaskMemberRows = await db
            .select({ subtaskId: subtaskMembers.subtaskId, employeeId: subtaskMembers.employeeId })
            .from(subtaskMembers)
            .where(inArray(subtaskMembers.subtaskId, subtaskIds));
        } catch (e) {
          subtaskMemberRows = [];
        }
      }

      const subtaskMembersMap = new Map<string, string[]>();
      subtaskMemberRows.forEach((r: any) => {
        if (!subtaskMembersMap.has(r.subtaskId)) subtaskMembersMap.set(r.subtaskId, []);
        subtaskMembersMap.get(r.subtaskId)!.push(r.employeeId);
      });

      const result = {
        ...task,
        taskMembers: members.map(m => m.employeeId),
        subtasks: subs.map(s => ({ id: s.id, title: s.title, description: s.description || "", isCompleted: s.isCompleted, assignedTo: subtaskMembersMap.get(s.id) || (s.assignedTo ? [s.assignedTo] : []), startDate: s.startDate || null, endDate: s.endDate || null })),
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

      const filePath = (fileRecord as any).filePath || fileRecord.storageUrl;
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
