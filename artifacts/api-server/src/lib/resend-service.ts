import { Resend } from "resend";

function baseTemplate(title: string, bodyHtml: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
        <tr>
          <td style="background:linear-gradient(135deg,#667eea 0%,#764ba2 100%);padding:28px 32px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;letter-spacing:0.5px;">Job Ops by L&amp;D PRO</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px;">
            <h2 style="color:#1a1a2e;margin:0 0 16px;font-size:20px;font-weight:600;">${title}</h2>
            ${bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #eaeaef;text-align:center;">
            <p style="color:#9ca3af;font-size:12px;margin:0;">
              &copy; ${new Date().getFullYear()} Job Ops by L&amp;D PRO &middot; This is an automated email. Please do not reply.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function buttonHtml(href: string, label: string): string {
  return `<div style="text-align:center;margin:28px 0;"><a href="${href}" style="display:inline-block;background:linear-gradient(135deg,#667eea,#764ba2);color:#ffffff;padding:14px 36px;border-radius:8px;font-weight:600;text-decoration:none;font-size:15px;">${label}</a></div>`;
}

function codeBlock(code: string): string {
  return `<div style="background:#f4f7fa;padding:20px;margin:24px 0;border-radius:8px;text-align:center;"><span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#667eea;">${code}</span></div>`;
}

function paragraph(text: string): string {
  return `<p style="color:#4b5563;font-size:15px;line-height:1.6;margin:0 0 14px;">${text}</p>`;
}

function muted(text: string): string {
  return `<p style="color:#9ca3af;font-size:13px;line-height:1.5;margin:14px 0 0;">${text}</p>`;
}

class ResendEmailService {
  private client: Resend;
  private from: string;
  private baseUrl: string;

  constructor() {
    this.client = new Resend(process.env.RESEND_API_KEY ?? "missing_key");
    this.from = process.env.FROM_EMAIL ?? "Job Ops <onboarding@resend.dev>";
    this.baseUrl = process.env.API_BASE_URL ?? "http://localhost:5173";
    this.baseUrl = this.baseUrl.replace(/\/api\/?$/, "");
  }

  private async send(to: string, subject: string, html: string): Promise<boolean> {
    try {
      const { error } = await this.client.emails.send({
        from: this.from,
        to,
        subject,
        html,
      });
      if (error) {
        console.error("Resend API error:", error);
        return false;
      }
      return true;
    } catch (err) {
      console.error("Failed to send email:", err);
      return false;
    }
  }

  async sendConfirmationEmail(email: string, token: string, firstName?: string): Promise<boolean> {
    const name = firstName ?? "there";
    const verifyLink = `${this.baseUrl}/verify-email/${token}`;
    const html = baseTemplate("Verify your email", [
      paragraph(`Hi ${name},`),
      paragraph("Thanks for joining the Job Ops pilot. Please confirm your email address to get started."),
      buttonHtml(verifyLink, "Verify Email"),
      muted(`Or copy this link: ${verifyLink}`),
    ].join(""));
    return this.send(email, "Verify your email — Job Ops", html);
  }

  async sendWelcomeEmail(email: string, firstName?: string): Promise<boolean> {
    const name = firstName ?? "there";
    const loginLink = `${this.baseUrl}/login`;
    const html = baseTemplate("Welcome to Job Ops!", [
      paragraph(`Hi ${name}, your email is verified and your account is ready.`),
      paragraph("Here's what you can do:"),
      `<ul style="color:#4b5563;font-size:15px;line-height:1.8;padding-left:20px;">
        <li>Ingest job descriptions via URL or text</li>
        <li>Auto-parse requirements with AI</li>
        <li>Tailor resumes to specific jobs</li>
        <li>Draft cover letters in seconds</li>
        <li>Track every application</li>
      </ul>`,
      buttonHtml(loginLink, "Go to Dashboard"),
    ].join(""));
    return this.send(email, "Welcome to Job Ops!", html);
  }

  async sendPasswordReset(email: string, token: string, firstName?: string): Promise<boolean> {
    const name = firstName ?? "there";
    const resetLink = `${this.baseUrl}/reset-password?token=${token}`;
    const html = baseTemplate("Reset your password", [
      paragraph(`Hi ${name},`),
      paragraph("We received a request to reset your password. Click the button below to choose a new one."),
      buttonHtml(resetLink, "Reset Password"),
      muted("This link expires in 1 hour. If you didn't request this, you can safely ignore this email."),
    ].join(""));
    return this.send(email, "Reset your password — Job Ops", html);
  }

  async sendWaitlistConfirmation(email: string): Promise<boolean> {
    const html = baseTemplate("You're on the waitlist!", [
      paragraph("You've been added to the Job Ops pilot waitlist."),
      paragraph("We'll email you as soon as a spot opens up. In the meantime, follow us on LinkedIn for updates."),
    ].join(""));
    return this.send(email, "You're on the waitlist — Job Ops", html);
  }

  async sendFeedbackAcknowledgment(email: string): Promise<boolean> {
    const html = baseTemplate("Feedback received", [
      paragraph("Thanks for your feedback! We review every submission and use it to improve Job Ops."),
      paragraph("If you have more to share, just reply or use the feedback widget anytime."),
    ].join(""));
    return this.send(email, "Feedback received — Job Ops", html);
  }
}

export const resendService = new ResendEmailService();
