/**
 * SendGrid Email Integration
 *
 * Handles all email sending for campaign invitations, reminders, and confirmations
 *
 * Environment Variable Required:
 * - VITE_SENDGRID_API_KEY: SendGrid API key
 */

const SENDGRID_API_KEY = import.meta.env.VITE_SENDGRID_API_KEY;
const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send';

// Default sender email (should be verified in SendGrid)
const FROM_EMAIL = 'noreply@dicode.com';
const FROM_NAME = 'DiCode';

interface EmailParams {
  to: string;
  subject: string;
  html: string;
}

/**
 * Send email via SendGrid API
 */
async function sendEmail({ to, subject, html }: EmailParams): Promise<void> {
  if (!SENDGRID_API_KEY) {
    console.warn('⚠️ SendGrid API key not configured. Email not sent:', { to, subject });
    return;
  }

  try {
    const response = await fetch(SENDGRID_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: to }],
          },
        ],
        from: {
          email: FROM_EMAIL,
          name: FROM_NAME,
        },
        subject,
        content: [
          {
            type: 'text/html',
            value: html,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SendGrid API error: ${response.status} - ${errorText}`);
    }

    console.log('✅ Email sent successfully:', { to, subject });
  } catch (error) {
    console.error('❌ Failed to send email:', error);
    throw error;
  }
}

/**
 * Generate HTML email template with DiCode branding
 */
function generateEmailTemplate(content: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>DiCode Notification</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
          background-color: #f4f4f4;
        }
        .container {
          max-width: 600px;
          margin: 40px auto;
          background-color: #ffffff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        .header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #ffffff;
          padding: 30px 40px;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 28px;
          font-weight: 600;
        }
        .content {
          padding: 40px;
        }
        .button {
          display: inline-block;
          padding: 14px 32px;
          margin: 20px 0;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #ffffff;
          text-decoration: none;
          border-radius: 6px;
          font-weight: 600;
          transition: transform 0.2s;
        }
        .button:hover {
          transform: translateY(-2px);
        }
        .footer {
          padding: 30px 40px;
          background-color: #f8f9fa;
          text-align: center;
          color: #6c757d;
          font-size: 14px;
        }
        .footer a {
          color: #667eea;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>DiCode</h1>
        </div>
        <div class="content">
          ${content}
        </div>
        <div class="footer">
          <p>This is an automated message from DiCode.</p>
          <p>If you have any questions, please contact your organization administrator.</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Send campaign invitation email
 */
export async function sendInvitationEmail(
  recipientEmail: string,
  recipientName: string,
  campaignTitle: string,
  campaignUrl: string
): Promise<void> {
  const content = `
    <h2>You've been invited to a new learning campaign!</h2>
    <p>Hi ${recipientName},</p>
    <p>Your organization has enrolled you in a new learning campaign: <strong>${campaignTitle}</strong></p>
    <p>This campaign is designed to help you develop important skills and contribute to your professional growth.</p>
    <p>Click the button below to get started:</p>
    <a href="${campaignUrl}" class="button">Start Campaign</a>
    <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
    <p style="color: #667eea; word-break: break-all;">${campaignUrl}</p>
    <p>Best regards,<br>The DiCode Team</p>
  `;

  await sendEmail({
    to: recipientEmail,
    subject: `New Learning Campaign: ${campaignTitle}`,
    html: generateEmailTemplate(content),
  });
}

/**
 * Send campaign reminder email
 */
export async function sendReminderEmail(
  recipientEmail: string,
  recipientName: string,
  campaignTitle: string,
  campaignUrl: string
): Promise<void> {
  const content = `
    <h2>Reminder: Complete your learning campaign</h2>
    <p>Hi ${recipientName},</p>
    <p>This is a friendly reminder that you have an incomplete learning campaign: <strong>${campaignTitle}</strong></p>
    <p>Take a few minutes to continue your learning journey and complete the campaign.</p>
    <p>Click the button below to resume:</p>
    <a href="${campaignUrl}" class="button">Continue Campaign</a>
    <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
    <p style="color: #667eea; word-break: break-all;">${campaignUrl}</p>
    <p>Best regards,<br>The DiCode Team</p>
  `;

  await sendEmail({
    to: recipientEmail,
    subject: `Reminder: ${campaignTitle}`,
    html: generateEmailTemplate(content),
  });
}

/**
 * Send campaign completion confirmation email
 */
export async function sendCompletionEmail(
  recipientEmail: string,
  recipientName: string,
  campaignTitle: string
): Promise<void> {
  const content = `
    <h2>🎉 Congratulations! Campaign Completed</h2>
    <p>Hi ${recipientName},</p>
    <p>Great job! You've successfully completed the learning campaign: <strong>${campaignTitle}</strong></p>
    <p>Your responses have been recorded and will contribute to valuable insights for your organization.</p>
    <p>Keep up the great work in your professional development journey!</p>
    <p>Best regards,<br>The DiCode Team</p>
  `;

  await sendEmail({
    to: recipientEmail,
    subject: `Campaign Completed: ${campaignTitle}`,
    html: generateEmailTemplate(content),
  });
}

/**
 * Check if SendGrid is configured
 */
export function isSendGridConfigured(): boolean {
  return Boolean(SENDGRID_API_KEY);
}

/**
 * Get SendGrid configuration status
 */
export function getSendGridStatus(): { configured: boolean; message: string } {
  if (SENDGRID_API_KEY) {
    return {
      configured: true,
      message: 'SendGrid is configured and ready to send emails',
    };
  }

  return {
    configured: false,
    message: 'SendGrid API key not found. Set VITE_SENDGRID_API_KEY in your environment variables.',
  };
}
