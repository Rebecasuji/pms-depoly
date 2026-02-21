
import fs from 'fs';
import path from 'path';

// Mock values
const employeeName = "John Doe";
const taskName = "Implement Table Email Template";
const assignerName = "Project Manager";
const projectName = "PMS Redesign";
const role = "EMPLOYEE";

const roleColor = '#2563eb';
const roleBg = '#dbeafe';
const isAdmin = false;

const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          .container {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #1e293b;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8fafc;
          }
          .card {
            background: #ffffff;
            border-radius: 12px;
            padding: 32px;
            box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            border: 1px solid #e2e8f0;
          }
          .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 9999px;
            font-size: 12px;
            font-weight: 600;
            background-color: ${roleBg};
            color: ${roleColor};
            margin-bottom: 16px;
          }
          .header {
            font-size: 24px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 24px;
          }
          .details-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
            background: #f1f5f9;
            border-radius: 8px;
            overflow: hidden;
          }
          .details-table td {
            padding: 12px 20px;
            border-bottom: 1px solid #e2e8f0;
          }
          .details-table tr:last-child td {
            border-bottom: none;
          }
          .label {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #64748b;
            width: 30%;
          }
          .value {
            font-size: 14px;
            font-weight: 600;
            color: #0f172a;
          }
          .button {
            display: inline-block;
            background-color: ${roleColor};
            color: #ffffff !important;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 600;
            margin-top: 10px;
          }
          .footer {
            margin-top: 32px;
            padding-top: 24px;
            border-top: 1px solid #e2e8f0;
            font-size: 13px;
            color: #94a3b8;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="badge">${isAdmin ? 'Administrative Task' : 'Task Assignment'}</div>
            <h1 class="header">Hello ${employeeName},</h1>
            <p>
              ${isAdmin
        ? `You have been assigned a management-level task that requires your administrative attention.`
        : `A new task has been assigned to you by <strong>${assignerName}</strong>.`
    }
            </p>
            
            <table class="details-table">
              <tr>
                <td class="label">Project</td>
                <td class="value">${projectName}</td>
              </tr>
              <tr>
                <td class="label">Task Title</td>
                <td class="value">${taskName}</td>
              </tr>
              <tr>
                <td class="label">Assigned By</td>
                <td class="value">${assignerName}</td>
              </tr>
            </table>

            <div style="text-align: center;">
              <a href="#" class="button">View Task Details</a>
            </div>
            
            <div class="footer">
              This is an automated notification from the Project Management System.<br/>
              &copy; ${new Date().getFullYear()} Antigravity PMS.
            </div>
          </div>
        </div>
      </body>
    </html>
`;

fs.writeFileSync('preview_email.html', html);
console.log("Preview generated: preview_email.html");
