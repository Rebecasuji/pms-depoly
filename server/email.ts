import { Resend } from 'resend';

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';

/**
 * Role-based email templates for Task Assignment
 */
/**
 * Role-based email templates for PMS System
 */
export const getPMSEmailTemplate = (data: {
  heading: string;
  employeeName: string;
  employeeCode: string;
  projectName: string;
  assignerName: string;
  dueDate: string;
  taskName: string;
  priority: string;
  startDate: string;
  endDate: string;
  status: string;
  taskUrl: string;
  role: 'employee' | 'hr' | 'admin';
}) => {
  const {
    heading,
    employeeName,
    employeeCode,
    projectName,
    assignerName,
    dueDate,
    taskName,
    priority,
    startDate,
    endDate,
    status,
    taskUrl,
    role
  } = data;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heading}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f6f9; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#f4f6f9">
    <tr>
      <td align="center" style="padding: 20px 0;">
        <!-- Outer Wrapper Table -->
        <table border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #ffffff; border-radius: 8px; border: 1px solid #e5e7eb; overflow: hidden; border-collapse: separate;">
          
          <!-- Header Section -->
          <tr>
            <td bgcolor="#0f172a" style="padding: 20px; text-align: left;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">PMS</h1>
              <p style="margin: 0; color: #94a3b8; font-size: 14px;">Project Management System</p>
            </td>
          </tr>

          <!-- Title Section -->
          <tr>
            <td style="padding: 20px; text-align: left; border-bottom: 1px solid #e5e7eb;">
              <h2 style="margin: 0; color: #0f172a; font-size: 20px; font-weight: bold;">${heading}</h2>
            </td>
          </tr>

          <!-- Employee Information Table Section -->
          <tr>
            <td style="padding: 20px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #e5e7eb; border-radius: 4px; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; width: 40%; color: #4b5563;">Employee Name</td>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #1f2937;">${employeeName}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #4b5563;">Employee Code</td>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #1f2937;">${employeeCode}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #4b5563;">Project</td>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #1f2937;">${projectName}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; font-weight: bold; color: #4b5563;">Assigned By</td>
                  <td style="padding: 10px; border-bottom: 1px solid #e5e7eb; color: #1f2937;">${assignerName}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; font-weight: bold; color: #4b5563;">Due Date</td>
                  <td style="padding: 10px; color: #1f2937;">${dueDate}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Task Details Table Section -->
          <tr>
            <td style="padding: 0 20px 20px 20px;">
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border: 1px solid #e5e7eb; border-radius: 4px; border-collapse: collapse;">
                <thead>
                  <tr bgcolor="#e2e8f0">
                    <th style="padding: 12px 10px; text-align: left; font-weight: bold; color: #0f172a; border-bottom: 1px solid #cbd5e1;">Task Name</th>
                    <th style="padding: 12px 10px; text-align: center; font-weight: bold; color: #0f172a; border-bottom: 1px solid #cbd5e1;">Priority</th>
                    <th style="padding: 12px 10px; text-align: center; font-weight: bold; color: #0f172a; border-bottom: 1px solid #cbd5e1;">Start Date</th>
                    <th style="padding: 12px 10px; text-align: center; font-weight: bold; color: #0f172a; border-bottom: 1px solid #cbd5e1;">End Date</th>
                    <th style="padding: 12px 10px; text-align: center; font-weight: bold; color: #0f172a; border-bottom: 1px solid #cbd5e1;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding: 12px 10px; text-align: left; color: #1f2937; border-bottom: 1px solid #e5e7eb;">${taskName}</td>
                    <td style="padding: 12px 10px; text-align: center; color: #1f2937; border-bottom: 1px solid #e5e7eb;">${priority}</td>
                    <td style="padding: 12px 10px; text-align: center; color: #1f2937; border-bottom: 1px solid #e5e7eb;">${startDate}</td>
                    <td style="padding: 12px 10px; text-align: center; color: #1f2937; border-bottom: 1px solid #e5e7eb;">${endDate}</td>
                    <td style="padding: 12px 10px; text-align: center; color: #1f2937; border-bottom: 1px solid #e5e7eb;">${status}</td>
                  </tr>
                  ${role === 'hr' ? `
                  <tr>
                    <td colspan="5" style="padding: 12px 10px; background-color: #f8fafc; color: #475569; font-size: 13px;">
                      <strong>Department Summary:</strong> Multiple tasks pending in completion for this period.
                    </td>
                  </tr>` : ''}
                  ${role === 'admin' ? `
                  <tr>
                    <td colspan="5" style="padding: 12px 10px; background-color: #fff7ed; color: #9a3412; font-size: 13px;">
                      <strong>System Activity:</strong> High priority task assigned across multiple departments.
                    </td>
                  </tr>` : ''}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Action Button Row -->
          ${role === 'employee' ? `
          <tr>
            <td style="padding: 10px 20px 30px 20px; text-align: center;">
              <table align="center" border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td bgcolor="#2563eb" style="padding: 12px 24px; border-radius: 4px;">
                    <a href="${taskUrl}" style="color: #ffffff; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
                      View Task
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>` : ''}

          <!-- Footer Section -->
          <tr>
            <td bgcolor="#f1f5f9" style="padding: 20px; text-align: center;">
              <p style="margin: 0; color: #64748b; font-size: 12px;">This is an automated notification from PMS.</p>
              <p style="margin: 5px 0 0 0; color: #64748b; font-size: 12px;">Do not reply to this email.</p>
              <p style="margin: 15px 0 0 0; color: #94a3b8; font-size: 11px;">&copy; ${new Date().getFullYear()} Antigravity PMS.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};


/**
 * Send task assignment email
 */
