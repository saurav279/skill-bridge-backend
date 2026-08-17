import nodemailer from "nodemailer";
import { env } from "../config/env";
import { AppError } from "../utils/errors";
import {
  buildUnsubscribeUrl,
  UnsubscribeService,
} from "./unsubscribe.service";
import { adminOtpEmailTemplate } from "../email-templates/admin-otp";
import { btnLink } from "../email-templates/helpers";

function createTransport() {
  if (!env.smtp.host || !env.smtp.user || !env.smtp.pass) {
    throw new AppError(
      "SMTP is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASS.",
      500,
    );
  }

  return nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure,
    auth: {
      user: env.smtp.user,
      pass: env.smtp.pass,
    },
  });
}

function parseRecipients(to: string): string[] {
  return [
    ...new Set(
      to
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

export async function sendEmail({
  subject,
  body,
  to,
}: {
  subject: string;
  body: string;
  to: string;
}): Promise<void> {
  const recipients = parseRecipients(to);
  if (recipients.length === 0) {
    throw new AppError("No email recipients provided.", 400);
  }

  const transport = createTransport();

  for (const recipient of recipients) {
    if (await UnsubscribeService.isUnsubscribed(recipient)) {
      console.log(
        `[sendEmail]: email is inside unsubscribe, you cannot send email on it (${recipient})`,
      );
      continue;
    }

    try {
      // Avoid sending to the SMTP mailbox itself (loop / bounce risk)
      if (recipient === env.smtp.user.trim().toLowerCase()) {
        console.log(
          `[sendEmail]: smtp email is in the recipients, you cannot send email on it (${recipient})`,
        );
        continue;
      }

      await transport.sendMail({
        from: env.smtp.from,
        to: recipient,
        subject,
        html: createEmailTemplate({ body, subject, to: recipient }),
      });
      console.log(` [sendEmail]:✅  Email sent successfully to ${recipient}`);
    } catch (error) {
      console.log(error);
      throw new AppError(
        `Failed to send assessment email: ${error instanceof Error ? error.message : "unknown error"
        }`,
        500,
      );
    }
  }
}

interface EmailTemplateProps {
  body: string;
  subject?: string;
  to: string;
}

 function createEmailTemplate({
  body,
  subject,
  to,
}: EmailTemplateProps): string {
  const currentYear = new Date().getFullYear();
  const logoUrl =
    "https://res.cloudinary.com/cyqo6b3y/image/upload/v1786507674/image.png";
  const privacyUrl = `${env.frontendUrl}/privacy`;
  const termsUrl = `${env.frontendUrl}/terms`;
  const unsubscribeUrl = buildUnsubscribeUrl(to);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject || "Email"}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f9fafb;
    }
    
    .email-container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
    }
    
    /* Header */
    .email-header {
      background: linear-gradient(135deg, #ffffff 0%, #f3f4f6 100%);
      padding: 32px 24px;
      text-align: center;
      border-bottom: 1px solid #e5e7eb;
    }
    
    .email-logo {
      max-width: 120px;
      height: auto;
      display: inline-block;
    }
    
    /* Main Content */
    .email-body {
      padding: 40px 24px;
      background-color: #ffffff;
    }
    
    .email-body h1,
    .email-body h2,
    .email-body h3,
    .email-body p,
    .email-body div,
    .email-body ul,
    .email-body ol {
      margin-bottom: 16px;
    }
    
    .email-body a {
      color: #3b82f6;
      text-decoration: none;
    }
    
    .email-body a:hover {
      text-decoration: underline;
    }
    
    /* Button styles */
    .email-body button,
    .email-body a.btn {
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      transition: background-color 0.2s, color 0.2s;
    }

    .email-body a.btn-primary {
      background-color: #234FEE !important;
      color: #ffffff !important;
      padding: 14px 36px;
      border: 0;
      border-radius: 999px;
      font-size: 15px;
      font-weight: 600;
      line-height: 1.2;
      text-align: center;
    }

    .email-body a.btn-primary:hover {
      background-color: #234FEE !important;
      color: #ffffff !important;
      text-decoration: none;
    }

    .email-body a.btn-link {
      background-color: transparent !important;
      color: #234FEE !important;
      padding: 0;
      border-radius: 0;
      font-size: 14px;
      font-weight: 500;
    }

    .email-body a.btn-link:hover {
      color: #1F4FE0 !important;
      text-decoration: underline;
    }
    
    /* Footer */
    .email-footer {
      background-color: #f9fafb;
      padding: 32px 24px;
      text-align: center;
      border-top: 1px solid #e5e7eb;
    }
    
    .footer-divider {
      width: 60px;
      height: 2px;
      background-color: #e5e7eb;
      margin: 0 auto 24px;
    }
    
    .footer-links {
      margin-bottom: 24px;
    }
    
    .footer-links a {
      color: #6b7280;
      text-decoration: none;
      font-size: 13px;
      margin: 0 12px;
      display: inline-block;
    }
    
    .footer-links a:hover {
      color: #374151;
      text-decoration: underline;
    }
    
    .footer-text {
      color: #9ca3af;
      font-size: 12px;
      line-height: 1.5;
    }
    
    /* Responsive */
    @media (max-width: 600px) {
      .email-container {
        width: 100%;
      }
      
      .email-header,
      .email-body,
      .email-footer {
        padding-left: 16px;
        padding-right: 16px;
      }
      
      .footer-links a {
        display: block;
        margin: 8px 0;
      }
    }
  </style>
</head>
<body>
  <div class="email-container">
    <!-- Header -->
    <div class="email-header">
      <img src="${logoUrl}" alt="Logo" class="email-logo">
    </div>
    
    <!-- Main Body -->
    <div class="email-body">
      ${body}
      ${createFooterTemplate()}
    </div>

    
    <!-- Footer -->
    <div class="email-footer">
      <div class="footer-divider"></div>
      
      <div class="footer-links">
        <a href="${privacyUrl}">Privacy Policy</a>
        <a href="${termsUrl}">Terms of Use</a>
        <a href="${unsubscribeUrl}">Unsubscribe</a>
      </div>
      
      <div class="footer-text">
        <p>© ${currentYear} Your Company Name. All rights reserved.</p>
        <p>123 Your Street, Your City, State 12345</p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}


function createFooterTemplate(): string {
  return `
  <div class="footer-content">
  <br>
  <br>
  <p>Best Regards,</p>
  ${btnLink(env.frontendUrl, "Skill Bridge", "link")}
  </div>
  `;
}

export async function sendAdminOtpEmail(otp: string): Promise<void> {
  const to = env.admin.otpEmail.trim().toLowerCase();
  if (!to) {
    throw new AppError("Admin OTP recipient is not configured.", 500);
  }

  const transport = createTransport();
  try {
    await transport.sendMail({
      from: env.smtp.from,
      to,
      subject: "Your Skill Bridge admin login code",
      html: `<!DOCTYPE html><html><body>${adminOtpEmailTemplate(otp)}</body></html>`,
    });
    console.log(` [sendAdminOtpEmail]:✅  OTP email sent to ${to}`);
  } catch (error) {
    console.log(error);
    throw new AppError(
      `Failed to send admin OTP email: ${
        error instanceof Error ? error.message : "unknown error"
      }`,
      500,
    );
  }
}