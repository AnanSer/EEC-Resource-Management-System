import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

let customTransporter: Transporter | null = null;

/**
 * Override the default nodemailer transporter (used for testing / mocking)
 */
export function setMailTransporter(transporter: Transporter | null): void {
  customTransporter = transporter;
}

/**
 * Create or return the configured nodemailer transporter using environment variables
 */
export function getMailTransporter(): Transporter {
  if (customTransporter) {
    return customTransporter;
  }

  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = port === 465; // Port 465 is implicit TLS; Port 587 uses STARTTLS
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
    tls: {
      // Reject unauthorized in production; require TLS
      rejectUnauthorized: process.env.NODE_ENV === 'production',
    },
  });
}

export interface PasswordResetEmailOptions {
  to: string;
  recipientName: string;
  resetUrl: string;
  expiresInMinutes: number;
}

/**
 * Send a professional, corporate-branded password reset email via Nodemailer
 */
export async function sendPasswordResetEmail(options: PasswordResetEmailOptions): Promise<void> {
  const { to, recipientName, resetUrl, expiresInMinutes } = options;
  const from = process.env.EMAIL_FROM || 'Ethiopian Engineering Corporation <ananserbesa@gmail.com>';
  const subject = 'EEC RMS — Password Reset Request';

  const text = `Ethiopian Engineering Corporation (EEC)
Resource Management System (RMS)

Hello ${recipientName},

We received a request to reset the password for your EEC RMS account.
Please use the following secure link to reset your password within ${expiresInMinutes} minutes:

${resetUrl}

If you did not request this password reset, please disregard this email. Your account credentials remain secure and no changes have been made.

For security reasons, this link will expire in ${expiresInMinutes} minutes and can only be used once.

---
Ethiopian Engineering Corporation (EEC)
Enterprise Resource Management & IT Governance
This is an automated system notification. Please do not reply directly to this email.`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 580px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03); border: 1px solid #e2e8f0;">
          <!-- Header Banner -->
          <tr>
            <td style="background-color: #006633; padding: 28px 32px; text-align: left;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">
                      ETHIOPIAN ENGINEERING CORPORATION
                    </div>
                    <div style="font-size: 11px; font-weight: 600; color: #bbf7d0; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px;">
                      Resource Management System (RMS)
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 36px 32px 28px 32px;">
              <h1 style="margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #0f172a; line-height: 1.4;">
                Password Reset Request
              </h1>
              <p style="margin: 0 0 20px 0; font-size: 14px; line-height: 1.6; color: #334155;">
                Hello <strong>${recipientName}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; line-height: 1.6; color: #334155;">
                We received a request to reset the password for your EEC RMS account (<code>${to}</code>). To set a new password, click the button below:
              </p>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" style="margin: 28px 0;">
                <tr>
                  <td align="center" style="border-radius: 10px; background-color: #006633;">
                    <a href="${resetUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; font-size: 14px; font-weight: 700; color: #ffffff; text-decoration: none; border-radius: 10px; background-color: #006633; letter-spacing: 0.3px;">
                      Reset Your Password &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry Alert Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fefce8; border: 1px solid #fef08a; border-radius: 8px; margin: 24px 0 20px 0;">
                <tr>
                  <td style="padding: 14px 18px;">
                    <div style="font-size: 12px; font-weight: 700; color: #854d0e; margin-bottom: 2px;">
                      ⏳ Security Notice: Link Expires in ${expiresInMinutes} Minutes
                    </div>
                    <div style="font-size: 12px; color: #713f12; line-height: 1.5;">
                      This link can only be used once. If it expires before you complete the reset, you will need to request a new link.
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Fallback Direct URL -->
              <p style="margin: 20px 0 8px 0; font-size: 12px; line-height: 1.5; color: #64748b;">
                If the button above does not work, copy and paste this secure URL directly into your browser:
              </p>
              <p style="margin: 0 0 24px 0; font-size: 11px; word-break: break-all; color: #0284c7; background-color: #f8fafc; padding: 10px 12px; border-radius: 6px; border: 1px solid #e2e8f0;">
                ${resetUrl}
              </p>

              <!-- Warning Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 20px 0 0 0;">
                <tr>
                  <td style="padding: 14px 18px;">
                    <div style="font-size: 12px; font-weight: 600; color: #475569;">
                      Didn't request this reset?
                    </div>
                    <div style="font-size: 12px; color: #64748b; line-height: 1.5; margin-top: 2px;">
                      If you did not initiate this request, you can safely ignore this email. Your current password remains unchanged and secure.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
              <div style="font-size: 11px; color: #64748b; line-height: 1.5;">
                &copy; ${new Date().getFullYear()} Ethiopian Engineering Corporation. All rights reserved.
              </div>
              <div style="font-size: 10px; color: #94a3b8; margin-top: 4px;">
                Enterprise Resource Management System &bull; IT Governance &bull; Confidential
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const transporter = getMailTransporter();
  await transporter.sendMail({
    from,
    to,
    subject,
    text,
    html,
  });
}

