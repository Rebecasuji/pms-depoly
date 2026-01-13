// server/routes.ts

import type { Express } from "express";
import type { Server } from "http";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { eq } from "drizzle-orm";

import { db, pool } from "./db";
import {
  projectFiles,
  vendors,
  keySteps,
  projectTasks,
  taskMembers,
  subtasks,
} from "../shared/schema";

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
  app: Express
): Promise<Server> {

  /* ===============================
     EMPLOYEES
  ================================ */
  app.get("/api/employees", async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT emp_code AS id, employee_name AS name, designation
        FROM "Employees"
        ORDER BY employee_name
      `);
      res.json(result.rows);
    } catch (err) {
      console.error("Employees fetch error:", err);
      res.status(500).json([]);
    }
  });

  /* ===============================
     PROJECTS
  ================================ */

  // ✅ GET ALL PROJECTS
  app.get("/api/projects", async (_req, res) => {
    try {
      const result = await pool.query(`
        SELECT 
          p.project_code AS id,
          p.project_code AS "projectCode",
          p.project_name AS title,
          p.client_name AS "clientName",
          p.description,
          p.status,
          p.progress_percentage AS progress,
          p.start_date AS "startDate",
          p.end_date AS "endDate",

          COALESCE(
            json_agg(DISTINCT ptm.emp_code)
              FILTER (WHERE ptm.emp_code IS NOT NULL),
            '[]'::json
          ) AS team,

          COALESCE(
            json_agg(DISTINCT pv.vendor_name)
              FILTER (WHERE pv.vendor_name IS NOT NULL),
            '[]'::json
          ) AS vendors

        FROM "Projects" p
        LEFT JOIN project_team_members ptm
          ON ptm.project_code = p.project_code
        LEFT JOIN project_vendors pv
          ON pv.project_code = p.project_code
        GROUP BY p.project_code
        ORDER BY p.project_code DESC
      `);

      res.json(result.rows);
    } catch (err) {
      console.error("Projects fetch error:", err);
      res.status(500).json([]);
    }
  });

  // ✅ CREATE PROJECT
  app.post("/api/projects", async (req, res) => {
    const client = await pool.connect();
    try {
      const {
        title,
        projectCode,
        clientName,
        description,
        status,
        startDate,
        endDate,
        progress,
        team = [],
        vendors = [],
      } = req.body;

      const finalProjectCode = projectCode || uuidv4();

      await client.query("BEGIN");

      await client.query(
        `INSERT INTO "Projects"
          (project_code, project_name, client_name, description, status, progress_percentage, start_date, end_date)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [
          finalProjectCode,
          title,
          clientName || null,
          description || null,
          status || "open",
          progress || 0,
          startDate || null,
          endDate || null,
        ]
      );

      for (const empCode of team) {
        await client.query(
          `INSERT INTO project_team_members (project_code, emp_code)
           VALUES ($1,$2)`,
          [finalProjectCode, empCode]
        );
      }

      for (const vendor of vendors) {
        await client.query(
          `INSERT INTO project_vendors (project_code, vendor_name)
           VALUES ($1,$2)`,
          [finalProjectCode, vendor]
        );
      }

      await client.query("COMMIT");

      res.json({
        id: finalProjectCode,
        projectCode: finalProjectCode,
        title,
        clientName,
        description,
        status,
        progress,
        startDate,
        endDate,
        team,
        vendors,
      });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Projects insert error:", err);
      res.status(500).json({ error: "Failed to create project" });
    } finally {
      client.release();
    }
  });

  // ✅ UPDATE PROJECT  (THIS FIXES YOUR ISSUE)
  app.put("/api/projects/:id", async (req, res) => {
    const { id } = req.params;

    const {
      title,
      clientName,
      description,
      startDate,
      endDate,
      progress = 0,
      team = [],
      vendors = [],
      status,
    } = req.body;

    if (!title || !startDate || !endDate) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const updateRes = await client.query(
        `UPDATE "Projects"
         SET project_name = $1,
             client_name = $2,
             description = $3,
             status = $4,
             progress_percentage = $5,
             start_date = $6,
             end_date = $7
         WHERE project_code = $8`,
        [
          title,
          clientName || null,
          description || null,
          status || "open",
          progress,
          startDate,
          endDate,
          id,
        ]
      );

      // 🔥 important: ensure row actually updated
      if (updateRes.rowCount === 0) {
        throw new Error("Project not found");
      }

      await client.query(`DELETE FROM project_team_members WHERE project_code = $1`, [id]);
      for (const empCode of team) {
        await client.query(
          `INSERT INTO project_team_members (project_code, emp_code)
           VALUES ($1, $2)`,
          [id, empCode]
        );
      }

      await client.query(`DELETE FROM project_vendors WHERE project_code = $1`, [id]);
      for (const vendor of vendors) {
        await client.query(
          `INSERT INTO project_vendors (project_code, vendor_name)
           VALUES ($1, $2)`,
          [id, vendor]
        );
      }

      await client.query("COMMIT");

      res.json({
        id,
        projectCode: id,
        title,
        clientName,
        description,
        status: status || "open",
        progress,
        startDate,
        endDate,
        team,
        vendors,
      });

    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Project update error:", err);
      res.status(500).json({ message: "Failed to update project" });
    } finally {
      client.release();
    }
  });

  // ✅ DELETE PROJECT
  app.delete("/api/projects/:id", async (req, res) => {
    const { id } = req.params;
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(`DELETE FROM project_team_members WHERE project_code = $1`, [id]);
      await client.query(`DELETE FROM project_vendors WHERE project_code = $1`, [id]);
      await client.query(`DELETE FROM "Projects" WHERE project_code = $1`, [id]);

      await client.query("COMMIT");
      res.json({ success: true });
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("Project delete error:", err);
      res.status(500).json({ message: "Failed to delete project" });
    } finally {
      client.release();
    }
  });

  /* ===============================
     KEY STEPS
  ================================ */

  app.post("/api/key-steps", async (req, res) => {
    try {
      const {
        projectId,
        header = "",
        title,
        description = "",
        requirements = "",
        phase,
        status = "pending",
        startDate,
        endDate,
      } = req.body;

      if (!projectId || !title || !phase || !startDate || !endDate) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const insertedArr = await db
        .insert(keySteps)
        .values({
          projectId,
          header,
          title,
          description,
          requirements,
          phase: Number(phase),
          status,
          startDate,
          endDate,
        })
        .returning();

      return res.status(201).json(insertedArr[0] ?? null);
    } catch (err) {
      console.error("Key step insert error:", err);
      return res.status(500).json({ message: "Failed to insert key step" });
    }
  });

  app.get("/api/projects/:projectId/key-steps", async (req, res) => {
    try {
      const steps = await db
        .select()
        .from(keySteps)
        .where(eq(keySteps.projectId, req.params.projectId));

      return res.json(steps);
    } catch (err) {
      console.error("Key steps fetch error:", err);
      return res.status(500).json([]);
    }
  });

  app.put("/api/key-steps/:id", async (req, res) => {
    const { id } = req.params;

    const {
      header = "",
      title,
      description = "",
      requirements = "",
      phase,
      status = "pending",
      startDate,
      endDate,
      projectId,
    } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    try {
      const updatedArr = await db
        .update(keySteps)
        .set({
          header,
          title,
          description,
          requirements,
          phase: Number(phase),
          status,
          startDate,
          endDate,
          projectId,
        })
        .where(eq(keySteps.id, id))
        .returning();

      if (!updatedArr.length) {
        return res.status(404).json({ message: "Key step not found" });
      }

      return res.json(updatedArr[0]);
    } catch (err) {
      console.error("Key step update error:", err);
      return res.status(500).json({ message: "Failed to update key step" });
    }
  });

  app.delete("/api/key-steps/:id", async (req, res) => {
    try {
      await db.delete(keySteps).where(eq(keySteps.id, req.params.id));
      return res.json({ success: true });
    } catch (err) {
      console.error("Key step delete error:", err);
      return res.status(500).json({ message: "Failed to delete key step" });
    }
  });

  /* ===============================
     TASKS
  ================================ */
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
        taskMembers: members = [],
        subtasks: subTasks = [],
      } = req.body;

      if (!projectId || !taskName || !assignerId) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const task = await db.transaction(async (tx) => {
        const [created] = await tx
          .insert(projectTasks)
          .values({
            projectId,
            keyStepId,
            taskName,
            description,
            status,
            priority,
            startDate,
            endDate,
            assignerId,
          })
          .returning();

        if (members.length) {
          await tx.insert(taskMembers).values(
            members.map((empId: string) => ({
              taskId: created.id,
              employeeId: empId,
            }))
          );
        }

        if (subTasks.length) {
          await tx.insert(subtasks).values(
            subTasks.map((st: any) => ({
              taskId: created.id,
              title: st.title,
              assignedTo: st.assignedTo || null,
              isCompleted: st.isCompleted || false,
            }))
          );
        }

        return created;
      });

      res.status(201).json({ success: true, taskId: task.id });
    } catch (err) {
      console.error("Task insert error:", err);
      res.status(500).json({ message: "Failed to create task" });
    }
  });

  app.get("/api/tasks/:projectId", async (req, res) => {
    try {
      const tasks = await db
        .select()
        .from(projectTasks)
        .where(eq(projectTasks.projectId, req.params.projectId));
      res.json(tasks);
    } catch (err) {
      console.error("Tasks fetch error:", err);
      res.status(500).json([]);
    }
  });

  /* ===============================
   UPDATE TASK
================================ */
app.put("/api/tasks/:id", async (req, res) => {
  const { id } = req.params;

  const {
    projectId,
    taskName,
    description,
    status,
    priority,
    startDate,
    endDate,
    assignerId,
    taskMembers: members = [],
    subtasks: subTasks = [],
  } = req.body;

  if (!taskName || !assignerId || !projectId) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    const updatedTask = await db.transaction(async (tx) => {
      // 🔹 Update main task
      const [updated] = await tx
        .update(projectTasks)
        .set({
          taskName,
          description,
          status,
          priority,
          startDate,
          endDate,
          assignerId,
        })
        .where(eq(projectTasks.id, id))
        .returning();

      if (!updated) {
        throw new Error("Task not found");
      }

      // 🔹 Reset task members
      await tx.delete(taskMembers).where(eq(taskMembers.taskId, id));
      if (members.length) {
        await tx.insert(taskMembers).values(
          members.map((empId: string) => ({
            taskId: id,
            employeeId: empId,
          }))
        );
      }

      // 🔹 Reset subtasks
      await tx.delete(subtasks).where(eq(subtasks.taskId, id));
      if (subTasks.length) {
        await tx.insert(subtasks).values(
          subTasks.map((st: any) => ({
            taskId: id,
            title: st.title,
            assignedTo: st.assignedTo || null,
            isCompleted: st.isCompleted || false,
          }))
        );
      }

      return updated;
    });

    res.json({ success: true, task: updatedTask });
  } catch (err) {
    console.error("Task update error:", err);
    res.status(500).json({ message: "Failed to update task" });
  }
});

  /* ===============================
     FILES & VENDORS
  ================================ */
  app.post(
    "/api/projects/:id/upload",
    upload.single("file"),
    async (req, res) => {
      if (!req.file) return res.status(400).json({ error: "No file" });

      const filePath = `/uploads/${req.file.filename}`;

      const insertedArr = await db
        .insert(projectFiles)
        .values({
          projectId: req.params.id,
          fileName: req.file.originalname,
          filePath,
          fileUrl: filePath,
          fileSize: req.file.size,
          uploadedBy: "system",
        })
        .returning();

      res.json(insertedArr[0] ?? null);
    }
  );

  app.get("/api/projects/:id/files", async (req, res) => {
    try {
      const files = await db
        .select()
        .from(projectFiles)
        .where(eq(projectFiles.projectId, req.params.id));
      res.json(files);
    } catch (err) {
      console.error("Files fetch error:", err);
      res.status(500).json([]);
    }
  });

  app.get("/api/vendors", async (_req, res) => {
    try {
      const allVendors = await db.select().from(vendors);
      res.json(allVendors);
    } catch (err) {
      console.error("Vendors fetch error:", err);
      res.status(500).json([]);
    }
  });

  return httpServer;
}
