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

// Brand colors
const BRAND_PRIMARY = '#C9A227'; // Gold/amber accent
const BRAND_DARK = '#1a1a1b';
const BRAND_TEXT = '#2d2d2d';
const BRAND_MUTED = '#6b7280';

// Logo URL (hosted on Firebase Storage)
const LOGO_URL = 'https://storage.googleapis.com/dicode-software.firebasestorage.app/public/dicode_logo.png';

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
 * Professional light theme with gold accents
 */
function generateEmailTemplate(content: string, options?: { showLogo?: boolean }): string {
  const showLogo = options?.showLogo !== false;
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="X-UA-Compatible" content="IE=edge">
      <title>DiCode</title>
      <!--[if mso]>
      <noscript>
        <xml>
          <o:OfficeDocumentSettings>
            <o:PixelsPerInch>96</o:PixelsPerInch>
          </o:OfficeDocumentSettings>
        </xml>
      </noscript>
      <![endif]-->
      <style>
        /* Reset */
        body, table, td, p, a, li, blockquote {
          -webkit-text-size-adjust: 100%;
          -ms-text-size-adjust: 100%;
        }
        table, td {
          mso-table-lspace: 0pt;
          mso-table-rspace: 0pt;
        }
        img {
          -ms-interpolation-mode: bicubic;
          border: 0;
          height: auto;
          line-height: 100%;
          outline: none;
          text-decoration: none;
        }
        
        /* Base Styles */
        body {
          font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
          margin: 0;
          padding: 0;
          width: 100%;
          background-color: #f8f9fa;
          -webkit-font-smoothing: antialiased;
        }
        
        .email-wrapper {
          width: 100%;
          background-color: #f8f9fa;
          padding: 40px 20px;
        }
        
        .email-container {
          max-width: 560px;
          margin: 0 auto;
          background-color: #ffffff;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
        }
        
        /* Header */
        .email-header {
          padding: 32px 40px;
          border-bottom: 1px solid #f0f0f0;
        }
        
        .logo-container {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        
        .logo-icon {
          width: 36px;
          height: 36px;
        }
        
        .logo-text {
          font-size: 22px;
          font-weight: 700;
          color: ${BRAND_DARK};
          letter-spacing: -0.5px;
        }
        
        /* Content */
        .email-content {
          padding: 40px;
        }
        
        .email-content h2 {
          margin: 0 0 24px 0;
          font-size: 24px;
          font-weight: 600;
          color: ${BRAND_TEXT};
          line-height: 1.3;
          letter-spacing: -0.3px;
        }
        
        .email-content p {
          margin: 0 0 16px 0;
          font-size: 15px;
          line-height: 1.7;
          color: ${BRAND_MUTED};
        }
        
        .email-content p:last-child {
          margin-bottom: 0;
        }
        
        .email-content strong {
          color: ${BRAND_TEXT};
          font-weight: 600;
        }
        
        .highlight-box {
          background-color: #fafafa;
          border-left: 3px solid ${BRAND_PRIMARY};
          padding: 16px 20px;
          margin: 24px 0;
          border-radius: 0 8px 8px 0;
        }
        
        .highlight-box p {
          margin: 0;
          font-size: 14px;
          color: ${BRAND_TEXT};
        }
        
        /* Button */
        .button-container {
          margin: 32px 0;
        }
        
        .button {
          display: inline-block;
          padding: 14px 28px;
          background-color: ${BRAND_PRIMARY};
          color: #ffffff !important;
          text-decoration: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.3px;
          transition: background-color 0.2s;
        }
        
        .button:hover {
          background-color: #b8922a;
        }
        
        .link-fallback {
          margin-top: 16px;
          font-size: 12px;
          color: ${BRAND_MUTED};
          word-break: break-all;
        }
        
        .link-fallback a {
          color: ${BRAND_PRIMARY};
          text-decoration: none;
        }
        
        /* Divider */
        .divider {
          height: 1px;
          background-color: #f0f0f0;
          margin: 32px 0;
        }
        
        /* Footer */
        .email-footer {
          padding: 24px 40px 32px;
          background-color: #fafafa;
          border-top: 1px solid #f0f0f0;
        }
        
        .footer-content {
          text-align: center;
        }
        
        .footer-content p {
          margin: 0 0 8px 0;
          font-size: 13px;
          color: ${BRAND_MUTED};
          line-height: 1.5;
        }
        
        .footer-content p:last-child {
          margin-bottom: 0;
        }
        
        .footer-links {
          margin-top: 16px;
        }
        
        .footer-links a {
          color: ${BRAND_MUTED};
          text-decoration: none;
          font-size: 12px;
          margin: 0 12px;
        }
        
        .footer-links a:hover {
          color: ${BRAND_PRIMARY};
        }
        
        /* Badge */
        .badge {
          display: inline-block;
          padding: 4px 10px;
          background-color: #f0fdf4;
          color: #16a34a;
          font-size: 12px;
          font-weight: 600;
          border-radius: 100px;
          letter-spacing: 0.2px;
        }
        
        .badge.warning {
          background-color: #fef3c7;
          color: #d97706;
        }
        
        /* Signature */
        .signature {
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid #f0f0f0;
        }
        
        .signature p {
          font-size: 14px;
          color: ${BRAND_MUTED};
          margin: 0;
        }
        
        .signature .name {
          font-weight: 600;
          color: ${BRAND_TEXT};
        }
        
        /* Responsive */
        @media only screen and (max-width: 600px) {
          .email-wrapper {
            padding: 20px 16px;
          }
          .email-header,
          .email-content,
          .email-footer {
            padding-left: 24px;
            padding-right: 24px;
          }
          .email-content h2 {
            font-size: 20px;
          }
        }
      </style>
    </head>
    <body>
      <div class="email-wrapper">
        <div class="email-container">
          <!-- Header -->
          <div class="email-header">
            <table cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="vertical-align: middle; padding-right: 12px;">
                  ${showLogo ? `
                  <img src="${LOGO_URL}" alt="DiCode" width="40" height="40" style="display: block; border-radius: 8px;" />
                  ` : ''}
                </td>
                <td style="vertical-align: middle;">
                  <span class="logo-text">DiCode</span>
                </td>
              </tr>
            </table>
          </div>
          
          <!-- Content -->
          <div class="email-content">
            ${content}
          </div>
          
          <!-- Footer -->
          <div class="email-footer">
            <div class="footer-content">
              <p>This is an automated message from DiCode.</p>
              <p>If you have questions, please contact your organization administrator.</p>
              <div class="footer-links">
                <a href="#">Privacy Policy</a>
                <a href="#">Terms of Service</a>
                <a href="#">Help Center</a>
              </div>
            </div>
          </div>
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
    <h2>You've been invited to a new learning campaign</h2>
    <p>Hi <strong>${recipientName}</strong>,</p>
    <p>Your organization has enrolled you in a new learning experience designed to help you develop important skills and contribute to your professional growth.</p>
    
    <div class="highlight-box">
      <p><strong>Campaign:</strong> ${campaignTitle}</p>
    </div>
    
    <div class="button-container">
      <a href="${campaignUrl}" class="button">Start Campaign</a>
    </div>
    
    <p class="link-fallback">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${campaignUrl}">${campaignUrl}</a>
    </p>
    
    <div class="signature">
      <p>Best regards,</p>
      <p class="name">The DiCode Team</p>
    </div>
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
    <p>Hi <strong>${recipientName}</strong>,</p>
    <p>This is a friendly reminder that you have an incomplete learning campaign. Taking a few minutes to continue will help you stay on track with your professional development.</p>
    
    <div class="highlight-box">
      <p><strong>Campaign:</strong> ${campaignTitle}</p>
      <p style="margin-top: 8px;"><span class="badge warning">In Progress</span></p>
    </div>
    
    <div class="button-container">
      <a href="${campaignUrl}" class="button">Continue Campaign</a>
    </div>
    
    <p class="link-fallback">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${campaignUrl}">${campaignUrl}</a>
    </p>
    
    <div class="signature">
      <p>Best regards,</p>
      <p class="name">The DiCode Team</p>
    </div>
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
    <h2>Congratulations on completing your campaign! 🎉</h2>
    <p>Hi <strong>${recipientName}</strong>,</p>
    <p>Great work! You've successfully completed the learning campaign. Your responses have been recorded and will contribute to valuable insights for your organization.</p>
    
    <div class="highlight-box">
      <p><strong>Campaign:</strong> ${campaignTitle}</p>
      <p style="margin-top: 8px;"><span class="badge">Completed</span></p>
    </div>
    
    <p>Keep up the excellent work in your professional development journey. Your commitment to growth is what makes organizations thrive.</p>
    
    <div class="signature">
      <p>Best regards,</p>
      <p class="name">The DiCode Team</p>
    </div>
  `;

  await sendEmail({
    to: recipientEmail,
    subject: `Campaign Completed: ${campaignTitle}`,
    html: generateEmailTemplate(content),
  });
}

/**
 * Send employee invitation email (for onboarding)
 */
export async function sendEmployeeInviteEmail(
  recipientEmail: string,
  recipientName: string,
  organizationName: string,
  inviteUrl: string,
  inviterName?: string
): Promise<void> {
  const content = `
    <h2>You've been invited to join ${organizationName}</h2>
    <p>Hi <strong>${recipientName}</strong>,</p>
    <p>${inviterName ? `<strong>${inviterName}</strong> has invited you` : 'You have been invited'} to join <strong>${organizationName}</strong> on DiCode — a platform for professional development and learning.</p>
    
    <div class="highlight-box">
      <p><strong>Organization:</strong> ${organizationName}</p>
    </div>
    
    <p>Click the button below to set up your account and get started:</p>
    
    <div class="button-container">
      <a href="${inviteUrl}" class="button">Accept Invitation</a>
    </div>
    
    <p class="link-fallback">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${inviteUrl}">${inviteUrl}</a>
    </p>
    
    <p style="margin-top: 24px; font-size: 13px; color: #9ca3af;">This invitation link will expire in 7 days.</p>
    
    <div class="signature">
      <p>Best regards,</p>
      <p class="name">The DiCode Team</p>
    </div>
  `;

  await sendEmail({
    to: recipientEmail,
    subject: `You're invited to join ${organizationName} on DiCode`,
    html: generateEmailTemplate(content),
  });
}

/**
 * Send password reset email
 */
export async function sendPasswordResetEmail(
  recipientEmail: string,
  recipientName: string,
  resetUrl: string
): Promise<void> {
  const content = `
    <h2>Reset your password</h2>
    <p>Hi <strong>${recipientName}</strong>,</p>
    <p>We received a request to reset your DiCode account password. Click the button below to create a new password:</p>
    
    <div class="button-container">
      <a href="${resetUrl}" class="button">Reset Password</a>
    </div>
    
    <p class="link-fallback">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${resetUrl}">${resetUrl}</a>
    </p>
    
    <div class="divider"></div>
    
    <p style="font-size: 13px; color: #9ca3af;">If you didn't request a password reset, you can safely ignore this email. This link will expire in 1 hour.</p>
    
    <div class="signature">
      <p>Best regards,</p>
      <p class="name">The DiCode Team</p>
    </div>
  `;

  await sendEmail({
    to: recipientEmail,
    subject: 'Reset your DiCode password',
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
