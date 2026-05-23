import express, { type Express } from "express";
import type { Server } from "http";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import { eq, inArray, or, desc, aliasedTable } from "drizzle-orm";
import { and, sql } from "drizzle-orm";

import { db, pool } from "./db.ts";
import { getProjectTimeEntries, getTimestrapTableInfo } from "./timestrap-db.ts";
import { DataValidator } from "../shared/dataValidator.ts";
import { storage as storageHelper } from "./storage.ts";
import {
  sendTaskAssignmentEmail,
  sendSubtaskAssignmentEmail,
  sendProjectCompletionEmail,
  sendSiteReportEmail,
  sendTicketNotificationEmail
} from "./email.ts";
import fs from "fs";
import path from "path";
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
  progressLogs,
  discussions,
  discussionReplies,
  discussionParticipants,
  discussionAttachments,
  siteReports,
  siteReportAttachments,
  emailGroups,
  tickets,
  ticketComments,
  ticketAttachments,
  taskComments,
  keyStepTemplates,
  keyStepTemplateItems,
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
const creator = aliasedTable(employees, "creator");
const assignee = aliasedTable(employees, "assignee");

export async function registerRoutes(
  httpServer: Server,
  app: Express,
): Promise<Server> {

  // Serve uploads statically
  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  /* ===============================
     TICKETS (Prioritized)
  ================================ */

  // Helper to generate ticket code
  async function generateTicketCode() {
    console.log("[TICKETS-TRACE] Generating ticket code...");
    try {
      const lastTicket = await db.select({ ticketCode: tickets.ticketCode })
        .from(tickets)
        .where(sql`ticket_code LIKE 'TKT-%'`)
        .orderBy(desc(tickets.createdAt))
        .limit(1);

      if (lastTicket.length === 0) return "TKT-001";

      const lastCode = lastTicket[0].ticketCode;
      const parts = lastCode.split("-");

      // Look for the last part that is a number
      let lastNum = 0;
      for (let i = parts.length - 1; i >= 0; i--) {
        const val = parseInt(parts[i]);
        if (!isNaN(val)) {
          lastNum = val;
          break;
        }
      }

      const nextNum = lastNum + 1;
      return `TKT-${nextNum.toString().padStart(3, "0")}`;
    } catch (err) {
      console.error("[TICKETS-ERROR] Code generation failed:", err);
      // Fallback to a timestamp-based ID if DB query fails
      return `TKT-ALT-${Date.now().toString().slice(-6)}`;
    }
  }

  app.get("/api/tickets", requireAuth, async (req: any, res) => {
    console.log("[TICKETS-TRACE] GET /api/tickets request received");
    try {
      const { status, priority, category } = req.query;
      const isAdmin = req.user?.role === "ADMIN";
      const empId = req.employee?.id;

      let conditions = [];
      if (!isAdmin) {
        conditions.push(or(
          eq(tickets.createdBy, empId),
          eq(tickets.assignedTo, empId),
          sql`${tickets.participants}::jsonb @> ${JSON.stringify([empId])}::jsonb`
        ));
      }
      if (status) conditions.push(eq(tickets.status, status as string));
      if (priority) conditions.push(eq(tickets.priority, priority as string));
      if (category) conditions.push(eq(tickets.category, category as string));

      const rows = await db
        .select({
          id: tickets.id,
          ticketCode: tickets.ticketCode,
          title: tickets.title,
          category: tickets.category,
          priority: tickets.priority,
          status: tickets.status,
          department: tickets.department,
          projectId: tickets.projectId,
          companyName: tickets.companyName,
          participants: tickets.participants,
          createdBy: tickets.createdBy,
          createdByName: creator.name,
          assignedTo: tickets.assignedTo,
          assignedToName: assignee.name,
          description: tickets.description,
          createdAt: tickets.createdAt,
          updatedAt: tickets.updatedAt,
          taskId: tickets.taskId,
        })
        .from(tickets)
        .leftJoin(creator, eq(tickets.createdBy, creator.id))
        .leftJoin(assignee, eq(tickets.assignedTo, assignee.id))
        .where(conditions.length > 0 ? and(...conditions) : sql`TRUE`)
        .orderBy(desc(tickets.createdAt));

      res.json(rows);
    } catch (err) {
      console.error("[TICKETS-ERROR] Fetch tickets failed:", err);
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });

  app.post("/api/tickets", requireAuth, async (req: any, res) => {
    console.log("[TICKETS-TRACE] POST /api/tickets request received:", JSON.stringify(req.body, null, 2));
    try {
      const { 
        title, 
        description, 
        category, 
        priority, 
        department, 
        projectId, 
        manualProject, 
        attachments,
        companyName,
        participants,
        assignedTo
      } = req.body;
      const empId = req.employee?.id;
      if (!empId) {
        console.warn("[TICKETS-WARN] No employee ID found for user:", req.user?.id);
        return res.status(403).json({ error: "Employee profile required" });
      }

      console.log("[TICKETS-TRACE] Generating ticket code...");
      const ticketCode = await generateTicketCode();
      console.log("[TICKETS-TRACE] Generated code:", ticketCode);

      const insertData = {
        ticketCode,
        title,
        description,
        category,
        priority: priority || "Medium",
        department: department || "General",
        projectId: (projectId && projectId !== "none") ? projectId : null,
        manualProject: manualProject || null,
        companyName: companyName || null,
        participants: participants || [],
        assignedTo: assignedTo || null,
        createdBy: empId,
        status: "Open"
      };

      console.log("[TICKETS-TRACE] Attempting database insert:", JSON.stringify(insertData, null, 2));
      const [ticket] = await db.insert(tickets).values(insertData).returning();

      if (!ticket) {
        console.error("[TICKETS-ERROR] Database insert returned no result");
        throw new Error("Database insert failed to return the new ticket");
      }

      console.log("[TICKETS-TRACE] Ticket created successfully:", ticket.id);

      if (attachments && Array.isArray(attachments)) {
        console.log(`[TICKETS-TRACE] Processing ${attachments.length} attachments`);
        const attachmentData = attachments.map((att: any) => ({
          ticketId: ticket.id,
          fileName: att.fileName,
          fileSize: Number(att.fileSize),
          mimeType: att.mimeType,
          storageUrl: att.storageUrl
        }));
        if (attachmentData.length > 0) {
          await db.insert(ticketAttachments).values(attachmentData);
          console.log("[TICKETS-TRACE] Attachments inserted successfully");
        }
      }

      res.status(201).json(ticket);

      // --- SEND EMAIL NOTIFICATION (ASYNC) ---
      (async () => {
        console.log(`[TICKETS-MAIL-TRACE] Starting background email notification for ticket ${ticket.id}`);
        try {
          const detail = await db.select({
            ticketCode: tickets.ticketCode,
            title: tickets.title,
            category: tickets.category,
            priority: tickets.priority,
            status: tickets.status,
            department: tickets.department,
            projectName: projects.title,
            manualProject: tickets.manualProject,
            description: tickets.description,
            createdByName: creator.name,
            assignedToId: tickets.assignedTo,
            assignedToName: assignee.name,
            assignedToEmail: assignee.email,
            participants: tickets.participants,
          })
            .from(tickets)
            .leftJoin(projects, eq(tickets.projectId, projects.id))
            .leftJoin(creator, eq(tickets.createdBy, creator.id))
            .leftJoin(assignee, eq(tickets.assignedTo, assignee.id))
            .where(eq(tickets.id, ticket.id))
            .limit(1);

          if (detail.length > 0) {
            const data = detail[0];
            const recipientSet = new Set<string>();

            // 1. Department Users
            if (data.department) {
              const normalizedDept = data.department.trim().toLowerCase();
              const deptEmployees = await db
                .select({ email: employees.email })
                .from(employees)
                .where(sql`LOWER(TRIM(${employees.department})) = ${normalizedDept}`);
                
              if (deptEmployees.length === 0) {
                console.warn(`[TICKETS-MAIL-WARN] No users found for department: ${data.department}`);
              } else {
                deptEmployees.forEach(emp => {
                  if (emp.email) recipientSet.add(emp.email.trim().toLowerCase());
                });
              }
            }

            // 2. Assignee
            if (data.assignedToEmail) {
              recipientSet.add(data.assignedToEmail.trim().toLowerCase());
            }

            let ccNames = "";
            if (Array.isArray(data.participants) && data.participants.length > 0) {
              const participantEmployees = await db
                .select({ name: employees.name, email: employees.email })
                .from(employees)
                .where(inArray(employees.id, data.participants.map(String)));
              
              const ccNameList: string[] = [];
              participantEmployees.forEach(emp => {
                if (emp.email) {
                  recipientSet.add(emp.email.trim().toLowerCase());
                  if (emp.name) ccNameList.push(emp.name);
                }
              });
              ccNames = ccNameList.join(", ");
            }

            const recipients = Array.from(recipientSet).filter(Boolean);
            console.log(`[TICKETS-MAIL-TRACE] Final Recipient List for ${data.ticketCode}:`, recipients);

            await sendTicketNotificationEmail(recipients, {
              ...data,
              projectName: data.projectName || data.manualProject || "N/A",
              createdByName: data.createdByName || "Unknown",
              assignedToName: data.assignedToName || undefined,
              ccNames: ccNames || undefined
            }, 'created');
            console.log("[TICKETS-MAIL-TRACE] Email process completed");
          } else {
            console.warn(`[TICKETS-MAIL-WARN] No ticket details found for email notification: ${ticket.id}`);
          }
        } catch (mailErr) {
          console.error("[TICKETS-MAIL-ERROR] Creation notification failed:", mailErr);
        }
      })();
    } catch (err: any) {
      console.error("[TICKETS-ERROR] Create ticket failed. Stack trace:", err.stack);
      res.status(500).json({ error: "Failed to create ticket: " + err.message, stack: err.stack });
    }
  });



  // DELETE TICKET
  app.delete("/api/tickets/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;

      // Delete child data
      await db.delete(ticketComments).where(eq(ticketComments.ticketId, id));
      await db.delete(ticketAttachments).where(eq(ticketAttachments.ticketId, id));

      const [deleted] = await db.delete(tickets).where(eq(tickets.id, id)).returning();
      if (!deleted) return res.status(404).json({ error: "Ticket not found" });

      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: "Delete failed" });
    }
  });


  // GET MY TICKETS
  app.get("/api/tickets/my", requireAuth, async (req: any, res) => {
    try {
      const empId = req.employee?.id;
      if (!empId) return res.status(401).json({ error: "Employee info missing" });

      const creator = aliasedTable(employees, "creator");
      const assignee = aliasedTable(employees, "assignee");

      const myTickets = await db
        .select({
          id: tickets.id,
          ticketCode: tickets.ticketCode,
          title: tickets.title,
          category: tickets.category,
          priority: tickets.priority,
          status: tickets.status,
          department: tickets.department,
          projectId: tickets.projectId,
          projectName: projects.title,
          companyName: tickets.companyName,
          participants: tickets.participants,
          createdBy: tickets.createdBy,
          createdByName: creator.name,
          assignedTo: tickets.assignedTo,
          assignedToName: assignee.name,
          createdAt: tickets.createdAt,
          updatedAt: tickets.updatedAt,
          taskId: tickets.taskId,
        })
        .from(tickets)
        .leftJoin(projects, eq(tickets.projectId, projects.id))
        .leftJoin(creator, eq(tickets.createdBy, creator.id))
        .leftJoin(assignee, eq(tickets.assignedTo, assignee.id))
        .where(eq(tickets.createdBy, empId))
        .orderBy(desc(tickets.createdAt));

      res.json(myTickets);
    } catch (err: any) {
      res.status(500).json({ error: "Failed to fetch my tickets" });
    }
  });

  app.get("/api/tickets/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const creator = aliasedTable(employees, "creator");
      const assignee = aliasedTable(employees, "assignee");

      const [ticket] = await db
        .select({
          id: tickets.id,
          ticketCode: tickets.ticketCode,
          title: tickets.title,
          description: tickets.description,
          category: tickets.category,
          priority: tickets.priority,
          status: tickets.status,
          department: tickets.department,
          projectId: tickets.projectId,
          projectName: projects.title,
          companyName: tickets.companyName,
          participants: tickets.participants,
          createdBy: tickets.createdBy,
          createdByName: creator.name,
          assignedTo: tickets.assignedTo,
          assignedToName: assignee.name,
          createdAt: tickets.createdAt,
          updatedAt: tickets.updatedAt,
          taskId: tickets.taskId,
        })
        .from(tickets)
        .leftJoin(projects, eq(tickets.projectId, projects.id))
        .leftJoin(creator, eq(tickets.createdBy, creator.id))
        .leftJoin(assignee, eq(tickets.assignedTo, assignee.id))
        .where(eq(tickets.id, id))
        .limit(1);

      if (!ticket) return res.status(404).json({ error: "Ticket not found" });

      const comments = await db
        .select({
          id: ticketComments.id,
          content: ticketComments.content,
          createdAt: ticketComments.createdAt,
          createdBy: ticketComments.createdBy,
          createdByName: employees.name,
        })
        .from(ticketComments)
        .leftJoin(employees, eq(ticketComments.createdBy, employees.id))
        .where(eq(ticketComments.ticketId, id))
        .orderBy(ticketComments.createdAt);

      const attachments = await db
        .select()
        .from(ticketAttachments)
        .where(eq(ticketAttachments.ticketId, id));

      res.json({ ...ticket, comments, attachments });
    } catch (err: any) {
      console.error("[TICKETS-ERROR] Get ticket details failed:", err);
      res.status(500).json({ error: "Failed to get ticket details" });
    }
  });

  app.post("/api/tickets/:id/comments", requireAuth, async (req: any, res) => {
    try {
      const { content } = req.body;
      const empId = req.employee?.id;
      if (!empId) return res.status(403).json({ error: "Employee profile required" });

      const [comment] = await db.insert(ticketComments).values({
        ticketId: req.params.id,
        content,
        createdBy: empId,
      }).returning();

      await db.update(tickets).set({ updatedAt: new Date() }).where(eq(tickets.id, req.params.id));
      res.status(201).json(comment);
    } catch (err) {
      console.error("[TICKETS-ERROR] Add ticket comment failed:", err);
      res.status(500).json({ error: "Failed to add comment" });
    }
  });

  app.patch("/api/tickets/:id", requireAuth, async (req: any, res) => {
    try {
      const { 
        status, 
        priority, 
        assignedTo, 
        title, 
        description, 
        category, 
        department,
        companyName,
        participants
      } = req.body;
      const isAdmin = req.user?.role === "ADMIN";

      const [currentTicket] = await db.select().from(tickets).where(eq(tickets.id, req.params.id)).limit(1);
      if (!currentTicket) return res.status(404).json({ error: "Ticket not found" });

      if (!isAdmin && currentTicket.createdBy !== req.employee?.id && currentTicket.assignedTo !== req.employee?.id) {
        return res.status(403).json({ error: "Permission denied" });
      }

      const updateData: any = { updatedAt: new Date() };
      if (status !== undefined) updateData.status = status;
      if (priority !== undefined) updateData.priority = priority;
      if (assignedTo !== undefined) updateData.assignedTo = assignedTo;
      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (category !== undefined) updateData.category = category;
      if (department !== undefined) updateData.department = department;
      if (companyName !== undefined) updateData.companyName = companyName;
      if (participants !== undefined) updateData.participants = participants;
      if (req.body.taskId !== undefined) updateData.taskId = req.body.taskId;
      if (req.body.projectId !== undefined) updateData.projectId = req.body.projectId;

      if (status === "Resolved" || status === "Closed") {
        updateData.resolvedAt = new Date();
      }

      const [updatedTicket] = await db
        .update(tickets)
        .set(updateData)
        .where(eq(tickets.id, req.params.id))
        .returning();

      res.json(updatedTicket);

      // ASYNC EMAIL NOTIFICATION
      try {
        const ticketDetail = await db.select({
          ticketCode: tickets.ticketCode,
          title: tickets.title,
          category: tickets.category,
          priority: tickets.priority,
          status: tickets.status,
          department: tickets.department,
          projectName: projects.title,
          manualProject: tickets.manualProject,
          description: tickets.description,
          createdByName: creator.name,
          assignedToId: tickets.assignedTo,
          assignedToName: assignee.name,
          assignedToEmail: assignee.email,
          participants: tickets.participants,
        })
          .from(tickets)
          .leftJoin(projects, eq(tickets.projectId, projects.id))
          .leftJoin(creator, eq(tickets.createdBy, creator.id))
          .leftJoin(assignee, eq(tickets.assignedTo, assignee.id))
          .where(eq(tickets.id, updatedTicket.id))
          .limit(1);

        if (ticketDetail.length > 0) {
          const t = ticketDetail[0];
          const isDone = t.status === "Resolved" || t.status === "Closed";
          const recipientSet = new Set<string>();

          // 1. Department Users
          if (t.department) {
            const normalizedDept = t.department.trim().toLowerCase();
            const deptEmployees = await db
              .select({ email: employees.email })
              .from(employees)
              .where(sql`LOWER(TRIM(${employees.department})) = ${normalizedDept}`);
              
            if (deptEmployees.length === 0) {
              console.warn(`[TICKETS-UPDATE-MAIL-WARN] No users found for department: ${t.department}`);
            } else {
              deptEmployees.forEach(emp => {
                if (emp.email) recipientSet.add(emp.email.trim().toLowerCase());
              });
            }
          }

          // 2. Assignee
          if (t.assignedToEmail) {
            recipientSet.add(t.assignedToEmail.trim().toLowerCase());
          }

          let ccNames = "";
          if (Array.isArray(t.participants) && t.participants.length > 0) {
            const participantEmployees = await db
              .select({ name: employees.name, email: employees.email })
              .from(employees)
              .where(inArray(employees.id, t.participants.map(String)));
            
            const ccNameList: string[] = [];
            participantEmployees.forEach(emp => {
              if (emp.email) {
                recipientSet.add(emp.email.trim().toLowerCase());
                if (emp.name) ccNameList.push(emp.name);
              }
            });
            ccNames = ccNameList.join(", ");
          }

          const recipients = Array.from(recipientSet).filter(Boolean);
          console.log(`[TICKETS-UPDATE-MAIL-TRACE] Final Recipient List for ${t.ticketCode}:`, recipients);

          sendTicketNotificationEmail(recipients, {
            ...t,
            projectName: t.projectName || t.manualProject || "N/A",
            createdByName: t.createdByName || "Unknown",
            assignedToName: t.assignedToName || undefined,
            ccNames: ccNames || undefined
          }, isDone ? 'completed' : 'updated').catch(e => console.error(e));
        }
      } catch (logErr) {
        console.error("[TICKETS-LOG-ERROR] Mail prep failed:", logErr);
      }
    } catch (err) {
      console.error("[TICKETS-ERROR] Update ticket failed:", err);
      res.status(500).json({ error: "Failed to update ticket" });
    }
  });
  app.delete("/api/tickets/:id", requireAuth, async (req: any, res) => {
    try {
      const isAdmin = req.user?.role === "ADMIN";
      const [ticket] = await db.select().from(tickets).where(eq(tickets.id, req.params.id)).limit(1);

      if (!ticket) return res.status(404).json({ error: "Ticket not found" });
      if (!isAdmin && ticket.createdBy !== req.employee?.id) {
        return res.status(403).json({ error: "Permission denied" });
      }

      await db.delete(tickets).where(eq(tickets.id, req.params.id));
      res.json({ message: "Ticket deleted successfully" });
    } catch (err) {
      console.error("[TICKETS-ERROR] Delete ticket failed:", err);
      res.status(500).json({ error: "Failed to delete ticket" });
    }
  });

  app.get("/api/tickets/export", requireAuth, async (_req: any, res) => {
    try {
      const rows = await db
        .select({
          ticketCode: tickets.ticketCode,
          title: tickets.title,
          category: tickets.category,
          priority: tickets.priority,
          status: tickets.status,
          department: tickets.department,
          createdByName: employees.name,
          createdAt: tickets.createdAt,
        })
        .from(tickets)
        .leftJoin(employees, eq(tickets.createdBy, employees.id))
        .orderBy(desc(tickets.createdAt));

      let csv = "Ticket ID,Title,Category,Priority,Status,Department,Created By,Created Date\n";
      rows.forEach(r => {
        csv += `"${r.ticketCode}","${r.title}","${r.category}","${r.priority}","${r.status}","${r.department}","${r.createdByName}","${r.createdAt?.toISOString()}"\n`;
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=tickets.csv");
      res.status(200).send(csv);
    } catch (err) {
      res.status(500).json({ error: "Export failed" });
    }
  });

  /* ===============================
     SITE ENGINEER REPORTS
  ================================ */

  // GET all site reports
  app.get("/api/site-reports", requireAuth, async (req: any, res) => {
    try {
      const { projectId } = req.query;

      const rows = await db
        .select({
          id: siteReports.id,
          notes: siteReports.notes,
          clientEmail: siteReports.clientEmail,
          createdAt: siteReports.createdAt,
          projectId: siteReports.projectId,
          projectName: projects.title,
          engineerName: employees.name,
          taskId: siteReports.taskId,
          taskName: projectTasks.taskName,
          subtaskId: siteReports.subtaskId,
          subtaskName: subtasks.title,
        })
        .from(siteReports)
        .leftJoin(projects, eq(siteReports.projectId, projects.id))
        .leftJoin(employees, eq(siteReports.createdBy, employees.id))
        .leftJoin(projectTasks, eq(siteReports.taskId, projectTasks.id))
        .leftJoin(subtasks, eq(siteReports.subtaskId, subtasks.id))
        .where(projectId ? eq(siteReports.projectId, projectId as string) : sql`TRUE`)
        .orderBy(desc(siteReports.createdAt))
        .limit(50);

      // Fetch attachments for each report
      const reportsWithAttachments = await Promise.all(
        rows.map(async (report) => {
          const attachments = await db
            .select()
            .from(siteReportAttachments)
            .where(eq(siteReportAttachments.reportId, report.id));
          return { ...report, attachments };
        })
      );

      res.json(reportsWithAttachments);
    } catch (err) {
      console.error("Fetch site reports failed:", err);
      res.status(500).json({ error: "Failed to fetch reports" });
    }
  });

  // POST upload files for site report
  app.post("/api/site-reports/upload", requireAuth, upload.array("files"), async (req: any, res) => {
    try {
      const files = (req.files as any[]) || [];
      const uploadedFiles = files.map(file => ({
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        storageUrl: `/uploads/${file.filename}`,
        serverPath: file.path
      }));

      res.json(uploadedFiles);
    } catch (err) {
      console.error("Site report upload failed:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  // POST create site report and send email
  app.post("/api/site-reports", requireAuth, async (req: any, res) => {
    try {
      const {
        projectId,
        taskId,
        subtaskId,
        notes,
        clientEmail,
        attachments,
        sendEmail
      } = req.body;

      const empId = req.employee?.id;
      if (!empId) return res.status(403).json({ error: "Employee profile required" });

      // 1. Save report to DB
      const [report] = await db.insert(siteReports).values({
        projectId,
        taskId: taskId || null,
        subtaskId: subtaskId || null,
        notes,
        createdBy: empId,
        clientEmail: clientEmail || null
      }).returning();

      // 2. Save attachments
      if (attachments && Array.isArray(attachments)) {
        const attachmentData = attachments.map(att => ({
          reportId: report.id,
          fileName: att.fileName,
          fileSize: att.fileSize,
          mimeType: att.mimeType,
          storageUrl: att.storageUrl
        }));
        if (attachmentData.length > 0) {
          await db.insert(siteReportAttachments).values(attachmentData);
        }
      }

      // 3. Send Email if requested
      if (sendEmail && clientEmail) {
        // Fetch names for email
        const project = await storageHelper.getProject(projectId);
        const task = taskId ? (await db.select().from(projectTasks).where(eq(projectTasks.id, taskId)))[0] : null;
        const subtask = subtaskId ? (await db.select().from(subtasks).where(eq(subtasks.id, subtaskId)))[0] : null;
        const engineer = req.employee;

        // Prepare attachments for Resend
        const emailAttachments = attachments?.map((att: any) => {
          // Extract filename from URL/path
          const fileNameOnDisk = path.basename(att.storageUrl);
          const filePath = path.join(process.cwd(), "uploads", fileNameOnDisk);

          if (fs.existsSync(filePath)) {
            return {
              filename: att.fileName,
              content: fs.readFileSync(filePath)
            };
          }
          return null;
        }).filter(Boolean) || [];

        await sendSiteReportEmail(
          clientEmail,
          {
            projectName: project?.title || "N/A",
            taskName: task?.taskName || "N/A",
            subtaskName: subtask?.title || "N/A",
            notes: notes || "",
            engineerName: engineer?.name || "Site Engineer"
          },
          emailAttachments as any
        );
      }

      res.status(201).json(report);
    } catch (err) {
      console.error("Create site report failed:", err);
      res.status(500).json({ error: "Failed to create site report" });
    }
  });


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
      const [u] = await db.select().from(users).where(eq(users.id, sess.userId)).limit(1);
      if (u) user = u;
    }

    if (sess.employeeId) {
      const empRows = await pool.query('SELECT id, emp_code as "empCode", name, designation, department, email, phone FROM employees WHERE id = $1 LIMIT 1', [sess.employeeId]);
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

  // Save filter settings for the logged-in user
  app.patch("/api/users/filter-settings", requireAuth, async (req: any, res) => {
    try {
      const { settings } = req.body;
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      if (settings === undefined) return res.json({ success: true, message: "No settings provided" });

      await db.update(users).set({ filterSettings: settings }).where(eq(users.id, userId));
      res.json({ success: true });
    } catch (err) {
      console.error("Failed to save filter settings:", err);
      res.status(500).json({ error: "Failed to save filter settings" });
    }
  });

  /* ===============================
      EMAIL GROUPS
  ================================ */
  app.get("/api/email-groups", requireAuth, async (req: any, res) => {
    try {
      if (!req.employee?.id) return res.status(403).json({ error: "Employee profile required" });
      const rows = await db
        .select()
        .from(emailGroups)
        .where(eq(emailGroups.createdBy, req.employee.id))
        .orderBy(desc(emailGroups.createdAt));
      res.json(rows);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch email groups" });
    }
  });

  app.post("/api/email-groups", requireAuth, async (req: any, res) => {
    try {
      const { name, emails } = req.body;
      if (!name || !emails) return res.status(400).json({ error: "Name and emails are required" });
      if (!req.employee?.id) return res.status(403).json({ error: "Employee profile required" });

      const [group] = await db.insert(emailGroups).values({
        name,
        emails, // emails is a string (comma separated)
        createdBy: req.employee.id
      }).returning();
      res.status(201).json(group);
    } catch (err) {
      console.error("Create email group failure:", err);
      res.status(500).json({ error: "Failed to create email group" });
    }
  });

  app.delete("/api/email-groups/:id", requireAuth, async (req, res) => {
    try {
      await db.delete(emailGroups).where(eq(emailGroups.id, req.params.id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete email group" });
    }
  });

  /* ===============================
     PERCENTAGE CALCULATION HELPER
  ================================ */
  async function updateParentProgress(type: 'subtask' | 'task' | 'keystep', id: string, userId?: string) {
    console.log(`[PROGRESS] Updating parent progress for ${type} ${id}`);
    try {
      if (type === 'subtask') {
        const [subtask] = await db.select().from(subtasks).where(eq(subtasks.id, id));
        if (!subtask) return;

        const taskId = subtask.taskId;
        const allSubtasks = await db.select().from(subtasks).where(eq(subtasks.taskId, taskId));

        if (allSubtasks.length > 0) {
          const avgProgress = Math.round(allSubtasks.reduce((sum, s) => sum + (s.progress || 0), 0) / allSubtasks.length);
          const taskUpdate: any = { progress: avgProgress, updatedAt: new Date() };

          const [currentTask] = await db.select().from(projectTasks).where(eq(projectTasks.id, taskId));

          if (avgProgress === 100) {
            if (currentTask?.status !== "Completed") {
              taskUpdate.status = "Completed";
              taskUpdate.completedAt = new Date();
            }
          } else {
            // If progress dropped from 100, move status back to In Progress
            if (currentTask?.status === "Completed") {
              taskUpdate.status = "In Progress";
              taskUpdate.completedAt = null;
            } else if (avgProgress > 0 && (currentTask?.status === "Planned" || currentTask?.status === "Not Started")) {
              taskUpdate.status = "In Progress";
            }
          }

          await db.update(projectTasks).set(taskUpdate).where(eq(projectTasks.id, taskId));
          await db.insert(progressLogs).values({ taskId, percentage: avgProgress, updatedAt: new Date(), updatedBy: userId });
          console.log(`[PROGRESS] Task ${taskId} updated to ${avgProgress}% (Status: ${taskUpdate.status || currentTask?.status})`);
          await updateParentProgress('task', taskId, userId);
        }
      } else if (type === 'task') {
        const [task] = await db.select().from(projectTasks).where(eq(projectTasks.id, id));
        if (!task || !task.keyStepId) return;

        const keyStepId = task.keyStepId;
        const allTasks = await db.select().from(projectTasks).where(eq(projectTasks.keyStepId, keyStepId));

        if (allTasks.length > 0) {
          const avgProgress = Math.round(allTasks.reduce((sum, t) => sum + (t.progress || 0), 0) / allTasks.length);
          const ksUpdate: any = { progress: avgProgress };

          const [currentKs] = await db.select().from(keySteps).where(eq(keySteps.id, keyStepId));

          if (avgProgress === 100) {
            if (currentKs?.status !== "completed") {
              ksUpdate.status = "completed";
              ksUpdate.completedAt = new Date();
            }
          } else {
            if (currentKs?.status === "completed") {
              ksUpdate.status = "in-progress";
              ksUpdate.completedAt = null;
            }
          }
          await db.update(keySteps).set(ksUpdate).where(eq(keySteps.id, keyStepId));
          await db.insert(progressLogs).values({ keyStepId, percentage: avgProgress, updatedAt: new Date(), updatedBy: userId });
          console.log(`[PROGRESS] KeyStep ${keyStepId} updated to ${avgProgress}%`);
          await updateParentProgress('keystep', keyStepId, userId);
        }
      } else if (type === 'keystep') {
        const [ks] = await db.select().from(keySteps).where(eq(keySteps.id, id));
        if (!ks) return;

        const projectId = ks.projectId;
        if (ks.parentKeyStepId) {
          const allChildren = await db.select().from(keySteps).where(eq(keySteps.parentKeyStepId, ks.parentKeyStepId));
          if (allChildren.length > 0) {
            const avgProgress = Math.round(allChildren.reduce((sum, k) => sum + (k.progress || 0), 0) / allChildren.length);
            const parentKsUpdate: any = { progress: avgProgress };
            const [currentParentKs] = await db.select().from(keySteps).where(eq(keySteps.id, ks.parentKeyStepId));
            if (avgProgress === 100) {
              if (currentParentKs?.status !== "completed") {
                parentKsUpdate.status = "completed";
                parentKsUpdate.completedAt = new Date();
              }
            } else {
              if (currentParentKs?.status === "completed") {
                parentKsUpdate.status = "in-progress";
                parentKsUpdate.completedAt = null;
              }
            }
            await db.update(keySteps).set(parentKsUpdate).where(eq(keySteps.id, ks.parentKeyStepId));
            await db.insert(progressLogs).values({ keyStepId: ks.parentKeyStepId, percentage: avgProgress, updatedAt: new Date(), updatedBy: userId });
            console.log(`[PROGRESS] Parent KeyStep ${ks.parentKeyStepId} updated to ${avgProgress}%`);
            await updateParentProgress('keystep', ks.parentKeyStepId, userId);
          }
        } else {
          const allRootSteps = await db.select().from(keySteps).where(and(eq(keySteps.projectId, projectId), sql`${keySteps.parentKeyStepId} IS NULL OR ${keySteps.parentKeyStepId} = ''`));
          if (allRootSteps.length > 0) {
            const avgProgress = Math.round(allRootSteps.reduce((sum, k) => sum + (k.progress || 0), 0) / allRootSteps.length);
            const updateData: any = { progress: avgProgress, updatedAt: new Date() };

            const [oldProject] = await db.select().from(projects).where(eq(projects.id, projectId));
            if (avgProgress === 100) {
              if (oldProject?.status !== "Completed") {
                updateData.status = "Completed";
                updateData.completedAt = new Date();
                console.log(`[PROGRESS] Project ${projectId} reached 100% and is now Completed.`);

                await db.update(projects).set(updateData).where(eq(projects.id, projectId));
                await notifyAdminsOfCompletion(projectId);
              } else {
                await db.update(projects).set(updateData).where(eq(projects.id, projectId));
              }
            } else {
              if (oldProject?.status === "Completed") {
                updateData.status = "In Progress";
                updateData.completedAt = null;
              }
              await db.update(projects).set(updateData).where(eq(projects.id, projectId));
            }
            await db.insert(progressLogs).values({ projectId, percentage: avgProgress, updatedAt: new Date(), updatedBy: userId });
            console.log(`[PROGRESS] Project ${projectId} updated to ${avgProgress}%`);
          }
        }
      }
    } catch (err) {
      console.error("[PROGRESS] Update error:", err);
    }
  }

  async function notifyAdminsOfCompletion(projectId: string) {
    console.log(`[NOTIFY] Dispatching completion alerts for project ${projectId}`);
    try {
      const [project] = await db.select().from(projects).where(eq(projects.id, projectId));
      if (!project) return;

      const adminEmails = await storageHelper.getAdminEmails();
      if (adminEmails.length === 0) return;

      let originalAssignerName = "System Administrator";
      if (project.createdByEmployeeId) {
        const creator = await storageHelper.getEmployee(project.createdByEmployeeId);
        if (creator) originalAssignerName = creator.name;
      }

      let firstMemberName = "Team Member";
      let firstMemberCode = "N/A";

      const dbTeamMembers = await db
        .select({ name: employees.name, code: employees.empCode })
        .from(projectTeamMembers)
        .innerJoin(employees, eq(projectTeamMembers.employeeId, employees.id))
        .where(eq(projectTeamMembers.projectId, projectId))
        .limit(1);

      if (dbTeamMembers.length > 0) {
        firstMemberName = dbTeamMembers[0].name;
        firstMemberCode = dbTeamMembers[0].code || "N/A";
      }

      for (const adminEmail of adminEmails) {
        await sendProjectCompletionEmail(adminEmail, {
          title: project.title,
          projectCode: project.projectCode,
          clientName: project.clientName || 'N/A',
          startDate: project.startDate ? new Date(project.startDate).toLocaleDateString() : 'N/A',
          endDate: project.endDate ? new Date(project.endDate).toLocaleDateString() : 'N/A',
          progress: project.progress,
          assigner: originalAssignerName,
          employeeName: firstMemberName,
          employeeCode: firstMemberCode
        });
      }
    } catch (err) {
      console.warn("[ADMIN NOTIFY] Failed to dispatch project completion alerts:", err);
    }
  }
  /* ===============================
      EMPLOYEES
  ================================ */
  app.get("/api/employees", async (req, res) => {
    try {
      const { department } = req.query;
      let conditions = [];
      if (department) {
        conditions.push(eq(employees.department, department as string));
      }

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
        .where(conditions.length > 0 ? and(...conditions) : sql`TRUE`)
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
      const empRes = await pool.query('SELECT id, emp_code as "empCode", name, designation, department, email, phone FROM employees WHERE emp_code = $1 LIMIT 1', [employeeCode]);
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

      res.json({ token, user: { id: user.id, username: user.username, role: user.role, employeeId: employee.id, empCode: employee.empCode, name: employee.name, department: employee.department, designation: employee.designation, email: employee.email } });
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
      const u = req.user || {};
      const e = req.employee || {};

      const mergedUser = {
        ...u,
        employeeId: e.id,
        empCode: e.empCode,
        name: e.name,
        email: e.email,
        phone: e.phone,
        designation: e.designation,
        department: e.department
      };

      res.json({ user: mergedUser });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch profile" });
    }
  });

  // Health check to verify latest code is live
  app.get("/api/health-check", (_req, res) => {
    res.json({ status: "ok", version: "1.0.1", timestamp: new Date().toISOString() });
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
      const isAdmin = req.user?.role === "ADMIN" || req.employee?.empCode === "E0001";

      let projectRows: any[] = [];
      let departments: any[] = [];
      let teamMembers: any[] = [];
      let vendors: any[] = [];

      // DEBUG: inspect `projects` export before querying
      console.log('[DEBUG] projects object keys:', Object.keys(projects || {}));
      console.log('[DEBUG] projects.createdAt present:', !!projects?.createdAt);

      // (Raw SQL fallback removed)


      // Load projects using Drizzle where possible
      let allProjects: any[] = [];
      const filterStatus = req.query.status ? String(req.query.status) : "active";

      try {
        let query = db.select().from(projects);
        if (filterStatus === "active") {
          allProjects = await query.where(sql`LOWER(${projects.status}) != 'completed'`);
        } else if (filterStatus === "Completed") {
          allProjects = await query.where(sql`LOWER(${projects.status}) = 'completed'`);
        } else {
          allProjects = await query;
        }
      } catch (drizzleErr: any) {
        console.warn('[WARN] /api/projects - Drizzle select failed, falling back to minimal raw select', drizzleErr && (drizzleErr.message || drizzleErr));
        let fallbackRows: any[] = [];

        const statusCondition = filterStatus === "Completed"
          ? `WHERE LOWER(status) = 'completed'`
          : filterStatus === "all"
            ? ``
            : `WHERE LOWER(status) != 'completed'`;

        try {
          const columnInfo = await pool.query(
            `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'hold_reason' LIMIT 1`
          );
          const hasHoldReason = (columnInfo.rows || []).length > 0;
          const fallbackQuery = `SELECT id, title, project_code AS "projectCode", description, client_name AS "clientName", status, ${hasHoldReason ? 'hold_reason AS "holdReason",' : ''} progress, start_date AS "startDate", end_date AS "endDate", created_by_employee_id AS "createdByEmployeeId", created_at AS "createdAt" FROM projects ${statusCondition} ORDER BY created_at DESC`;

          const fallback = await pool.query(fallbackQuery);
          fallbackRows = fallback.rows || [];
        } catch (fallbackErr) {
          const fallbackErrMessage = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
          console.warn('[WARN] /api/projects - raw fallback failed, returning minimal project rows', fallbackErrMessage);
          const fallback2 = await pool.query(
            `SELECT id, title, project_code AS "projectCode", description, client_name AS "clientName", status, progress, start_date AS "startDate", end_date AS "endDate", created_by_employee_id AS "createdByEmployeeId", created_at AS "createdAt" FROM projects ${statusCondition} ORDER BY created_at DESC`
          );
          fallbackRows = fallback2.rows || [];
        }

        allProjects = (fallbackRows || []).map((r: any) => ({
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
          createdByEmployeeId: r.createdByEmployeeId || null,
          holdReason: r.holdReason || null,
        }));
      }

      const allProjectIds = allProjects.map((p) => p.id);
      console.log('[DEBUG] /api/projects - allProjectIds sample =', allProjectIds.slice(0, 10));

      // Fetch all related data in parallel - ONCE
      const [deptResults, teamResults, vendorResults, membershipResults, taskMembershipProjectIds] = await Promise.all([
        db.select().from(projectDepartments).where(inArray(projectDepartments.projectId, allProjectIds)),
        db.select().from(projectTeamMembers).where(inArray(projectTeamMembers.projectId, allProjectIds)),
        db.select().from(projectVendors).where(inArray(projectVendors.projectId, allProjectIds)),
        !isAdmin ? db.select({ projectId: projectTeamMembers.projectId }).from(projectTeamMembers).where(eq(projectTeamMembers.employeeId, requestingEmployeeId)) : Promise.resolve([]),
        !isAdmin ? db.select({ projectId: projectTasks.projectId })
          .from(projectTasks)
          .leftJoin(taskMembers, eq(projectTasks.id, taskMembers.taskId))
          .leftJoin(subtasks, eq(projectTasks.id, subtasks.taskId))
          .leftJoin(subtaskMembers, eq(subtasks.id, subtaskMembers.subtaskId))
          .where(or(
            eq(taskMembers.employeeId, requestingEmployeeId),
            eq(subtasks.assignedTo, requestingEmployeeId),
            eq(subtaskMembers.employeeId, requestingEmployeeId),
            eq(projectTasks.assignerId, requestingEmployeeId)
          )) : Promise.resolve([]),
      ]);

      console.log('[DEBUG] /api/projects - dept/team/vendor/membership/taskMembership lengths =',
        Array.isArray(deptResults) ? deptResults.length : typeof deptResults,
        Array.isArray(teamResults) ? teamResults.length : typeof teamResults,
        Array.isArray(vendorResults) ? vendorResults.length : typeof vendorResults,
        Array.isArray(membershipResults) ? membershipResults.length : typeof membershipResults,
        Array.isArray(taskMembershipProjectIds) ? taskMembershipProjectIds.length : typeof taskMembershipProjectIds
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
        const taskProjIds = new Set((taskMembershipProjectIds as any[]).map((m) => String(m.projectId)));

        projectRows = allProjects.filter((p) => {
          const pid = String(p.id);
          const isTeamMember = teamProjectIds.has(pid);
          const hasAssignedTask = taskProjIds.has(pid);

          // Department-based visibility
          const projectDepts = departmentMap.get(pid) || [];
          const isDeptMatch = projectDepts.some((d: string) => normalizeDept(d) === reqDeptNorm);

          // Also allow the creator to see it (safety fallback)
          const isCreator = p.createdByEmployeeId === requestingEmployeeId;

          const baseMatch = Boolean(isTeamMember || isCreator || isDeptMatch || hasAssignedTask);

          // SPECIAL RESTRICTION for E0046, E0048: Only show software developer projects
          const currentEmpCode = req.employee?.empCode;
          if (currentEmpCode === "E0046" || currentEmpCode === "E0048") {
            const normalizedSoftwareDept = normalizeDept("software developer");
            const normalizedProjectDepts = projectDepts.map((d: string) => normalizeDept(d));
            const isSoftwareProject = normalizedProjectDepts.includes(normalizedSoftwareDept);

            console.log(`[ACL] Project "${p.title}" for ${currentEmpCode}: isSoftware=${isSoftwareProject}, baseMatch=${baseMatch} (isTeam=${isTeamMember}, isCreator=${isCreator}, isDeptMatch=${isDeptMatch}, hasTask=${hasAssignedTask})`);

            return isSoftwareProject;
          }

          if (baseMatch) {
            // console.log(`[ACL] Project "${p.title}" visible for ${req.employee?.name} (isDeptMatch=${isDeptMatch})`);
          }

          return baseMatch;
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
      } catch (mapErr: any) {
        console.error('[ERROR] /api/projects - mapping failed', mapErr && (mapErr.stack || mapErr));
        // fallback: send minimal projects so UI shows something
        const fallback = (projectRows || []).map((p: any) => ({ id: p?.id ?? null, title: p?.title ?? 'Unknown', department: [], team: [], vendors: [] }));
        return res.json(fallback);
      }
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Projects fetch error:", errorMessage, err && (err.stack || err));
      res.status(500).json({ error: "Failed to fetch projects", details: errorMessage });
    }
  });

  // GET PROJECTS FOR DROPDOWNS (Lightweight with search/pagination)
  app.get("/api/projects/dropdown", requireAuth, async (req: any, res) => {
    try {
      const { search, limit = 50, offset = 0 } = req.query;
      let conditions = [];
      if (search) {
        conditions.push(sql`${projects.title} ILIKE ${'%' + search + '%'}`);
      }

      const rows = await db
        .select({
          id: projects.id,
          title: projects.title,
        })
        .from(projects)
        .where(conditions.length > 0 ? and(...conditions) : sql`TRUE`)
        .limit(Number(limit))
        .offset(Number(offset))
        .orderBy(desc(projects.createdAt));

      res.json(rows);
    } catch (err) {
      console.error("Projects dropdown fetch error:", err);
      res.status(500).json([]);
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
        holdReason,
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
          holdReason: holdReason?.trim() || null,
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
        holdReason: holdReason?.trim() || null,
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
        holdReason,
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
        holdReason: holdReason?.trim() || null,
        status: status || "Planned",
        // Force progress to 100% when status is Completed
        progress: status === "Completed" ? 100 : Math.min(100, Math.max(0, Number(progress) || 0)),
        updatedAt: new Date(),
        startDate: formatDate(startDate),
        endDate: formatDate(endDate),
      };

      // Set completedAt when status is moved to Completed
      if (status === "Completed") {
        updateData.completedAt = oldProject?.status !== "Completed" ? new Date() : oldProject?.completedAt || new Date();
      } else {
        updateData.completedAt = null;
      }

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
        await notifyAdminsOfCompletion(id);
      }

      const result = {
        ...updated,
        department: department || [],
        team: team || [],
        vendors: vendorList || [],
        holdReason: holdReason?.trim() || null,
      };

      console.log("✅ Project updated successfully:", id);
      res.json(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("❌ Project update failed:", errorMessage);
      res.status(500).json({ error: "Failed to update project", details: errorMessage });
    }
  });

  // PATCH PROJECT (partial update)
  app.patch("/api/projects/:id", requireAuth, async (req: any, res) => {
    const { id } = req.params;
    try {
      const data = req.body;
      const updateData: any = { updatedAt: new Date() };
      let oldProject: any = null;

      if (data.status === "On Hold" && (typeof data.holdReason === 'undefined' || !String(data.holdReason || '').trim())) {
        [oldProject] = await db.select({ status: projects.status, holdReason: projects.holdReason }).from(projects).where(eq(projects.id, id));
      }

      if (typeof data.title !== 'undefined') updateData.title = data.title;

      let wasAlreadyCompleted = false;
      if (typeof data.status !== 'undefined') {
        updateData.status = data.status;
        if (data.status === "On Hold") {
          const reason = typeof data.holdReason !== 'undefined'
            ? String(data.holdReason).trim()
            : oldProject?.holdReason;
          if (!reason) {
            return res.status(400).json({ error: 'Hold reason is required when setting project to On Hold' });
          }
          updateData.holdReason = reason;
        } else if (typeof data.holdReason !== 'undefined') {
          updateData.holdReason = data.holdReason;
        }

        if (data.status === "Completed") {
          updateData.progress = 100;
          // Fetch current state to check if it was already completed
          const [currentProject] = await db.select({ status: projects.status, completedAt: projects.completedAt }).from(projects).where(eq(projects.id, id));
          wasAlreadyCompleted = currentProject?.status === "Completed";
          updateData.completedAt = wasAlreadyCompleted ? (currentProject?.completedAt || new Date()) : new Date();
        } else {
          updateData.completedAt = null;
        }
      }
      if (typeof data.progress !== 'undefined') {
        // Only allow manual progress update if status is not Completed
        if (updateData.status !== "Completed" && data.status !== "Completed") {
          updateData.progress = data.progress;
        }
      }
      if (typeof data.description !== 'undefined') updateData.description = data.description;
      if (typeof data.startDate !== 'undefined') updateData.startDate = data.startDate;
      if (typeof data.endDate !== 'undefined') updateData.endDate = data.endDate;
      if (typeof data.clientName !== 'undefined') updateData.clientName = data.clientName;
      if (typeof data.company !== 'undefined') updateData.company = data.company;
      if (typeof data.holdReason !== 'undefined' && typeof data.status === 'undefined') updateData.holdReason = data.holdReason;

      if (Object.keys(updateData).length > 1) {
        await db.update(projects).set(updateData).where(eq(projects.id, id));
      }

      // Trigger admin notification if this is a fresh completion
      if (data.status === "Completed" && !wasAlreadyCompleted) {
        await notifyAdminsOfCompletion(id);
      }

      // Cascading reopen logic
      const isReopening = (data.status && data.status !== "Completed" && data.status !== "completed") ||
        (typeof data.progress !== 'undefined' && data.progress < 100);

      if (isReopening) {
        console.log(`[Project Reopen] Reopening all related items for project: ${id}`);
        // 1. Reopen all Key Steps
        await db.update(keySteps).set({ status: 'in-progress', progress: 0 }).where(eq(keySteps.projectId, id));

        // 2. Reopen all Tasks
        await db.update(projectTasks).set({ status: 'pending', progress: 0 }).where(eq(projectTasks.projectId, id));

        // 3. Reopen all Subtasks
        const taskRows = await db.select({ id: projectTasks.id }).from(projectTasks).where(eq(projectTasks.projectId, id));
        if (taskRows.length > 0) {
          const tIds = taskRows.map(tr => tr.id);
          await db.update(subtasks).set({ isCompleted: false, progress: 0 }).where(inArray(subtasks.taskId, tIds));
        }
      }

      if (typeof data.department !== 'undefined') {
        await db.delete(projectDepartments).where(eq(projectDepartments.projectId, id));
        const departments = Array.isArray(data.department) ? data.department : [];
        if (departments.length > 0) {
          await db.insert(projectDepartments).values(
            departments.filter((d: any) => d?.trim()).map((dept: string) => ({
              projectId: id,
              department: normalizeDept(dept),
            }))
          );
        }
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error("Project patch failed:", err);
      res.status(500).json({ error: "Failed to update project" });
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
      PROJECT MEMBERS
  ================================ */
  app.get("/api/projects/:projectId/members", requireAuth, async (req, res) => {
    try {
      const { projectId } = req.params;
      const members = await db
        .select({
          id: employees.id,
          name: employees.name,
          department: employees.department,
          empCode: employees.empCode,
          email: employees.email
        })
        .from(projectTeamMembers)
        .innerJoin(employees, eq(projectTeamMembers.employeeId, employees.id))
        .where(eq(projectTeamMembers.projectId, projectId));

      res.json(members);
    } catch (err) {
      console.error("Failed to fetch project members:", err);
      res.status(500).json({ error: "Failed to fetch project members" });
    }
  });

  /* ===============================
      PROJECT TIME TRACKING (from Timestrap DB)
  ================================ */
  app.get("/api/projects/:projectId/time-entries", requireAuth, async (req: any, res) => {
    try {
      const { projectId } = req.params;

      // Fetch project details to get project name
      const [project] = await db
        .select({ id: projects.id, title: projects.title })
        .from(projects)
        .where(eq(projects.id, projectId));

      if (!project) {
        return res.status(404).json({ error: "Project not found" });
      }

      console.log(`[Time Entries] Fetching for project: ${project.title} (ID: ${projectId})`);

      // Fetch time entries from timestrap database
      const timeEntriesResult = await getProjectTimeEntries(project.title);

      console.log(`[Time Entries] Retrieved ${timeEntriesResult.entries.length} entries for project: ${project.title}`);

      // Filter out entries with 0 hours or return empty array if no entries
      const validEntries = timeEntriesResult.entries.filter((e: any) => e.hoursSpent > 0);

      res.json({
        projectId,
        projectTitle: project.title,
        totalMembers: validEntries.length,
        totalHours: validEntries.reduce((sum: number, e: any) => sum + e.hoursSpent, 0),
        timeEntries: validEntries,
        lastWorkedAt: timeEntriesResult.lastEntryDate,
      });
    } catch (err: any) {
      console.error("Failed to fetch project time entries:", {
        message: err?.message || err,
        code: err?.code,
        detail: err?.detail,
        stack: err?.stack
      });
      res.status(500).json({
        error: "Failed to fetch project time entries",
        details: err?.message || "Unknown error",
      });
    }
  });

  /* ===============================
      DEBUG: Timestrap Schema Info
  ================================ */
  app.get("/api/debug/timestrap-schema", requireAuth, async (req: any, res) => {
    try {
      // Only allow admin users
      const isAdmin = req.user?.role === "ADMIN" || req.employee?.empCode === "E0001";
      if (!isAdmin) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      const schemaInfo = await getTimestrapTableInfo();
      res.json(schemaInfo);
    } catch (err: any) {
      console.error("Failed to get timestrap schema info:", err);
      res.status(500).json({ error: "Failed to get schema info", details: err?.message });
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

      if ((startDate && !formattedStartDate) || (endDate && !formattedEndDate)) {
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

  app.get("/api/projects/:projectId/key-steps", requireAuth, async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const isAdmin = req.user?.role === "ADMIN" || req.employee?.empCode === "E0001";
      const empCode = req.employee?.empCode;
      const isE0001 = empCode === "E0001";
      const requestingEmployeeId = req.employee?.id;
      const requestingEmployeeDepartment = req.employee?.department;
      const filterStatus = req.query.status ? String(req.query.status) : "active";
      let cond: any = eq(keySteps.projectId, projectId);
      
      if (filterStatus === "active") {
        cond = and(cond, sql`${keySteps.status} NOT IN ('completed', 'Completed')`);
      } else if (filterStatus === "Completed" || filterStatus === "completed") {
        cond = and(cond, sql`${keySteps.status} IN ('completed', 'Completed')`);
      }
      // if filterStatus is "all", we don't add status conditions

      const allSteps = await db
        .select()
        .from(keySteps)
        .where(cond);

      if (isAdmin || isE0001) {
        return res.json(allSteps);
      }

      // RELAXED VISIBILITY: If user has access to project, they see all KeySteps
      // Check project access (mimic /api/projects logic)
      const [proj] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);
      if (!proj) return res.status(404).json({ error: "Project not found" });

      const [membership] = await db.select().from(projectTeamMembers).where(and(eq(projectTeamMembers.projectId, projectId), eq(projectTeamMembers.employeeId, requestingEmployeeId))).limit(1);
      const isProjectCreator = proj.createdByEmployeeId === requestingEmployeeId;
      
      // Department match
      const projectDepts = await db.select().from(projectDepartments).where(eq(projectDepartments.projectId, projectId));
      const reqDeptNorm = normalizeDept(requestingEmployeeDepartment);
      const isDeptMatch = projectDepts.some(d => normalizeDept(d.department) === reqDeptNorm);

      const hasAccess = isAdmin || isE0001 || !!membership || isProjectCreator || isDeptMatch;

      if (!hasAccess) {
          // If not a project member/dept match, check if they are assigned to any task in this project
          const [taskAssigned] = await db.select({ id: projectTasks.id })
            .from(projectTasks)
            .leftJoin(taskMembers, eq(projectTasks.id, taskMembers.taskId))
            .where(and(eq(projectTasks.projectId, projectId), eq(taskMembers.employeeId, requestingEmployeeId)))
            .limit(1);
          
          if (!taskAssigned) {
              console.log(`[ACL] Access denied to KeySteps for user ${req.user?.username} on project ${proj.title}`);
              return res.status(403).json({ error: "Access denied to project KeySteps" });
          }
      }

      // If they passed access check, return all steps
      // Sort by phase ASC, title ASC as primary, but we'll return raw for frontend to sort
      console.log(`[API /projects/${projectId}/key-steps] Returning ${allSteps.length} key steps for user ${req.user?.username}`);
      res.json(allSteps);
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
  app.put("/api/key-steps/:id", async (req: any, res) => {
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

      const normalizedStatus = status ? String(status).toLowerCase() : "pending";
      const isCompleted = normalizedStatus === "completed" || normalizedStatus === "Completed".toLowerCase();

      // Get current key step for timestamp check
      const [oldStep] = await db.select().from(keySteps).where(eq(keySteps.id, id));

      const [updated] = await db
        .update(keySteps)
        .set({
          title: title?.trim(),
          description: description ?? "",
          requirements: requirements ?? "",
          header: header ?? "",
          phase: Number(phase) || 1,
          status: normalizedStatus,
          progress: isCompleted ? 100 : (typeof req.body.progress !== 'undefined' ? Number(req.body.progress) : undefined),
          startDate: startDate ? formatDate(startDate) : undefined,
          endDate: endDate ? formatDate(endDate) : undefined,
          completedAt: isCompleted ? (oldStep?.status?.toLowerCase() !== 'completed' ? new Date() : (oldStep?.completedAt || new Date())) : null,
        })
        .where(eq(keySteps.id, id))
        .returning();

      if (updated) {
        await updateParentProgress('keystep', id, req.user?.id);
      }

      if (!updated) return res.status(404).json({ message: "Key step not found" });
      res.json(updated);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Key step update error:", errorMessage);
      res.status(500).json({ message: "Update failed", details: errorMessage });
    }
  });

  // PATCH Key Step
  app.patch("/api/key-steps/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const data = req.body;
      const updateData: any = {};

      if (typeof data.title !== 'undefined') updateData.title = data.title;
      if (typeof data.description !== 'undefined') updateData.description = data.description;
      if (typeof data.requirements !== 'undefined') updateData.requirements = data.requirements;
      if (typeof data.header !== 'undefined') updateData.header = data.header;
      if (typeof data.phase !== 'undefined') updateData.phase = Number(data.phase);
      if (typeof data.startDate !== 'undefined') updateData.startDate = data.startDate;
      if (typeof data.endDate !== 'undefined') updateData.endDate = data.endDate;
      if (typeof data.progress !== 'undefined') updateData.progress = Number(data.progress);

      if (typeof data.status !== 'undefined') {
        updateData.status = data.status;
        const isCompleted = String(data.status).toLowerCase() === "completed";
        if (isCompleted) {
          updateData.progress = 100;
          updateData.completedAt = new Date();
        } else {
          updateData.completedAt = null;
        }
      }

      const [updated] = await db
        .update(keySteps)
        .set(updateData)
        .where(eq(keySteps.id, id))
        .returning();

      if (updated) {
        const isReopening = (updateData.status && String(updateData.status).toLowerCase() !== "completed") ||
          (typeof updateData.progress !== 'undefined' && updateData.progress < 100);

        if (isReopening) {
          console.log(`[KeyStep Reopen] Reopening tasks and subtasks for key step: ${id}`);

          // 1. Reopen all child key steps (if any)
          await db.update(keySteps).set({ status: 'in-progress', progress: 0 }).where(eq(keySteps.parentKeyStepId, id));

          // 2. Reopen all tasks under this key step
          await db.update(projectTasks).set({ status: 'pending', progress: 0 }).where(eq(projectTasks.keyStepId, id));

          // 3. Reopen all subtasks for those tasks
          const taskRows = await db.select({ id: projectTasks.id }).from(projectTasks).where(eq(projectTasks.keyStepId, id));
          if (taskRows.length > 0) {
            const tIds = taskRows.map(tr => tr.id);
            await db.update(subtasks).set({ isCompleted: false, progress: 0 }).where(inArray(subtasks.taskId, tIds));
          }
        }

        await updateParentProgress('keystep', id, req.user?.id);
      }

      if (!updated) return res.status(404).json({ message: "Key step not found" });
      res.json(updated);
    } catch (err) {
      console.error("Key step patch failed:", err);
      res.status(500).json({ message: "Update failed" });
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
      KEY STEP TEMPLATES (Consolidated)
  ================================ */

  // Get raw list of all templates (legacy/basic)
  app.get("/api/keystep-templates", requireAuth, async (req, res) => {
    try {
      const templates = await db.select().from(keyStepTemplates).orderBy(desc(keyStepTemplates.createdAt));
      res.json(templates);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  // Get full template list with task/subtask counts (richer metadata)
  // MUST be before /:id wildcard
  app.get("/api/keystep-templates/list-full", requireAuth, async (_req, res) => {
    try {
      const templates = await db.select().from(keyStepTemplates).orderBy(desc(keyStepTemplates.createdAt));
      const result = templates.map(t => {
        let parsed: any = null;
        try { parsed = t.description ? JSON.parse(t.description) : null; } catch { /* plain text */ }
        return {
          id: t.id,
          name: t.name,
          createdAt: t.createdAt,
          sourceProjectName: parsed?.sourceProjectName || "",
          keystepTitle: parsed?.keystep?.title || t.name,
          taskCount: parsed?.tasks?.length ?? 0,
          subtaskCount: parsed?.tasks?.reduce((acc: number, tk: any) => acc + (tk.subtasks?.length ?? 0), 0) ?? 0,
          hasFullData: !!parsed?.tasks,
        };
      });
      res.json(result);
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  // Save a single KeyStep (with all its tasks & subtasks) as a rich template
  app.post("/api/keystep-templates/from-keystep", requireAuth, async (req: any, res) => {
    try {
      const { keyStepId, templateName, sourceProjectName } = req.body;
      if (!keyStepId || !templateName) {
        return res.status(400).json({ error: "keyStepId and templateName are required" });
      }

      // 1. Fetch the source KeyStep
      const [ks] = await db.select().from(keySteps).where(eq(keySteps.id, keyStepId));
      if (!ks) return res.status(404).json({ error: "KeyStep not found" });

      // 2. Fetch all tasks linked to this KeyStep
      const tasks = await db.select().from(projectTasks).where(eq(projectTasks.keyStepId, keyStepId));

      // 3. Fetch subtasks for each task
      const taskIds = tasks.map(t => t.id);
      let allSubtasks: any[] = [];
      if (taskIds.length > 0) {
        allSubtasks = await db.select().from(subtasks).where(inArray(subtasks.taskId, taskIds));
      }

      // 4. Build rich hierarchy payload stored as JSON in description
      const templateData = {
        keystep: {
          title: ks.title,
          header: ks.header || "",
          description: ks.description || "",
          requirements: ks.requirements || "",
          phase: ks.phase,
        },
        tasks: tasks.map((t, idx) => ({
          sortOrder: idx,
          taskName: t.taskName,
          description: t.description || "",
          status: t.status || "pending",
          priority: t.priority || "medium",
          subtasks: allSubtasks
            .filter(st => st.taskId === t.id)
            .map((st, sidx) => ({
              sortOrder: sidx,
              title: st.title,
              description: st.description || "",
            })),
        })),
        sourceProjectName: sourceProjectName || "",
        savedAt: new Date().toISOString(),
      };

      // 5. Check if template name already exists to avoid unique constraint error
      const [existing] = await db.select().from(keyStepTemplates).where(eq(keyStepTemplates.name, templateName.trim()));
      if (existing) {
        return res.status(400).json({ error: `A template named "${templateName}" already exists. Please use a unique name.` });
      }

      // 6. Create template record — store JSON in description field
      const [template] = await db.insert(keyStepTemplates).values({
        name: templateName.trim(),
        description: JSON.stringify(templateData),
      }).returning();

      // 6. Also insert the root keystep as the single template item (for backward compat)
      await db.insert(keyStepTemplateItems).values({
        templateId: template.id,
        header: ks.header || "",
        title: ks.title,
        description: ks.description || "",
        requirements: ks.requirements || "",
        phase: ks.phase,
      });

      console.log(`✅ Rich template saved: ${template.id} from KeyStep ${keyStepId}`);
      res.status(201).json({
        ...template,
        taskCount: tasks.length,
        subtaskCount: allSubtasks.length,
      });
    } catch (err) {
      const errorMsg = `[TEMPLATES-ERROR] Failed to save rich template: ${err}\n${new Error().stack}\n`;
      console.error(errorMsg);
      try { fs.appendFileSync("error.log", errorMsg); } catch { /* ignore */ }
      res.status(500).json({ error: "Failed to save template", details: String(err) });
    }
  });

  // Basic POST (legacy)
  app.post("/api/keystep-templates", requireAuth, async (req, res) => {
    try {
      const { name, description, items } = req.body;
      const [template] = await db.insert(keyStepTemplates).values({ name, description }).returning();

      if (Array.isArray(items) && items.length > 0) {
        const itemValues = items.map(it => ({
          templateId: template.id,
          header: it.header || "",
          title: it.title,
          description: it.description || "",
          requirements: it.requirements || "",
          phase: Number(it.phase) || 1
        }));
        await db.insert(keyStepTemplateItems).values(itemValues);
      }

      res.status(201).json(template);
    } catch (err) {
      console.error("Failed to create template:", err);
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  // Get single template by ID (wildcard — MUST be after all specific routes)
  app.get("/api/keystep-templates/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const [template] = await db.select().from(keyStepTemplates).where(eq(keyStepTemplates.id, id));
      if (!template) return res.status(404).json({ error: "Template not found" });
      const items = await db.select().from(keyStepTemplateItems).where(eq(keyStepTemplateItems.templateId, id));
      res.json({ ...template, items });
    } catch (err) {
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  // Delete a template
  app.delete("/api/keystep-templates/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(keyStepTemplateItems).where(eq(keyStepTemplateItems.templateId, id));
      await db.delete(keyStepTemplates).where(eq(keyStepTemplates.id, id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  // Apply a full rich template to a project (deep clone KeyStep + Tasks + Subtasks)
  app.post("/api/keystep-templates/:templateId/apply-full", requireAuth, async (req: any, res) => {
    try {
      const { templateId } = req.params;
      const { projectId, assignerId } = req.body;
      if (!projectId) return res.status(400).json({ error: "projectId is required" });

      const finalAssignerId = assignerId || req.employee?.id || null;

      // 1. Load template
      const [template] = await db.select().from(keyStepTemplates).where(eq(keyStepTemplates.id, templateId));
      if (!template) return res.status(404).json({ error: "Template not found" });

      let templateData: any = null;
      try { templateData = template.description ? JSON.parse(template.description) : null; } catch { /* not JSON */ }

      if (!templateData?.keystep) {
        // Fallback: apply the old-style template (keystep items only, no tasks)
        const items = await db.select().from(keyStepTemplateItems).where(eq(keyStepTemplateItems.templateId, templateId)).orderBy(keyStepTemplateItems.phase);
        if (items.length === 0) return res.status(400).json({ error: "No data in template" });
        const inserted = await db.insert(keySteps).values(items.map(it => ({
          projectId,
          header: it.header || "",
          title: it.title,
          description: it.description || "",
          requirements: it.requirements || "",
          phase: it.phase,
          status: "pending",
          progress: 0,
        }))).returning();
        return res.status(201).json({ keystep: inserted[0], tasks: [], subtasks: [] });
      }

      // 2. Create the new KeyStep
      const ksData = templateData.keystep;
      const today = new Date().toISOString().split("T")[0];
      const [newKs] = await db.insert(keySteps).values({
        projectId,
        header: ksData.header || "",
        title: ksData.title,
        description: ksData.description || "",
        requirements: ksData.requirements || "",
        phase: ksData.phase || 1,
        status: "pending",
        progress: 0,
        startDate: today,
        endDate: today,
      }).returning();

      // 3. Clone tasks & subtasks
      const createdTasks: any[] = [];
      const createdSubtasks: any[] = [];

      const taskList: any[] = templateData.tasks || [];
      // Sort by sortOrder to preserve sequence
      taskList.sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

      for (const taskTpl of taskList) {
        if (!taskTpl.taskName) continue;
        const [newTask] = await db.insert(projectTasks).values({
          projectId,
          keyStepId: newKs.id,
          taskName: taskTpl.taskName,
          description: taskTpl.description || null,
          status: "pending",
          priority: taskTpl.priority || "medium",
          startDate: today,
          endDate: today,
          assignerId: finalAssignerId,
          progress: 0,
        } as any).returning();
        createdTasks.push(newTask);

        // 4. Clone subtasks
        const subtaskList: any[] = taskTpl.subtasks || [];
        subtaskList.sort((a: any, b: any) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
        for (const stTpl of subtaskList) {
          if (!stTpl.title) continue;
          const [newSt] = await db.insert(subtasks).values({
            taskId: newTask.id,
            title: stTpl.title,
            description: stTpl.description || "",
            isCompleted: false,
            progress: 0,
          }).returning();
          createdSubtasks.push(newSt);
        }
      }

      console.log(`✅ Applied template ${templateId}: created 1 keystep, ${createdTasks.length} tasks, ${createdSubtasks.length} subtasks`);
      res.status(201).json({
        keystep: newKs,
        tasks: createdTasks,
        subtasks: createdSubtasks,
      });
    } catch (err) {
      console.error("Failed to apply full template:", err);
      res.status(500).json({ error: "Failed to apply template", details: String(err) });
    }
  });

  // Legacy apply route (kept for backward compat)
  app.post("/api/projects/:projectId/key-steps/apply-template", requireAuth, async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const { templateId } = req.body;

      const templateItems = await db
        .select()
        .from(keyStepTemplateItems)
        .where(eq(keyStepTemplateItems.templateId, templateId))
        .orderBy(keyStepTemplateItems.phase);

      if (templateItems.length === 0) {
        return res.status(400).json({ error: "No items found in template" });
      }

      const keyStepsToInsert = templateItems.map(item => ({
        projectId,
        header: item.header || "",
        title: item.title,
        description: item.description || "",
        requirements: item.requirements || "",
        phase: item.phase,
        status: "pending",
        progress: 0,
      }));

      const inserted = await db.insert(keySteps).values(keyStepsToInsert).returning();

      res.status(201).json(inserted);
    } catch (err) {
      console.error("Failed to apply KeyStep template:", err);
      res.status(500).json({ error: "Failed to apply template" });
    }
  });




  // Delete a keystep template
  app.delete("/api/keystep-templates/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      await db.delete(keyStepTemplateItems).where(eq(keyStepTemplateItems.templateId, id));
      await db.delete(keyStepTemplates).where(eq(keyStepTemplates.id, id));
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: "Failed to delete template" });
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
          taskPeriod: req.body.taskPeriod || "custom",
          reminderFrequency: req.body.reminderFrequency || "4 times",
          ticketId: req.body.ticketId || null,
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

      // Trigger progress recalculation for the parent keystep/project
      // and for the task itself if it has subtasks
      if (Array.isArray(incomingSubtasks) && incomingSubtasks.length > 0) {
        // We pick one subtask ID to trigger the updateParentProgress chain
        const [firstSub] = await db.select().from(subtasks).where(eq(subtasks.taskId, task.id)).limit(1);
        if (firstSub) {
          await updateParentProgress('subtask', firstSub.id, req.user?.id);
        }
      } else {
        await updateParentProgress('task', task.id, req.user?.id);
      }
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

      const isCompleted = status === "Completed" || status === "completed";

      // Fetch current task state for timestamp logic
      const [oldTask] = await db.select().from(projectTasks).where(eq(projectTasks.id, id)).limit(1);

      const updateData: any = {
        taskName,
        description: description || null,
        status: status || "pending",
        priority: priority || "medium",
        assignerId: finalAssignerId,
        updatedAt: new Date(),
        completedAt: isCompleted ? (oldTask?.status !== 'Completed' && oldTask?.status !== 'completed' ? new Date() : (oldTask?.completedAt || new Date())) : null,
        progress: isCompleted ? 100 : (typeof req.body.progress !== 'undefined' ? Number(req.body.progress) : undefined),
      };

      // Persist milestone (key step) changes when provided
      if (typeof keyStepId !== "undefined") {
        updateData.keyStepId = keyStepId || null;
      }

      console.log("[PUT /api/tasks/:id] computed updateData:", JSON.stringify(updateData));

      if (startDate) updateData.startDate = formatDate(startDate);
      if (endDate) updateData.endDate = formatDate(endDate);
      if (typeof req.body.taskPeriod !== "undefined") updateData.taskPeriod = req.body.taskPeriod;
      if (typeof req.body.reminderFrequency !== "undefined") updateData.reminderFrequency = req.body.reminderFrequency;

      const [updated] = await db
        .update(projectTasks)
        .set(updateData)
        .where(eq(projectTasks.id, id))
        .returning();

      // NOTE: Progress update moved to after subtasks are handled below
      // so it considers newly added subtasks if any.
      /*
      if (updated) {
        await updateParentProgress('task', id, req.user?.id);
      }
      */

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

        console.log("✅ Subtasks inserted:", inserted.length);

        // After subtasks are updated, recalculate task progress and status
        if (inserted.length > 0) {
          await updateParentProgress('subtask', inserted[0].id, req.user?.id);
        }
      } else {
        // If no subtasks, still trigger task-level update to keyStep/project
        await updateParentProgress('task', id, req.user?.id);
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

  // PATCH TASK (partial update)
  app.patch("/api/tasks/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const data = req.body;

      const updateData: any = {};
      if (typeof data.taskName !== 'undefined') updateData.taskName = data.taskName;
      if (typeof data.description !== 'undefined') updateData.description = data.description || null;
      if (typeof data.status !== 'undefined') {
        updateData.status = data.status || "pending";
        const isCompleted = updateData.status === "Completed" || updateData.status === "completed";
        if (isCompleted) updateData.progress = 100;
        // Get current task state for timestamp logic
        const [oldTask] = await db.select().from(projectTasks).where(eq(projectTasks.id, id)).limit(1);
        updateData.completedAt = isCompleted ? (oldTask?.status !== 'Completed' && oldTask?.status !== 'completed' ? new Date() : (oldTask?.completedAt || new Date())) : null;
      }
      if (typeof data.priority !== 'undefined') updateData.priority = data.priority || "medium";
      if (typeof data.startDate !== 'undefined') updateData.startDate = data.startDate || null;
      if (typeof data.endDate !== 'undefined') updateData.endDate = data.endDate || null;
      if (typeof data.keyStepId !== 'undefined') updateData.keyStepId = data.keyStepId || null;
      if (typeof data.progress !== 'undefined') updateData.progress = Number(data.progress);

      updateData.updatedAt = new Date();

      const [updated] = await db
        .update(projectTasks)
        .set(updateData)
        .where(eq(projectTasks.id, id))
        .returning();

      if (updated) {
        // If the task is being reopened (status changed from Completed to something else),
        // or if progress is explicitly set to < 100, reopen all subtasks
        const isReopening = updateData.status &&
          updateData.status !== "Completed" &&
          updateData.status !== "completed";

        if (isReopening || (typeof updateData.progress !== 'undefined' && updateData.progress < 100)) {
          await db.update(subtasks)
            .set({ isCompleted: false, progress: 0 })
            .where(eq(subtasks.taskId, id));
          console.log(`[Task Reopen] Reopened all subtasks for task: ${id}`);
        }

        await updateParentProgress('task', id, req.user?.id);
      }

      if (!updated) return res.status(404).json({ message: "Task not found" });
      res.json(updated);
    } catch (err) {
      console.error("Task patch failed:", err);
      res.status(500).json({ message: "Update failed" });
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

  // GET ALL COMPLETED SUBTASKS (bulk) — for Completed page
  app.get("/api/subtasks/completed/bulk", requireAuth, async (req: any, res) => {
    try {
      const isAdmin = req.user?.role === "ADMIN" || req.employee?.empCode === "E0001";
      const empCode = req.employee?.empCode;
      const isE0001 = empCode === "E0001";
      const requestingEmployeeId = req.employee?.id;

      // Fetch all completed subtasks
      const completedSubs = await db
        .select()
        .from(subtasks)
        .where(eq(subtasks.isCompleted, true));

      if (!completedSubs.length) return res.json([]);

      // Filter by visibility for non-admin users
      let visibleSubs = completedSubs;
      if (!isAdmin && !isE0001 && requestingEmployeeId) {
        // Get subtask member assignments
        const subIds = completedSubs.map(s => s.id);
        const subMemberRows = subIds.length > 0
          ? await db.select().from(subtaskMembers).where(inArray(subtaskMembers.subtaskId, subIds))
          : [];
        const subMemberMap = new Map<string, string[]>();
        subMemberRows.forEach(r => {
          if (!subMemberMap.has(r.subtaskId)) subMemberMap.set(r.subtaskId, []);
          subMemberMap.get(r.subtaskId)!.push(r.employeeId);
        });

        visibleSubs = completedSubs.filter(s => {
          const mIds = subMemberMap.get(s.id) || [];
          return s.assignedTo === requestingEmployeeId || mIds.includes(requestingEmployeeId);
        });
      }

      if (!visibleSubs.length) return res.json([]);

      // Enrich with parent task names + project info
      const taskIds = Array.from(new Set(visibleSubs.map(s => s.taskId)));
      const parentTasks = await db
        .select({ id: projectTasks.id, taskName: projectTasks.taskName, projectId: projectTasks.projectId })
        .from(projectTasks)
        .where(inArray(projectTasks.id, taskIds));

      const taskMap = new Map(parentTasks.map(t => [t.id, t]));

      const projectIds = Array.from(new Set(parentTasks.map(t => t.projectId)));
      const projectRows = projectIds.length > 0
        ? await db.select({ id: projects.id, title: projects.title }).from(projects).where(inArray(projects.id, projectIds))
        : [];
      const projMap = new Map(projectRows.map(p => [p.id, p]));

      const result = visibleSubs.map(s => {
        const parentTask = taskMap.get(s.taskId);
        const project = parentTask ? projMap.get(parentTask.projectId) : null;
        return {
          ...s,
          taskName: parentTask?.taskName || "Unknown Task",
          projectId: parentTask?.projectId || null,
          projectTitle: project?.title || "Unknown Project",
        };
      });

      res.json(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Completed subtasks fetch error:", errorMessage);
      res.status(500).json({ error: "Failed to fetch completed subtasks" });
    }
  });

  // BULK FETCH ALL SUBTASKS (all subtasks for all authenticated users)
  app.get("/api/subtasks/bulk", requireAuth, async (req: any, res) => {
    try {
      const filterStatus = req.query.status ? String(req.query.status) : "active";
      const isAdmin = req.user?.role === "ADMIN" || req.employee?.empCode === "E0001";
      const requestingEmployeeId = req.employee?.id;
      const requestingEmployeeDepartment = req.employee?.department;

      let subtaskQuery: any = db.select().from(subtasks);
      if (filterStatus === "active") {
        subtaskQuery = subtaskQuery.where(eq(subtasks.isCompleted, false));
      } else if (filterStatus === "Completed") {
        subtaskQuery = subtaskQuery.where(eq(subtasks.isCompleted, true));
      }

      if (!isAdmin) {
        if (!requestingEmployeeId) return res.json([]);

        const deptProjectIdsRaw = await db
          .select({ projectId: projectDepartments.projectId })
          .from(projectDepartments)
          .where(eq(projectDepartments.department, normalizeDept(requestingEmployeeDepartment)));
        const deptProjectIds = deptProjectIdsRaw.map((r) => r.projectId);

        const teamProjectIdsRaw = await db
          .select({ projectId: projectTeamMembers.projectId })
          .from(projectTeamMembers)
          .where(eq(projectTeamMembers.employeeId, requestingEmployeeId));
        const teamProjectIds = teamProjectIdsRaw.map((r) => r.projectId);

        const accessibleProjectIds = Array.from(new Set([...deptProjectIds, ...teamProjectIds]));

        const assignedSubtaskTaskIdsRaw = await db
          .select({ taskId: subtasks.taskId })
          .from(subtasks)
          .leftJoin(subtaskMembers, eq(subtasks.id, subtaskMembers.subtaskId))
          .where(or(eq(subtasks.assignedTo, requestingEmployeeId), eq(subtaskMembers.employeeId, requestingEmployeeId)));
        const assignedSubtaskTaskIds = Array.from(new Set(assignedSubtaskTaskIdsRaw.map((r) => r.taskId)));

        const conditions: any[] = [];
        if (accessibleProjectIds.length > 0) {
          const visibleTaskIdsRaw = await db
            .select({ id: projectTasks.id })
            .from(projectTasks)
            .where(inArray(projectTasks.projectId, accessibleProjectIds));
          const visibleTaskIds = visibleTaskIdsRaw.map((r) => r.id);
          if (visibleTaskIds.length > 0) {
            conditions.push(inArray(subtasks.taskId, visibleTaskIds));
          }
        }

        if (assignedSubtaskTaskIds.length > 0) {
          conditions.push(inArray(subtasks.taskId, assignedSubtaskTaskIds));
        }

        if (conditions.length === 0) {
          return res.json([]);
        }

        subtaskQuery = subtaskQuery.where(or(...conditions));
      }

      const subtasksResult = await subtaskQuery;
      res.json(subtasksResult);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Bulk subtasks fetch error:", errorMessage);
      res.status(500).json({ error: "Failed to fetch subtasks", details: errorMessage });
    }
  });

  // GET SUBTASKS BY TASK ID
  app.get("/api/subtasks/:taskId", requireAuth, async (req: any, res) => {
    try {
      const { taskId } = req.params;
      const rows = await db.select().from(subtasks).where(eq(subtasks.taskId, taskId));
      res.json(rows);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Subtasks fetch error:", errorMessage);
      res.status(500).json({ error: "Failed to fetch subtasks" });
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
      const { isCompleted, progress, startDate, endDate } = req.body;

      const updateData: any = {};
      if (typeof isCompleted !== 'undefined') {
        updateData.isCompleted = !!isCompleted;
        if (!!isCompleted && typeof progress === 'undefined') updateData.progress = 100;
        if (!isCompleted && typeof progress === 'undefined') updateData.progress = 0;
      }
      if (typeof progress !== 'undefined') {
        updateData.progress = Number(progress);
        if (updateData.progress === 100) updateData.isCompleted = true;
        else if (updateData.progress < 100) updateData.isCompleted = false;
      }
      if (typeof startDate !== 'undefined') updateData.startDate = startDate || null;
      if (typeof endDate !== 'undefined') updateData.endDate = endDate || null;

      // DEBUG: log incoming update payload
      console.debug('[PATCH /api/subtasks/:id] id=', id, 'updateData=', updateData);

      const [updated] = await db.update(subtasks).set(updateData).where(eq(subtasks.id, id)).returning();
      console.debug('[PATCH /api/subtasks/:id] db returned updated=', updated);

      if (updated) {
        await updateParentProgress('subtask', id, req.user?.id);
      }

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
      const isAdmin = req.user?.role === "ADMIN" || req.employee?.empCode === "E0001";
      const empCode = req.employee?.empCode;
      const isE0001 = empCode === "E0001";
      const requestingEmployeeId = req.employee?.id;
      const requestingEmployeeDepartment = req.employee?.department;
      const filterStatus = req.query.status ? String(req.query.status) : "active";

      let tasks;
      let assignedTaskIds: string[] = [];

      if (isAdmin || isE0001) {
        // Fetch ALL tasks from all projects
        let query = db.select().from(projectTasks);
        if (filterStatus === "active") {
          tasks = await query.where(sql`${projectTasks.status} != 'Completed' AND ${projectTasks.status} != 'completed'`);
        } else if (filterStatus === "Completed") {
          tasks = await query.where(or(eq(projectTasks.status, "Completed"), eq(projectTasks.status, "completed")));
        } else {
          tasks = await query;
        }
      } else {
        if (!requestingEmployeeId) return res.status(403).json({ error: "Forbidden" });

        const reqDeptNorm = normalizeDept(requestingEmployeeDepartment);

        // Get project IDs from the employee's department
        const deptProjectIdsRaw = await db
          .select({ projectId: projectDepartments.projectId })
          .from(projectDepartments)
          .where(eq(projectDepartments.department, reqDeptNorm));
        const deptProjectIds = deptProjectIdsRaw.map((r) => r.projectId);

        // Get project IDs where user is an explicit team member
        const teamProjectIdsRaw = await db
          .select({ projectId: projectTeamMembers.projectId })
          .from(projectTeamMembers)
          .where(eq(projectTeamMembers.employeeId, requestingEmployeeId));
        const teamProjectIds = teamProjectIdsRaw.map((r) => r.projectId);

        // Accessible projects = team member OR department match
        const initialAccessibleProjectIds = Array.from(new Set([...deptProjectIds, ...teamProjectIds]));

        // SPECIAL RESTRICTION for E0046, E0048: Only allow software developer projects
        const currentEmpCode = req.employee?.empCode;
        let accessibleProjectIds = initialAccessibleProjectIds;

        if (currentEmpCode === "E0046" || currentEmpCode === "E0048") {
          const normalizedSoftwareDept = normalizeDept("software developer");
          const allSoftProjsRaw = await db.select({ id: projectDepartments.projectId })
            .from(projectDepartments)
            .where(eq(projectDepartments.department, normalizedSoftwareDept));
          const allSoftProjs = allSoftProjsRaw.map(r => r.id);

          accessibleProjectIds = initialAccessibleProjectIds.filter(id => allSoftProjs.includes(id));
        }

        // Get task IDs where user is explicitly assigned as a task member
        const taskMemberIdsRaw = await db
          .select({ taskId: taskMembers.taskId })
          .from(taskMembers)
          .where(eq(taskMembers.employeeId, requestingEmployeeId));
        const taskMemberIds = taskMemberIdsRaw.map((r) => r.taskId);

        // Get task IDs where user is a subtask member
        const subtaskAssignedTaskIdsRaw = await db
          .select({ taskId: subtasks.taskId })
          .from(subtasks)
          .leftJoin(subtaskMembers, eq(subtasks.id, subtaskMembers.subtaskId))
          .where(or(eq(subtasks.assignedTo, requestingEmployeeId), eq(subtaskMembers.employeeId, requestingEmployeeId)));
        const subtaskAssignedTaskIds = subtaskAssignedTaskIdsRaw.map(r => r.taskId);

        assignedTaskIds = Array.from(new Set([...taskMemberIds, ...subtaskAssignedTaskIds]));

        // Visibility: tasks from accessible projects (dept/team) OR directly assigned OR created by user
        let conditions: any[] = [
          eq(projectTasks.assignerId, requestingEmployeeId),
        ];
        if (accessibleProjectIds.length > 0) {
          conditions.push(inArray(projectTasks.projectId, accessibleProjectIds));
        }

        if (assignedTaskIds.length > 0) {
          conditions.push(inArray(projectTasks.id, assignedTaskIds));
        }

        // For E0046/E0048, we must ONLY show tasks from software developer projects
        if (currentEmpCode === "E0046" || currentEmpCode === "E0048") {
          const normalizedSoftwareDept = normalizeDept("software developer");
          const allSoftProjsRaw = await db.select({ id: projectDepartments.projectId })
            .from(projectDepartments)
            .where(eq(projectDepartments.department, normalizedSoftwareDept));
          const allSoftProjs = allSoftProjsRaw.map(r => r.id);

          if (allSoftProjs.length > 0) {
            // Wrap existing conditions in an AND with project filter
            const projectCond = inArray(projectTasks.projectId, allSoftProjs);
            conditions = [and(or(...conditions), projectCond)];
          } else {
            // No software projects exist? They see nothing.
            conditions = [sql`false` as any];
          }
        }

        let finalConditions;
        if (filterStatus === "active") {
          finalConditions = and(or(...conditions), sql`${projectTasks.status} != 'Completed' AND ${projectTasks.status} != 'completed'`);
        } else if (filterStatus === "Completed") {
          finalConditions = and(or(...conditions), or(eq(projectTasks.status, "Completed"), eq(projectTasks.status, "completed")));
        } else {
          finalConditions = or(...conditions);
        }

        tasks = await db
          .select()
          .from(projectTasks)
          .where(finalConditions);
      }

      if (!tasks.length) return res.json([]);

      const taskIds = tasks.map((t) => t.id);

      // Fetch members and subtasks in parallel
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

      // Fetch subtask members for filtering and grouping
      const subIds = subs.map(s => s.id);
      let subMemRows: any[] = [];
      if (subIds.length > 0) {
        subMemRows = await db
          .select()
          .from(subtaskMembers)
          .where(inArray(subtaskMembers.subtaskId, subIds));
      }
      const subMemMap = new Map<string, string[]>();
      subMemRows.forEach(rm => {
        if (!subMemMap.has(rm.subtaskId)) subMemMap.set(rm.subtaskId, []);
        subMemMap.get(rm.subtaskId)!.push(rm.employeeId);
      });

      // Build maps for O(1) lookups instead of O(n) filtering
      const memberMap = new Map<string, string[]>();
      const subtaskMap = new Map<string, any[]>();

      members.forEach((m) => {
        if (!memberMap.has(m.taskId)) memberMap.set(m.taskId, []);
        memberMap.get(m.taskId)!.push(m.employeeId);
      });

      subs.forEach((s) => {
        if (!subtaskMap.has(s.taskId)) subtaskMap.set(s.taskId, []);

        // Visibility Check for subtasks: if the user can see the task, they can see its subtasks.
        // Subtasks are already filtered because we only query subtasks for visible tasks.

        subtaskMap.get(s.taskId)!.push({
          ...s,
          assignedTo: subMemMap.get(s.id) || (s.assignedTo ? [s.assignedTo] : [])
        });
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
      const filterStatus = req.query.status ? String(req.query.status) : "active";
      let stepsQuery = db.select().from(keySteps);

      if (filterStatus === "active") {
        stepsQuery = stepsQuery.where(sql`${keySteps.status} != 'completed' AND ${keySteps.status} != 'Completed'`) as any;
      } else if (filterStatus === "Completed") {
        stepsQuery = stepsQuery.where(or(eq(keySteps.status, "completed"), eq(keySteps.status, "Completed"))) as any;
      }

      const isAdmin = req.user?.role === "ADMIN" || req.employee?.empCode === "E0001";
      const requestingEmployeeId = req.employee?.id;
      const requestingEmployeeDepartment = req.employee?.department;

      let steps: any[] = [];
      if (isAdmin) {
        steps = await stepsQuery.orderBy(sql`${keySteps.createdAt} DESC`);
      } else {
        if (!requestingEmployeeId) return res.json([]);

        // For normal users, show primary keysteps if:
        // 1. They are in a project that matches their department
        const reqDeptNorm = normalizeDept(requestingEmployeeDepartment);
        const deptProjectIdsRaw = await db
          .select({ projectId: projectDepartments.projectId })
          .from(projectDepartments)
          .where(eq(projectDepartments.department, reqDeptNorm));
        const deptProjectIds = deptProjectIdsRaw.map((r) => r.projectId);

        // 2. They are explicitly in the project team
        const teamProjectIdsRaw = await db
          .select({ projectId: projectTeamMembers.projectId })
          .from(projectTeamMembers)
          .where(eq(projectTeamMembers.employeeId, requestingEmployeeId));
        const teamProjectIds = teamProjectIdsRaw.map((r) => r.projectId);

        const accessibleProjectIds = Array.from(new Set([...deptProjectIds, ...teamProjectIds]));

        if (accessibleProjectIds.length === 0) {
          steps = [];
        } else {
          steps = await stepsQuery
            .where(inArray(keySteps.projectId, accessibleProjectIds))
            .orderBy(sql`${keySteps.createdAt} DESC`);
        }
      }
      res.json(steps);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Bulk keysteps fetch error:", errorMessage);
      res.status(500).json({ error: "Failed to fetch keysteps", details: errorMessage });
    }
  });

  // GET TASKS BY PROJECT
  app.get("/api/tasks/:projectId", requireAuth, async (req: any, res) => {
    try {
      const { projectId } = req.params;
      const isAdmin = req.user?.role === "ADMIN" || req.employee?.empCode === "E0001";
      const empCode = req.employee?.empCode;
      const isE0001 = empCode === "E0001";
      const requestingEmployeeId = req.employee?.id;
      const requestingEmployeeDepartment = req.employee?.department;

      // First, get the tasks for the project
      const filterStatus = req.query.status ? String(req.query.status) : "active";
      const projectIdCond = eq(projectTasks.projectId, projectId);

      let finalCond;
      if (filterStatus === "active") {
        finalCond = and(projectIdCond, sql`${projectTasks.status} != 'Completed' AND ${projectTasks.status} != 'completed'`);
      } else if (filterStatus === "Completed") {
        finalCond = and(projectIdCond, or(eq(projectTasks.status, "Completed"), eq(projectTasks.status, "completed")));
      } else {
        finalCond = projectIdCond;
      }

      const allProjectTasks = await db
        .select()
        .from(projectTasks)
        .where(finalCond);

      if (!allProjectTasks.length) return res.json([]);

      let tasks;
      let userTaskMemberIds: string[] = [];
      let assignedTaskIds: string[] = [];
      if (isAdmin || isE0001) {
        tasks = allProjectTasks;
      } else {
        if (!requestingEmployeeId) return res.status(403).json({ error: "Forbidden" });

        const reqDeptNorm = normalizeDept(requestingEmployeeDepartment);

        // Check if the employee has project-level access (department match OR team membership OR creator)
        const [deptMatch, teamMatch] = await Promise.all([
          db.select({ id: projectDepartments.projectId })
            .from(projectDepartments)
            .where(and(eq(projectDepartments.projectId, projectId), eq(projectDepartments.department, reqDeptNorm))),
          db.select({ id: projectTeamMembers.projectId })
            .from(projectTeamMembers)
            .where(and(eq(projectTeamMembers.projectId, projectId), eq(projectTeamMembers.employeeId, requestingEmployeeId))),
        ]);

        const hasProjectAccess = deptMatch.length > 0 || teamMatch.length > 0;

        if (hasProjectAccess) {
          // User has project-level access — show ALL tasks in the project
          tasks = allProjectTasks;
          console.log(`[TASKS-API] Project: ${projectId}, User has project access — showing all ${allProjectTasks.length} tasks, User: ${requestingEmployeeId}`);
        } else {
          // No dept/team project access — check if user is assigned to ANY task in this project.
          // If yes, they are a project participant and should see all tasks (matches production behaviour).
          const taskMemberIdsRaw = await db
            .select({ taskId: taskMembers.taskId })
            .from(taskMembers)
            .where(eq(taskMembers.employeeId, requestingEmployeeId));
          const taskMemberIds = taskMemberIdsRaw.map((r) => r.taskId);

          const subtaskAssignedTaskIdsRaw = await db
            .select({ taskId: subtasks.taskId })
            .from(subtasks)
            .leftJoin(subtaskMembers, eq(subtasks.id, subtaskMembers.subtaskId))
            .where(or(eq(subtasks.assignedTo, requestingEmployeeId), eq(subtaskMembers.employeeId, requestingEmployeeId)));
          const subtaskAssignedTaskIds = subtaskAssignedTaskIdsRaw.map(r => r.taskId);

          assignedTaskIds = Array.from(new Set([...taskMemberIds, ...subtaskAssignedTaskIds]));

          // Check if the user has any connection to this specific project
          const projectTaskIds = allProjectTasks.map(t => t.id);
          const isProjectParticipant =
            assignedTaskIds.some(id => projectTaskIds.includes(id)) ||
            allProjectTasks.some(t => t.assignerId === requestingEmployeeId);

          if (isProjectParticipant) {
            // User is a participant in this project — show ALL project tasks
            tasks = allProjectTasks;
            console.log(`[TASKS-API] Project: ${projectId}, User is project participant — showing all ${allProjectTasks.length} tasks, User: ${requestingEmployeeId}`);
          } else {
            // User has no connection to this project at all — show only their assigned tasks
            tasks = allProjectTasks.filter(t => assignedTaskIds.includes(t.id) || t.assignerId === requestingEmployeeId);
            console.log(`[TASKS-API] Project: ${projectId}, No project connection — showing ${tasks.length}/${allProjectTasks.length} tasks, User: ${requestingEmployeeId}`);
          }
        }
      }

      // Filter by status if requested (secondary filter since allProjectTasks was already filtered by status at line 1984)
      // Actually, line 1984 already applied the status filter to allProjectTasks.
      // So 'tasks' here is already status-filtered.

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
            progress: subtasks.progress,
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
            .select()
            .from(subtaskMembers)
            .where(inArray(subtaskMembers.subtaskId, subtaskIds));
        }
      } catch (e) {
        subtaskMemberRows = [];
      }

      // Build maps for O(1) lookups
      const memberMap = new Map<string, string[]>();
      const subtaskMap = new Map<string, any[]>();
      const subtaskMembersMap = new Map<string, string[]>();

      (subtaskMemberRows || []).forEach((r: any) => {
        if (!subtaskMembersMap.has(r.subtaskId)) subtaskMembersMap.set(r.subtaskId, []);
        subtaskMembersMap.get(r.subtaskId)!.push(r.employeeId);
      });

      members.forEach((m) => {
        if (!memberMap.has(m.taskId)) memberMap.set(m.taskId, []);
        memberMap.get(m.taskId)!.push(m.employeeId);
      });

      subs.forEach((s) => {
        if (!subtaskMap.has(s.taskId)) subtaskMap.set(s.taskId, []);

        // Visibility Check for subtasks: if the user can see the task, they can see its subtasks.
        // Subtasks are already filtered because we only query subtasks for visible tasks.

        const assigned = subtaskMembersMap.get(s.id) || (s.assignedTo ? [s.assignedTo] : []);
        subtaskMap.get(s.taskId)!.push({
          ...s,
          assignedTo: assigned,
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
  app.get("/api/task/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const isAdmin = req.user?.role === "ADMIN" || req.employee?.empCode === "E0001";
      const empCode = req.employee?.empCode;
      const isE0001 = empCode === "E0001";
      const requestingEmployeeId = req.employee?.id;
      const requestingEmployeeDepartment = req.employee?.department;

      const [task] = await db.select().from(projectTasks).where(eq(projectTasks.id, id)).limit(1);
      if (!task) return res.status(404).json({ message: "Task not found" });

      // Permission Check
      if (!isAdmin && !isE0001) {
        if (!requestingEmployeeId) return res.status(403).json({ error: "Forbidden" });

        // Check if user is a member of this task
        const membership = await db
          .select()
          .from(taskMembers)
          .where(and(eq(taskMembers.taskId, id), eq(taskMembers.employeeId, requestingEmployeeId)));

        const isMember = membership.length > 0;

        if (!isMember) {
          // Check if project department matches
          const reqDeptNorm = normalizeDept(requestingEmployeeDepartment);
          const projectDeptsRaw = await db
            .select()
            .from(projectDepartments)
            .where(and(eq(projectDepartments.projectId, task.projectId), eq(projectDepartments.department, reqDeptNorm)));

          if (projectDeptsRaw.length === 0) {
            return res.status(403).json({ error: "Access denied to this task" });
          }
        }
      }

      const members = await db
        .select({ taskId: taskMembers.taskId, employeeId: taskMembers.employeeId })
        .from(taskMembers)
        .where(eq(taskMembers.taskId, id));

      const subs = await db
        .select({ id: subtasks.id, title: subtasks.title, description: subtasks.description, isCompleted: subtasks.isCompleted, assignedTo: subtasks.assignedTo, startDate: subtasks.startDate, endDate: subtasks.endDate, progress: subtasks.progress })
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
        const isAdmin = req.user?.role === "ADMIN" || req.employee?.empCode === "E0001";
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
      const isAdmin = req.user?.role === "ADMIN" || req.employee?.empCode === "E0001";
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
      const isAdmin = req.user?.role === "ADMIN" || req.employee?.empCode === "E0001";
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

  /* ===============================
     DISCUSSIONS
  ================================ */

  // Multi-file upload for discussions
  app.post("/api/discussions/upload", requireAuth, upload.array("files"), async (req: any, res) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      const uploadedFiles = files.map(file => ({
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        storageUrl: `/uploads/${file.filename}`,
      }));

      res.json(uploadedFiles);
    } catch (err: any) {
      console.error("Discussion upload failed:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  // GET all discussions for current employee
  app.get("/api/discussions", requireAuth, async (req: any, res) => {
    try {
      const empId = req.employee?.id;
      if (!empId) return res.status(403).json({ error: "Employee profile required" });

      const isAdmin = req.user?.role === "ADMIN" || req.employee?.empCode === "E0001";
      const userDept = req.employee?.department;

      let queryBuilder = db
        .select({
          id: discussions.id,
          title: discussions.title,
          content: discussions.content,
          createdBy: discussions.createdBy,
          createdAt: discussions.createdAt,
          updatedAt: discussions.updatedAt,
          creatorName: employees.name,
          creatorDept: employees.department,
        })
        .from(discussions)
        .leftJoin(employees, eq(discussions.createdBy, employees.id))
        .leftJoin(discussionParticipants, eq(discussions.id, discussionParticipants.discussionId));

      let result;
      if (isAdmin) {
        result = await queryBuilder.orderBy(sql`${discussions.createdAt} DESC`);
      } else {
        const conditions = [
          eq(discussions.createdBy, empId),
          eq(discussionParticipants.employeeId, empId)
        ];
        if (userDept) {
          conditions.push(eq(employees.department, userDept));
        }
        result = await queryBuilder
          .where(or(...conditions))
          .orderBy(sql`${discussions.createdAt} DESC`);
      }

      // Deduplicate result because of join
      const uniqueDiscussions = Array.from(new Map(result.map(d => [d.id, d])).values());

      res.json(uniqueDiscussions);
    } catch (err: any) {
      console.error("Fetch discussions failed:", err);
      res.status(500).json({ error: "Failed to fetch discussions" });
    }
  });

  // GET specific discussion details
  app.get("/api/discussions/:id", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const empId = req.employee?.id;
      if (!empId) return res.status(403).json({ error: "Employee profile required" });

      // Check if participant
      const [isParticipant] = await db
        .select()
        .from(discussionParticipants)
        .where(
          and(
            eq(discussionParticipants.discussionId, id),
            eq(discussionParticipants.employeeId, empId)
          )
        );

      const isAdmin = req.user?.role === "ADMIN" || req.employee?.empCode === "E0001";
      const userDept = req.employee?.department;

      const [discussion] = await db
        .select({
          id: discussions.id,
          title: discussions.title,
          content: discussions.content,
          createdBy: discussions.createdBy,
          createdAt: discussions.createdAt,
          creatorName: employees.name,
          creatorDept: employees.department,
        })
        .from(discussions)
        .leftJoin(employees, eq(discussions.createdBy, employees.id))
        .where(eq(discussions.id, id));

      if (!discussion) return res.status(404).json({ error: "Discussion not found" });

      const isCreator = discussion.createdBy === empId;
      const isSameDept = userDept && discussion.creatorDept === userDept;

      if (!isAdmin && !isCreator && !isParticipant && !isSameDept) {
        return res.status(403).json({ error: "Access denied" });
      }

      // Fetch replies
      const replies = await db
        .select({
          id: discussionReplies.id,
          content: discussionReplies.content,
          createdBy: discussionReplies.createdBy,
          createdAt: discussionReplies.createdAt,
          creatorName: employees.name,
        })
        .from(discussionReplies)
        .leftJoin(employees, eq(discussionReplies.createdBy, employees.id))
        .where(eq(discussionReplies.discussionId, id))
        .orderBy(sql`${discussionReplies.createdAt} ASC`);

      // Fetch attachments
      const attachments = await db
        .select()
        .from(discussionAttachments)
        .where(eq(discussionAttachments.discussionId, id));

      // Fetch participants
      const participants = await db
        .select({
          id: employees.id,
          name: employees.name,
        })
        .from(discussionParticipants)
        .leftJoin(employees, eq(discussionParticipants.employeeId, employees.id))
        .where(eq(discussionParticipants.discussionId, id));

      res.json({
        ...discussion,
        replies,
        attachments,
        participants,
      });
    } catch (err: any) {
      console.error("Fetch discussion detail failed:", err);
      res.status(500).json({ error: "Failed to fetch discussion details" });
    }
  });

  // POST new discussion
  app.post("/api/discussions", requireAuth, async (req: any, res) => {
    try {
      const { title, content, participantIds, attachments } = req.body;
      const empId = req.employee?.id;
      if (!empId) return res.status(403).json({ error: "Employee profile required" });

      if (!title || !content) return res.status(400).json({ error: "Title and content required" });

      const [newDiscussion] = await db.insert(discussions).values({
        title,
        content,
        createdBy: empId,
      }).returning();

      // Add self as participant
      await db.insert(discussionParticipants).values({
        discussionId: newDiscussion.id,
        employeeId: empId,
      });

      // Add other participants
      if (participantIds && Array.isArray(participantIds)) {
        const otherParticipants = participantIds
          .filter(id => id !== empId)
          .map(id => ({
            discussionId: newDiscussion.id,
            employeeId: id,
          }));
        if (otherParticipants.length > 0) {
          await db.insert(discussionParticipants).values(otherParticipants);
        }
      }

      // Add attachments
      if (attachments && Array.isArray(attachments)) {
        const attachmentData = attachments.map(att => ({
          discussionId: newDiscussion.id,
          fileName: att.fileName,
          fileSize: att.fileSize,
          mimeType: att.mimeType,
          storageUrl: att.storageUrl,
        }));
        if (attachmentData.length > 0) {
          await db.insert(discussionAttachments).values(attachmentData);
        }
      }

      res.status(201).json(newDiscussion);
    } catch (err: any) {
      console.error("Create discussion failed:", err);
      res.status(500).json({ error: "Failed to create discussion" });
    }
  });

  // POST reply to discussion
  app.post("/api/discussions/:id/replies", requireAuth, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { content, attachments } = req.body;
      const empId = req.employee?.id;
      if (!empId) return res.status(403).json({ error: "Employee profile required" });

      if (!content) return res.status(400).json({ error: "Reply content required" });

      // Security Check
      const isAdmin = req.user?.role === "ADMIN" || req.employee?.empCode === "E0001";
      const userDept = req.employee?.department;

      // Check if participant
      const [isParticipant] = await db
        .select()
        .from(discussionParticipants)
        .where(
          and(
            eq(discussionParticipants.discussionId, id),
            eq(discussionParticipants.employeeId, empId)
          )
        );

      const [discussion] = await db
        .select({
          id: discussions.id,
          createdBy: discussions.createdBy,
          creatorDept: employees.department,
        })
        .from(discussions)
        .leftJoin(employees, eq(discussions.createdBy, employees.id))
        .where(eq(discussions.id, id));

      if (!discussion) return res.status(404).json({ error: "Discussion not found" });

      const isCreator = discussion.createdBy === empId;
      const isSameDept = userDept && discussion.creatorDept === userDept;

      if (!isAdmin && !isCreator && !isSameDept && !isParticipant) {
        return res.status(403).json({ error: "Access denied" });
      }

      const [reply] = await db.insert(discussionReplies).values({
        discussionId: id,
        content,
        createdBy: empId,
      }).returning();

      // Add attachments for reply
      if (attachments && Array.isArray(attachments)) {
        const attachmentData = attachments.map(att => ({
          discussionId: id,
          replyId: reply.id,
          fileName: att.fileName,
          fileSize: att.fileSize,
          mimeType: att.mimeType,
          storageUrl: att.storageUrl,
        }));
        if (attachmentData.length > 0) {
          await db.insert(discussionAttachments).values(attachmentData);
        }
      }

      res.status(201).json(reply);
    } catch (err: any) {
      console.error("Post reply failed:", err);
      res.status(500).json({ error: "Failed to post reply" });
    }
  });

  /* ===============================
      PROJECT ANALYTICS (REAL DATA)
  ================================ */
  app.get("/api/analytics/projects", requireAuth, async (req: any, res) => {
    try {
      // 1. Fetch all core data in parallel
      const [
        allProjects,
        allEmployees,
        allTasks,
        allTeamMembers,
        allTaskMemberRows,
        allTickets,
        allProgressLogs,
        allKeyStepsRows
      ] = await Promise.all([
        db.select().from(projects),
        db.select().from(employees),
        db.select().from(projectTasks),
        db.select({
          projectId: projectTeamMembers.projectId,
          employeeId: projectTeamMembers.employeeId,
          empName: employees.name,
          empCode: employees.empCode,
          empDepartment: employees.department,
          empEmail: employees.email,
        }).from(projectTeamMembers)
          .innerJoin(employees, eq(projectTeamMembers.employeeId, employees.id)),
        db.select().from(taskMembers),
        db.select().from(tickets),
        db.select().from(progressLogs).orderBy(desc(progressLogs.updatedAt)),
        db.select().from(keySteps),
      ]);

      // 2. Index data for fast lookups
      const employeeMap = new Map(allEmployees.map(e => [e.id, e]));
      const tasksByProject: Record<string, any[]> = {};
      const teamByProject: Record<string, any[]> = {};
      const taskMembersByTask: Record<string, string[]> = {};
      const ticketsByProject: Record<string, any[]> = {};
      const progressByProject: Record<string, any[]> = {};
      const keyStepsByProject: Record<string, any[]> = {};

      allTasks.forEach(t => {
        const pid = t.projectId;
        if (!tasksByProject[pid]) tasksByProject[pid] = [];
        tasksByProject[pid].push(t);
      });

      allTeamMembers.forEach(m => {
        const pid = m.projectId;
        if (!teamByProject[pid]) teamByProject[pid] = [];
        teamByProject[pid].push(m);
      });

      allTaskMemberRows.forEach(tm => {
        if (!taskMembersByTask[tm.taskId]) taskMembersByTask[tm.taskId] = [];
        taskMembersByTask[tm.taskId].push(tm.employeeId);
      });

      allTickets.forEach(t => {
        if (t.projectId) {
          if (!ticketsByProject[t.projectId]) ticketsByProject[t.projectId] = [];
          ticketsByProject[t.projectId].push(t);
        }
      });

      allProgressLogs.forEach(pl => {
        if (pl.projectId) {
          if (!progressByProject[pl.projectId]) progressByProject[pl.projectId] = [];
          progressByProject[pl.projectId].push(pl);
        }
      });

      allKeyStepsRows.forEach(ks => {
        if (!keyStepsByProject[ks.projectId]) keyStepsByProject[ks.projectId] = [];
        keyStepsByProject[ks.projectId].push(ks);
      });

      // 3. Build analytics for each project
      const projectAnalytics = allProjects.map(proj => {
        const projTasks = tasksByProject[proj.id] || [];
        const projTeam = teamByProject[proj.id] || [];
        const projTickets = ticketsByProject[proj.id] || [];
        const projProgress = progressByProject[proj.id] || [];
        const projKeySteps = keyStepsByProject[proj.id] || [];

        // Task statistics
        const totalTasks = projTasks.length;
        const completedTasks = projTasks.filter(t =>
          ["completed", "done", "closed", "finish", "finished"].includes(String(t.status).toLowerCase())
        ).length;
        const pendingTasks = totalTasks - completedTasks;
        const delayedTasks = projTasks.filter(t => {
          if (!t.endDate) return false;
          const isPast = new Date(t.endDate) < new Date();
          const isComplete = ["completed", "done", "closed", "finish", "finished"].includes(String(t.status).toLowerCase());
          return (isPast && !isComplete) || (t.completedAt && new Date(t.completedAt) > new Date(t.endDate));
        }).length;
        const completionPct = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

        // Key step statistics
        const totalKeySteps = projKeySteps.length;
        const completedKeySteps = projKeySteps.filter(ks =>
          ["completed", "done", "closed"].includes(String(ks.status).toLowerCase())
        ).length;

        // Ticket statistics
        const openTickets = projTickets.filter(t => t.status === "Open" || t.status === "In Progress").length;
        const resolvedTickets = projTickets.filter(t => t.status === "Resolved" || t.status === "Closed").length;

        // Employee contributions - REAL data from taskMembers
        const employeeTaskMap: Record<string, { assigned: number; completed: number; inProgress: number; taskIds: string[] }> = {};

        projTasks.forEach(task => {
          const memberIds = taskMembersByTask[task.id] || [];
          // Also include the assigner/creator
          const allInvolved = Array.from(new Set([...memberIds, task.assignerId].filter(Boolean)));

          allInvolved.forEach(empId => {
            if (!employeeTaskMap[empId]) {
              employeeTaskMap[empId] = { assigned: 0, completed: 0, inProgress: 0, taskIds: [] };
            }
            employeeTaskMap[empId].assigned++;
            employeeTaskMap[empId].taskIds.push(task.id);
            const status = String(task.status).toLowerCase();
            if (["completed", "done", "closed", "finish", "finished"].includes(status)) {
              employeeTaskMap[empId].completed++;
            } else if (["in-progress", "in progress", "active"].includes(status)) {
              employeeTaskMap[empId].inProgress++;
            }
          });
        });

        // Build employee logs from REAL team members + task data
        const employeeLogs = projTeam.map(member => {
          const empData = employeeTaskMap[member.employeeId] || { assigned: 0, completed: 0, inProgress: 0, taskIds: [] };
          const completionRate = empData.assigned > 0 ? Math.round((empData.completed / empData.assigned) * 100) : 0;

          return {
            id: member.employeeId,
            name: member.empName,
            empCode: member.empCode || "N/A",
            department: member.empDepartment || "Unassigned",
            email: member.empEmail || "",
            tasksAssigned: empData.assigned,
            tasksCompleted: empData.completed,
            tasksInProgress: empData.inProgress,
            completionRate,
          };
        });

        // Also include task assignees who are NOT in projectTeamMembers
        const teamMemberIds = new Set(projTeam.map(m => m.employeeId));
        Object.entries(employeeTaskMap).forEach(([empId, data]) => {
          if (!teamMemberIds.has(empId)) {
            const emp = employeeMap.get(empId);
            if (emp) {
              employeeLogs.push({
                id: empId,
                name: emp.name,
                empCode: emp.empCode || "N/A",
                department: emp.department || "Unassigned",
                email: emp.email || "",
                tasksAssigned: data.assigned,
                tasksCompleted: data.completed,
                tasksInProgress: data.inProgress,
                completionRate: data.assigned > 0 ? Math.round((data.completed / data.assigned) * 100) : 0,
              });
            }
          }
        });

        // Sort by tasks assigned descending
        employeeLogs.sort((a, b) => b.tasksAssigned - a.tasksAssigned);

        // Health score based on REAL metrics
        const healthScore = Math.max(0, Math.min(100, Math.round(
          (completionPct * 0.5) +
          ((totalTasks > 0 ? Math.max(0, 100 - (delayedTasks / totalTasks) * 100) : 100) * 0.3) +
          ((projTickets.length > 0 ? Math.max(0, 100 - (openTickets / projTickets.length) * 100) : 100) * 0.2)
        )));
        const healthCategory = healthScore >= 85 ? "Excellent" : healthScore >= 65 ? "Good" : healthScore >= 40 ? "Risk" : "Critical";

        // Daily activity timeline from real progress logs and task dates
        const dailyActivity: Record<string, { tasksCreated: number; tasksCompleted: number; progressUpdates: number }> = {};

        projTasks.forEach(task => {
          if (task.createdAt) {
            const day = new Date(task.createdAt).toISOString().split("T")[0];
            if (!dailyActivity[day]) dailyActivity[day] = { tasksCreated: 0, tasksCompleted: 0, progressUpdates: 0 };
            dailyActivity[day].tasksCreated++;
          }
          if (task.completedAt) {
            const day = new Date(task.completedAt).toISOString().split("T")[0];
            if (!dailyActivity[day]) dailyActivity[day] = { tasksCreated: 0, tasksCompleted: 0, progressUpdates: 0 };
            dailyActivity[day].tasksCompleted++;
          }
        });

        projProgress.forEach(pl => {
          if (pl.updatedAt) {
            const day = new Date(pl.updatedAt).toISOString().split("T")[0];
            if (!dailyActivity[day]) dailyActivity[day] = { tasksCreated: 0, tasksCompleted: 0, progressUpdates: 0 };
            dailyActivity[day].progressUpdates++;
          }
        });

        // Convert to sorted array (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const activityTimeline = Object.entries(dailyActivity)
          .filter(([date]) => new Date(date) >= thirtyDaysAgo)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, data]) => ({ date, ...data }));

        return {
          projectId: proj.id,
          projectName: proj.title,
          projectCode: proj.projectCode,
          clientName: proj.clientName || "",
          description: proj.description || "",
          startDate: proj.startDate,
          endDate: proj.endDate,
          status: proj.status,
          progress: proj.progress,
          createdAt: proj.createdAt,
          completedAt: proj.completedAt,
          totalTasks,
          completedTasks,
          pendingTasks,
          delayedTasks,
          completionPct,
          totalKeySteps,
          completedKeySteps,
          totalTickets: projTickets.length,
          openTickets,
          resolvedTickets,
          teamCount: employeeLogs.length,
          healthScore,
          healthCategory,
          employeeLogs,
          activityTimeline,
        };
      });

      res.json(projectAnalytics);
    } catch (err: any) {
      console.error("[ANALYTICS] Failed to fetch project analytics:", err);
      res.status(500).json({ error: "Failed to fetch analytics", details: String(err) });
    }
  });

  return httpServer;
}
