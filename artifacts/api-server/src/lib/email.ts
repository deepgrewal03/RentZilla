import nodemailer from "nodemailer";
import { logger } from "./logger";
import { prepareGmailSender, GmailDeliveryError } from "./gmailSender";

function createTransport() {
  const user = process.env.SMTP_USER?.trim();
  let pass = process.env.SMTP_PASS;
  if (!user || !pass) return null;

  // Infer host from email domain if SMTP_HOST not explicitly set
  let host = process.env.SMTP_HOST?.trim().toLowerCase();
  if (!host) {
    const domain = user.split("@")[1]?.toLowerCase() || "";
    if (domain.includes("gmail")) host = "smtp.gmail.com";
    else if (domain.includes("yahoo")) host = "smtp.mail.yahoo.com";
    else if (domain.includes("outlook") || domain.includes("hotmail") || domain.includes("live")) host = "smtp-mail.outlook.com";
    else host = `smtp.${domain}`;
  }
  // Google displays App Passwords in groups. Copying those separator spaces
  // must not change the credential; other providers may have real whitespace.
  if (host === "smtp.gmail.com") pass = pass.replace(/\s/g, "");
  if (!pass) return null;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
}

export async function sendSupportTicketEmail(opts: {
  name: string;
  contact: string;
  issue_type: string;
  subject?: string;
  message: string;
  ticket_id: string;
  user_id?: string | null;
  platform?: string;
  app_version?: string;
  timestamp?: string;
}): Promise<boolean> {
  const {
    name, contact, issue_type, message, ticket_id,
    subject = issue_type,
    user_id = null,
    platform = "unknown",
    app_version = "1.0",
    timestamp = new Date().toISOString(),
  } = opts;
  const adminEmail = process.env.SUPPORT_EMAIL || "info.rentzilla@gmail.com";
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "support@rentzilla.com";
  const readableTime = new Date(timestamp).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

  const adminHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#F5F6FA;margin:0;padding:20px;">
  <div style="max-width:580px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#FF7A18,#FF9F43);padding:28px 24px;">
      <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">🎫 New Support Ticket</h1>
      <p style="color:rgba(255,255,255,0.85);margin:4px 0 0;font-size:12px;">RentZilla · Punjab's Rental Marketplace</p>
    </div>
    <div style="padding:28px 24px;">
      <table style="width:100%;border-collapse:collapse;font-size:14px;">
        <tr><td style="padding:7px 0;color:#9CA3AF;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;width:120px;">Ticket ID</td><td style="padding:7px 0;color:#111827;font-weight:700;">#${ticket_id}</td></tr>
        <tr><td style="padding:7px 0;color:#9CA3AF;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">From</td><td style="padding:7px 0;color:#111827;">${name}</td></tr>
        <tr><td style="padding:7px 0;color:#9CA3AF;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Reply-To</td><td style="padding:7px 0;"><a href="mailto:${contact}" style="color:#FF7A18;text-decoration:none;">${contact}</a></td></tr>
        <tr><td style="padding:7px 0;color:#9CA3AF;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Category</td><td style="padding:7px 0;"><span style="background:#FFF3E9;color:#FF7A18;padding:3px 10px;border-radius:12px;font-size:12px;font-weight:600;">${issue_type}</span></td></tr>
        <tr><td style="padding:7px 0;color:#9CA3AF;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Subject</td><td style="padding:7px 0;color:#111827;">${subject}</td></tr>
        <tr><td style="padding:7px 0;color:#9CA3AF;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">User ID</td><td style="padding:7px 0;color:#6B7280;font-size:12px;">${user_id ?? "Guest"}</td></tr>
        <tr><td style="padding:7px 0;color:#9CA3AF;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Platform</td><td style="padding:7px 0;color:#6B7280;font-size:12px;">${platform} · v${app_version}</td></tr>
        <tr><td style="padding:7px 0;color:#9CA3AF;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Time</td><td style="padding:7px 0;color:#6B7280;font-size:12px;">${readableTime} IST</td></tr>
      </table>
      <hr style="border:none;border-top:1px solid #F0F0F0;margin:18px 0;">
      <p style="color:#9CA3AF;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 10px;">Message</p>
      <div style="background:#F9FAFB;border-left:4px solid #FF7A18;border-radius:0 8px 8px 0;padding:16px;color:#111827;font-size:14px;line-height:1.7;">${message.replace(/\n/g, "<br>")}</div>
    </div>
    <div style="background:#F5F6FA;padding:14px 24px;text-align:center;">
      <p style="color:#AAA;font-size:11px;margin:0;">Reply directly to <a href="mailto:${contact}" style="color:#FF7A18;">${contact}</a> · RentZilla Admin Panel</p>
    </div>
  </div>
</body>
</html>`;

  const userHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#F5F6FA;margin:0;padding:20px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#FF7A18,#FF9F43);padding:32px 24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:28px;font-weight:700;">RentZilla</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Support Request Received ✅</p>
    </div>
    <div style="padding:28px 24px;">
      <p style="color:#111827;font-size:15px;margin:0 0 10px;">Hi <strong>${name}</strong>,</p>
      <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 20px;">Thank you for reaching out. We've received your request and will get back to you within <strong>24 hours</strong>.</p>
      <div style="background:#F9FAFB;border-radius:12px;padding:18px;margin-bottom:20px;">
        <table style="width:100%;font-size:13px;">
          <tr><td style="color:#9CA3AF;font-size:11px;font-weight:600;text-transform:uppercase;padding-bottom:4px;">Ticket Reference</td></tr>
          <tr><td style="color:#FF7A18;font-size:20px;font-weight:700;padding-bottom:14px;">#${ticket_id}</td></tr>
          <tr><td style="color:#9CA3AF;font-size:11px;font-weight:600;text-transform:uppercase;padding-bottom:4px;">Subject</td></tr>
          <tr><td style="color:#111827;padding-bottom:14px;">${subject}</td></tr>
          <tr><td style="color:#9CA3AF;font-size:11px;font-weight:600;text-transform:uppercase;padding-bottom:4px;">Submitted</td></tr>
          <tr><td style="color:#6B7280;">${readableTime} IST</td></tr>
        </table>
      </div>
      <p style="color:#888;font-size:13px;line-height:1.5;margin:0;">For urgent issues, email us directly at <a href="mailto:info.rentzilla@gmail.com" style="color:#FF7A18;">info.rentzilla@gmail.com</a></p>
    </div>
    <div style="background:#F5F6FA;padding:16px 24px;text-align:center;">
      <p style="color:#AAA;font-size:11px;margin:0;">© 2025 RentZilla · Punjab, India</p>
    </div>
  </div>
</body>
</html>`;

  const transport = createTransport();

  if (!transport) {
    logger.warn({ ticket_id }, "No SMTP configured — support ticket email skipped");
    return false;
  }

  try {
    await Promise.all([
      transport.sendMail({
        from: `RentZilla Support <${from}>`,
        to: adminEmail,
        subject: `[RentZilla Support] ${subject} — from ${name}`,
        html: adminHtml,
        replyTo: contact,
      }),
      ...(contact && EMAIL_REGEX.test(contact) ? [transport.sendMail({
        from: `RentZilla <${from}>`,
        to: contact,
        subject: `Your RentZilla Support Request #${ticket_id}`,
        html: userHtml,
      })] : []),
    ]);
    logger.info({ ticket_id }, "Support ticket emails sent successfully");
    return true;
  } catch (err) {
    logger.error({ err, ticket_id }, "Failed to send support ticket email");
    return false;
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function otpEmailHtml(otp: string, title: string, subtitle: string, expiry: string) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#F5F6FA;margin:0;padding:20px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#FF7A18,#FF9F43);padding:32px 24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:28px;font-weight:700;">RentZilla</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Punjab's Rental Marketplace</p>
    </div>
    <div style="padding:32px 24px;text-align:center;">
      <h2 style="color:#2C2C2C;margin:0 0 8px;font-size:20px;">${title}</h2>
      <p style="color:#666;font-size:14px;margin:0 0 28px;line-height:1.5;">
        ${subtitle}<br>This code expires in <strong>${expiry}</strong>.
      </p>
      <div style="background:#FFF3E9;border:2px dashed #FF7A18;border-radius:12px;padding:24px 0;margin:0 0 24px;">
        <span style="font-size:42px;font-weight:700;color:#FF7A18;letter-spacing:14px;">${otp}</span>
      </div>
      <p style="color:#999;font-size:12px;margin:0;line-height:1.6;">
        If you didn't request this, you can safely ignore this email.<br>
        Do not share this code with anyone.
      </p>
    </div>
    <div style="background:#F5F6FA;padding:16px 24px;text-align:center;">
      <p style="color:#AAA;font-size:11px;margin:0;">© 2025 RentZilla · Punjab, India</p>
    </div>
  </div>
</body>
</html>`;
}

export class PasswordResetEmailError extends Error {
  constructor() {
    super("Password reset email is temporarily unavailable. Please try again later.");
    this.name = "PasswordResetEmailError";
  }
}

// Check connector health before account lookup; never fall back to the rejected
// SMTP credentials. Other, unrelated email flows retain their existing transport.
export async function preparePasswordResetEmail() {
  try {
    const send = await prepareGmailSender();
    return async (to: string, otp: string): Promise<void> => {
      try {
        await send(to, "Your RentZilla Password Reset OTP",
          otpEmailHtml(otp, "Password Reset OTP", "Use the code below to reset your password.", "10 minutes"));
        logger.info("Password reset email accepted by Gmail API");
      } catch (error) {
        logger.error({ status: error instanceof GmailDeliveryError ? error.status : undefined },
          "Password reset email was not accepted by Gmail API");
        throw new PasswordResetEmailError();
      }
    };
  } catch {
    logger.error("Password reset Gmail connection unavailable");
    throw new PasswordResetEmailError();
  }
}

export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const send = await preparePasswordResetEmail();
  await send(to, otp);
}

export async function send2FAEmail(to: string, otp: string): Promise<void> {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@rentzilla.com";
  const html = otpEmailHtml(otp, "Two-Factor Authentication Code", "Use the code below to verify your identity.", "5 minutes");
  const transport = createTransport();
  if (!transport) {
    logger.warn({ to }, "No SMTP configured — 2FA OTP cannot be delivered");
    return;
  }
  try {
    await transport.sendMail({
      from: `RentZilla <${from}>`,
      to,
      subject: "Your RentZilla 2FA Verification Code",
      html,
    });
    logger.info({ to }, "2FA OTP email sent");
  } catch (emailErr: any) {
    logger.error({ to, err: emailErr?.message }, "2FA SMTP send failed");
    throw new Error("Could not send OTP email. Please try again.");
  }
}
