// Sending email (reservation answers and new-reservation alerts).
// Works with one of these, set in the Vercel environment variables:
//   Resend:  RESEND_API_KEY=re_...            EMAIL_FROM="Hotel Garden <reservations@yourdomain.com>"
//   SMTP:    SMTP_HOST, SMTP_PORT (465 or 587), SMTP_USER, SMTP_PASS, EMAIL_FROM
// Nothing set: nothing is sent and the caller is told, so the dashboard can say so.

export interface EmailResult { sent: boolean; error?: string }

export function emailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY || (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS));
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Simple, readable HTML from plain lines (first line is the heading) */
export function simpleHtml(title: string, lines: string[], footer?: string) {
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#111827">
<div style="max-width:520px;margin:24px auto;background:#ffffff;border-radius:16px;padding:24px">
<h1 style="font-size:20px;margin:0 0 12px">${esc(title)}</h1>
${lines.map((l) => `<p style="font-size:15px;line-height:1.5;margin:0 0 10px">${esc(l)}</p>`).join("\n")}
${footer ? `<p style="font-size:12px;color:#6b7280;margin:18px 0 0">${esc(footer)}</p>` : ""}
</div></body></html>`;
}

export async function sendEmail(msg: { to: string; subject: string; text: string; html?: string; replyTo?: string | null; fromName?: string }): Promise<EmailResult> {
  const fromEnv = process.env.EMAIL_FROM || process.env.SMTP_USER || "";
  // "Restaurant name <address>" so customers see who writes
  const address = fromEnv.match(/<([^>]+)>/)?.[1] ?? fromEnv;
  const from = msg.fromName && address ? `${msg.fromName.replace(/[<>"]/g, "")} <${address}>` : fromEnv;
  try {
    if (process.env.RESEND_API_KEY) {
      if (!from) return { sent: false, error: "EMAIL_FROM is not set" };
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from, to: [msg.to], subject: msg.subject, text: msg.text, html: msg.html, ...(msg.replyTo ? { reply_to: msg.replyTo } : {}) }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) return { sent: false, error: `The email service answered ${res.status}` };
      return { sent: true };
    }
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const nodemailer = await import("nodemailer");
      const port = Number(process.env.SMTP_PORT || 587);
      const transport = nodemailer.createTransport({
        host: process.env.SMTP_HOST, port, secure: port === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      });
      await transport.sendMail({ from, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html, ...(msg.replyTo ? { replyTo: msg.replyTo } : {}) });
      return { sent: true };
    }
    return { sent: false, error: "Email is not set up yet" };
  } catch (error) {
    console.error("[email] could not send", error);
    return { sent: false, error: "The email could not be sent" };
  }
}