export async function sendTaskAssignmentEmail(
  to: string,
  employeeData: {
    name: string;
    code: string;
    project: string;
    assigner: string;
    dueDate: string;
  },
  taskData: {
    name: string;
    priority: string;
    startDate: string;
    endDate: string;
    status: string;
  },
  role: 'employee' | 'hr' | 'admin' = 'employee'
) {
  if (!to) {
    console.warn(`[EMAIL] Skipping notification: No email address for ${employeeData.name}`);
    return;
  }

  try {
    const taskUrl = `${process.env.APP_URL || 'http://localhost:5000'}/tasks`;
    const heading = "New Task Assigned";

    const html = getPMSEmailTemplate({
      heading,
      employeeName: employeeData.name,
      employeeCode: employeeData.code,
      projectName: employeeData.project,
      assignerName: employeeData.assigner,
      dueDate: employeeData.dueDate,
      taskName: taskData.name,
      priority: taskData.priority,
      startDate: taskData.startDate,
      endDate: taskData.endDate,
      status: taskData.status,
      taskUrl,
      role
    });

    const subjectPrefix = role === 'admin' ? '🔐 [Admin Assignment]' : role === 'hr' ? '📋 [HR Update]' : '📅 [New Task]';
    const subject = `${subjectPrefix} ${taskData.name} - ${employeeData.project}`;

    console.log(`[EMAIL] Preparing to send notification to: ${to} (Role: ${role})`);

    const { data, error } = await resend.emails.send({
      from: `PMS Notifications <${FROM_EMAIL}>`,
      to: [to],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error(`[EMAIL] Resend Error for ${to}:`, error);
      return;
    }

    console.log(`[EMAIL] Notification sent to ${to}. ID: ${data?.id}`);
  } catch (err) {
    console.error(`[EMAIL] Unexpected failure for recipient ${to}:`, err);
  }
}


/**
 * Send subtask assignment email
 */
export async function sendSubtaskAssignmentEmail(
  to: string,
  employeeData: {
    name: string;
    code: string;
    project: string;
    assigner: string;
    dueDate: string;
  },
  subtaskData: {
    name: string;
    priority: string;
    startDate: string;
    endDate: string;
    status: string;
    parentTaskName: string;
  },
  role: 'employee' | 'hr' | 'admin' = 'employee'
) {
  if (!to) {
    console.warn(`[EMAIL] Skipping subtask notification: No email address for ${employeeData.name}`);
    return;
  }

  try {
    const taskUrl = `${process.env.APP_URL || 'http://localhost:5000'}/tasks`;
    const heading = `New Subtask: ${subtaskData.name}`;

    const html = getPMSEmailTemplate({
      heading,
      employeeName: employeeData.name,
      employeeCode: employeeData.code,
      projectName: employeeData.project,
      assignerName: employeeData.assigner,
      dueDate: employeeData.dueDate,
      taskName: `${subtaskData.name} (Parent: ${subtaskData.parentTaskName})`,
      priority: subtaskData.priority,
      startDate: subtaskData.startDate,
      endDate: subtaskData.endDate,
      status: subtaskData.status,
      taskUrl,
      role
    });

    const subjectPrefix = role === 'admin' ? '🔐 [Admin Subtask]' : role === 'hr' ? '📋 [HR Subtask]' : '📅 [New Subtask]';
    const subject = `${subjectPrefix} ${subtaskData.name} - ${employeeData.project}`;

    console.log(`[EMAIL] Preparing to send subtask notification to: ${to} (Role: ${role})`);

    const { data, error } = await resend.emails.send({
      from: `PMS Notifications <${FROM_EMAIL}>`,
      to: [to],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error(`[EMAIL] Resend Error for ${to}:`, error);
      return;
    }

    console.log(`[EMAIL] Subtask notification sent to ${to}. ID: ${data?.id}`);
  } catch (err) {
    console.error(`[EMAIL] Unexpected failure for recipient ${to}:`, err);
  }
}

/**
 * Send project completion alert to admins
 */
export async function sendProjectCompletionEmail(
  to: string,
  projectData: {
    title: string;
    projectCode: string;
    clientName: string;
    startDate: string;
    endDate: string;
    progress: number;
    assigner: string;
    employeeName?: string;
    employeeCode?: string;
  }
) {
  if (!to) {
    console.warn(`[EMAIL] Skipping admin notification: No email address provided`);
    return;
  }

  try {
    const taskUrl = `${process.env.APP_URL || 'http://localhost:5000'}/projects`;
    const heading = `Project Completed: ${projectData.title}`;

    const html = getPMSEmailTemplate({
      heading,
      employeeName: projectData.employeeName || "Administrator",
      employeeCode: projectData.employeeCode || "ADMIN",
      projectName: projectData.title,
      assignerName: projectData.assigner || "System",
      dueDate: projectData.endDate,
      taskName: `Final Status: Project Successfully Completed`,
      priority: "High",
      startDate: projectData.startDate,
      endDate: projectData.endDate,
      status: "Completed",
      taskUrl,
      role: 'admin'
    });

    const subject = `✅ [PROJECT COMPLETED] ${projectData.title} (${projectData.projectCode})`;

    console.log(`[EMAIL] Sending project completion alert to Admin: ${to}`);

    const { data, error } = await resend.emails.send({
      from: `PMS Notifications <${FROM_EMAIL}>`,
      to: [to],
      subject: subject,
      html: html,
    });

    if (error) {
      console.error(`[EMAIL] Resend Error for Admin ${to}:`, error);
      return;
    }

    console.log(`[EMAIL] Admin notification sent. ID: ${data?.id}`);
  } catch (err) {
    console.error(`[EMAIL] Admin notification failed:`, err);
  }
}
