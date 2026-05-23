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
  role: 'employee' | 'hr' | 'admin' = 'employee',
  heading: string = "New Task Assigned"
) {
  if (!to) {
    console.warn(`[EMAIL] Skipping notification: No email address for ${employeeData.name}`);
    return;
  }

  try {
    const taskUrl = `${process.env.APP_URL || 'http://localhost:5000'}/tasks`;

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
/**
 * Send Site Engineer Report email
 */
export async function sendSiteReportEmail(
  to: string,
  reportData: {
    projectName: string;
    taskName: string;
    subtaskName: string;
    notes: string;
    engineerName: string;
  },
  attachments: {
    filename: string;
    content: Buffer | string;
  }[]
) {
  if (!to) {
    console.warn(`[EMAIL] Skipping site report: No recipient email provided`);
    return;
  }

  try {
    const heading = "Site Engineer Report";
    const { projectName, taskName, subtaskName, notes, engineerName } = reportData;

    const html = `
<!DOCTYPE html>
<html>
<body style="font-family: sans-serif; line-height: 1.6; color: #333;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px;">
    <h2 style="color: #2563eb; border-bottom: 2px solid #2563eb; padding-bottom: 10px;">${heading}</h2>
    <p><strong>Project:</strong> ${projectName}</p>
    <p><strong>Task:</strong> ${taskName}</p>
    <p><strong>Subtask:</strong> ${subtaskName}</p>
    <p><strong>Engineer:</strong> ${engineerName}</p>
    <div style="background-color: #f9fafb; padding: 15px; border-radius: 4px; margin: 20px 0;">
      <h3 style="margin-top: 0; font-size: 16px;">Notes:</h3>
      <p style="white-space: pre-wrap;">${notes}</p>
    </div>
    <p style="font-size: 12px; color: #666; margin-top: 30px; border-top: 1px solid #eee; pt: 10px;">
      This report was generated automatically by the PMS System.
    </p>
  </div>
</body>
</html>
    `;

    const recipients = to.split(',').map(e => e.trim()).filter(Boolean);
    console.log(`[EMAIL] Sending Site Report to: ${recipients.join(', ')}`);

    const { data, error } = await resend.emails.send({
      from: `PMS Reports <${FROM_EMAIL}>`,
      to: recipients,
      subject: `Site Report: ${projectName} - ${subtaskName || taskName}`,
      html: html,
      attachments: attachments,
    });

    if (error) {
      console.error(`[EMAIL] Resend Error for ${to}:`, error);
      throw error;
    }

    console.log(`[EMAIL] Site Report sent to ${to}. ID: ${data?.id}`);
    return data;
  } catch (err) {
    console.error(`[EMAIL] Site Report failed for ${to}:`, err);
    throw err;
  }
}

/**
 * Send ticket notification email
 */
export async function sendTicketNotificationEmail(
  to: string | string[],
  ticketData: {
    ticketCode: string;
    title: string;
    category: string;
    priority: string;
    status: string;
    department: string;
    projectName: string;
    description: string;
    createdByName: string;
    assignedToName?: string;
    ccNames?: string;
  },
  type: 'created' | 'updated' | 'completed'
) {
  if (!process.env.RESEND_API_KEY) {
    console.error(`[EMAIL] Missing RESEND_API_KEY in environment variables`);
    return;
  }

  if (!to || (Array.isArray(to) && to.length === 0)) {
    console.warn(`[EMAIL] Skipping ticket notification: No recipients provided`);
    return;
  }

  try {
    const heading = type === 'created' ? "New Support Ticket Raised" : 
                   type === 'completed' ? "Support Ticket Completed" : 
                   "Support Ticket Status Updated";
    
    const recipients = Array.isArray(to) ? to : [to];
    
    const dedupKey = `ticket_${ticketData.ticketCode}_${type}_${recipients.join(',')}_${ticketData.status}`;
    // @ts-ignore
    if (!global.sentEmailsCache) global.sentEmailsCache = new Set<string>();
    // @ts-ignore
    if (global.sentEmailsCache.has(dedupKey)) {
      console.log(`[EMAIL-DEBUG] Duplicate ticket email prevented: ${dedupKey}`);
      return;
    }
    // @ts-ignore
    global.sentEmailsCache.add(dedupKey);
    // @ts-ignore
    setTimeout(() => global.sentEmailsCache.delete(dedupKey), 60 * 1000); // 1 min deduplication
    
    
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heading}</title>
</head>
<body style="font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #334155; background-color: #f1f5f9; margin: 0; padding: 40px 20px;">
  <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1); border: 1px solid #e2e8f0;">
    
    <!-- Professional Header -->
    <div style="background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%); padding: 40px 32px; text-align: center;">
      <div style="display: inline-block; padding: 8px 16px; background-color: rgba(255,255,255,0.1); border-radius: 99px; margin-bottom: 20px;">
        <span style="color: #38bdf8; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em;">Support Console</span>
      </div>
      <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.02em;">Support Ticket Notification</h1>
      <p style="margin: 8px 0 0 0; color: #94a3b8; font-size: 14px;">Reference ID: <span style="color: #ffffff; font-family: monospace;">${ticketData.ticketCode}</span></p>
    </div>

    <div style="padding: 40px 32px;">
      <!-- Main Content Card -->
      <div style="border-bottom: 1px solid #f1f5f9; padding-bottom: 32px; margin-bottom: 32px;">
        <h2 style="margin: 0 0 12px 0; font-size: 20px; color: #0f172a; font-weight: 700;">${ticketData.title}</h2>
        <div style="padding: 24px; background-color: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
          <p style="margin: 0; font-size: 15px; color: #475569; white-space: pre-wrap; line-height: 1.7;">${ticketData.description}</p>
        </div>
      </div>

      <!-- Ticket Metadata Table -->
      <h3 style="font-size: 12px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin: 0 0 16px 0;">Ticket Overview</h3>
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 14px; border-collapse: separate; border-spacing: 0;">
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; width: 40%;">Category</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #1e293b; font-weight: 600;">${ticketData.category}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;">Current Status</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
            <span style="padding: 4px 10px; background-color: #e0f2fe; color: #0369a1; border-radius: 6px; font-weight: 700; font-size: 11px; text-transform: uppercase;">${ticketData.status}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;">Priority Level</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9;">
            <span style="padding: 4px 10px; background-color: ${ticketData.priority === 'Critical' || ticketData.priority === 'High' ? '#fee2e2' : '#fef3c7'}; color: ${ticketData.priority === 'Critical' || ticketData.priority === 'High' ? '#b91c1c' : '#b45309'}; border-radius: 6px; font-weight: 700; font-size: 11px; text-transform: uppercase;">
              ${ticketData.priority}
            </span>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;">Associated Project</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #1e293b;">${ticketData.projectName || 'Internal / General'}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;">Requested By</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #1e293b;">${ticketData.createdByName}</td>
        </tr>
        ${ticketData.assignedToName ? `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;">Assigned Agent</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #1e293b;">${ticketData.assignedToName}</td>
        </tr>` : ''}
        ${ticketData.ccNames ? `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #64748b;">Copied (CC)</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #f1f5f9; color: #1e293b;">${ticketData.ccNames}</td>
        </tr>` : ''}
      </table>
      
      <!-- CTA Button -->
      <div style="margin-top: 48px; text-align: center;">
        <a href="${process.env.APP_URL || 'http://localhost:5000'}/tickets" style="background-color: #0f172a; color: #ffffff; padding: 16px 32px; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 15px; display: inline-block; transition: all 0.2s ease; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          Access Ticket Dashboard
        </a>
      </div>
    </div>
    
    <!-- Professional Footer -->
    <div style="background-color: #f8fafc; padding: 32px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="margin: 0; color: #64748b; font-size: 13px; font-weight: 500;">Sent via Knockturn PMS Automated Notification Service</p>
      <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e2e8f0;">
        <p style="margin: 0; color: #94a3b8; font-size: 12px;">&copy; ${new Date().getFullYear()} Knockturn Private Limited. All security protocols active.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const subject = `${type === 'completed' ? '✅' : '🎫'} [TICKET ${ticketData.ticketCode}] ${ticketData.status}: ${ticketData.title}`;

    console.log(`[EMAIL] Attempting Ticket Notification to: ${recipients.join(', ')} ...`);

    const { data, error } = await resend.emails.send({
      from: `PMS Support <${FROM_EMAIL || 'onboarding@resend.dev'}>`,
      to: recipients,
      subject: subject,
      html: html,
    });

    if (error) {
      console.error(`[EMAIL] Resend Error [Ticket ${ticketData.ticketCode}]:`, JSON.stringify(error, null, 2));
      
      // If domain verification is the issue, try falling back to onboarding@resend.dev as a safety net for sandbox mode
      if (FROM_EMAIL && FROM_EMAIL !== 'onboarding@resend.dev') {
        console.log(`[EMAIL-DEBUG] Retrying with fallback sender onboarding@resend.dev ...`);
        const retry = await resend.emails.send({
          from: `PMS Sandbox <onboarding@resend.dev>`,
          to: recipients,
          subject: subject + " (Retry)",
          html: html,
        });
        if (retry.error) {
          console.error(`[EMAIL-DEBUG] Retry also failed:`, JSON.stringify(retry.error, null, 2));
        } else {
          console.log(`[EMAIL-DEBUG] Retry successful! ID: ${retry.data?.id}`);
          return;
        }
      }
      return;
    }

    console.log(`[EMAIL] Ticket Notification sent successfully. ID: ${data?.id}`);
  } catch (err) {
    console.error(`[EMAIL] Ticket Notification failed:`, err);
  }
}
