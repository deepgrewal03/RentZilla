import nodemailer from "nodemailer";
import { logger } from "./logger";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);

  if (!host || !user || !pass) return null;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendOtpEmail(to: string, otp: string): Promise<void> {
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || "noreply@rentzilla.com";

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family:Arial,sans-serif;background:#F5F6FA;margin:0;padding:20px;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.08);">
    <div style="background:linear-gradient(135deg,#FF7A18,#FF9F43);padding:32px 24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:28px;font-weight:700;">RentZilla</h1>
      <p style="color:rgba(255,255,255,0.85);margin:8px 0 0;font-size:14px;">Punjab's Rental Marketplace</p>
    </div>
    <div style="padding:32px 24px;text-align:center;">
      <h2 style="color:#2C2C2C;margin:0 0 8px;font-size:20px;">Password Reset OTP</h2>
      <p style="color:#666;font-size:14px;margin:0 0 28px;line-height:1.5;">
        Use the code below to reset your password.<br>
        This code expires in <strong>10 minutes</strong>.
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

  const transport = createTransport();

  if (!transport) {
    logger.warn({ to }, "No SMTP configured — OTP logged to console (set SMTP_HOST, SMTP_USER, SMTP_PASS to enable email)");
    logger.info(`\n${"=".repeat(40)}\nPASSWORD RESET OTP\nTo:  ${to}\nOTP: ${otp}\n${"=".repeat(40)}`);
    return;
  }

  await transport.sendMail({
    from: `RentZilla <${from}>`,
    to,
    subject: "Your RentZilla Password Reset OTP",
    html,
  });

  logger.info({ to }, "OTP email sent successfully");
}
