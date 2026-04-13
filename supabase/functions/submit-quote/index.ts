import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, escapeHtml } from "../_shared/cors.ts";

const quoteNotificationHtml = (user: Record<string, string>, q: Record<string, unknown>) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;">
        <tr><td style="background:#1B2E5E;padding:24px 32px;">
          <div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:2px;">SATTVA GLOBAL LOGISTICS</div>
          <div style="color:#C8A84B;font-size:13px;margin-top:4px;">New Quote Request</div>
        </td></tr>
        <tr><td style="padding:28px 32px;">
          <h2 style="margin:0 0 20px;color:#1B2E5E;font-size:16px;">${escapeHtml(q.pol)} → ${escapeHtml(q.pod)} | ${escapeHtml(user.company || user.name)}</h2>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
            <tr style="background:#f8f9fc;"><td style="padding:10px 14px;color:#666;width:140px;border-bottom:1px solid #e8ecf0;">Name</td><td style="padding:10px 14px;color:#333;border-bottom:1px solid #e8ecf0;">${escapeHtml(user.name)}</td></tr>
            <tr><td style="padding:10px 14px;color:#666;border-bottom:1px solid #e8ecf0;">Email</td><td style="padding:10px 14px;border-bottom:1px solid #e8ecf0;"><a href="mailto:${escapeHtml(user.email)}" style="color:#1B2E5E;">${escapeHtml(user.email)}</a></td></tr>
            <tr style="background:#f8f9fc;"><td style="padding:10px 14px;color:#666;border-bottom:1px solid #e8ecf0;">Company</td><td style="padding:10px 14px;color:#333;border-bottom:1px solid #e8ecf0;">${escapeHtml(user.company || "-")}</td></tr>
            <tr><td style="padding:10px 14px;color:#666;border-bottom:1px solid #e8ecf0;">Phone</td><td style="padding:10px 14px;color:#333;border-bottom:1px solid #e8ecf0;">${escapeHtml(user.phone || "-")}</td></tr>
            <tr style="background:#f8f9fc;"><td style="padding:10px 14px;color:#666;border-bottom:1px solid #e8ecf0;">POL</td><td style="padding:10px 14px;color:#333;border-bottom:1px solid #e8ecf0;">${escapeHtml(q.pol)}</td></tr>
            <tr><td style="padding:10px 14px;color:#666;border-bottom:1px solid #e8ecf0;">POD</td><td style="padding:10px 14px;color:#333;border-bottom:1px solid #e8ecf0;">${escapeHtml(q.pod)}</td></tr>
            <tr style="background:#f8f9fc;"><td style="padding:10px 14px;color:#666;border-bottom:1px solid #e8ecf0;">Equipment</td><td style="padding:10px 14px;color:#333;border-bottom:1px solid #e8ecf0;">${escapeHtml(q.equipment)}</td></tr>
            <tr><td style="padding:10px 14px;color:#666;border-bottom:1px solid #e8ecf0;">Containers</td><td style="padding:10px 14px;color:#333;border-bottom:1px solid #e8ecf0;">${escapeHtml(String(q.containers))}</td></tr>
            <tr style="background:#f8f9fc;"><td style="padding:10px 14px;color:#666;border-bottom:1px solid #e8ecf0;">Cargo</td><td style="padding:10px 14px;color:#333;border-bottom:1px solid #e8ecf0;">${escapeHtml(q.cargo || "-")}</td></tr>
            <tr><td style="padding:10px 14px;color:#666;border-bottom:1px solid #e8ecf0;">Notes</td><td style="padding:10px 14px;color:#333;border-bottom:1px solid #e8ecf0;">${escapeHtml(q.notes || "-")}</td></tr>
          </table>
        </td></tr>
        <tr><td style="background:#f8f9fc;border-top:1px solid #e8ecf0;padding:16px 32px;">
          <p style="margin:0;color:#888;font-size:12px;">Submitted ${new Date().toUTCString()} | Reply-To: ${escapeHtml(user.email)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

const quoteConfirmationHtml = (user: Record<string, string>, q: Record<string, unknown>) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:560px;">
        <tr><td style="background:#1B2E5E;padding:28px 32px;">
          <div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:2px;">SATTVA GLOBAL LOGISTICS</div>
          <div style="color:#C8A84B;font-size:13px;margin-top:6px;">Quote Request Received</div>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;color:#333;font-size:15px;">Hello ${escapeHtml(user.name)},</p>
          <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.7;">Thank you for your freight enquiry. We have received your quote request and our team will respond within <strong>4 working hours</strong>.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin-bottom:24px;">
            <tr style="background:#f0f4ff;"><td colspan="2" style="padding:10px 14px;color:#1B2E5E;font-weight:700;border-bottom:2px solid #1B2E5E;">Your Request Summary</td></tr>
            <tr style="background:#f8f9fc;"><td style="padding:9px 14px;color:#666;width:130px;border-bottom:1px solid #e8ecf0;">Route</td><td style="padding:9px 14px;color:#333;font-weight:700;border-bottom:1px solid #e8ecf0;">${escapeHtml(q.pol)} → ${escapeHtml(q.pod)}</td></tr>
            <tr><td style="padding:9px 14px;color:#666;border-bottom:1px solid #e8ecf0;">Equipment</td><td style="padding:9px 14px;color:#333;border-bottom:1px solid #e8ecf0;">${escapeHtml(q.equipment)}</td></tr>
            <tr style="background:#f8f9fc;"><td style="padding:9px 14px;color:#666;border-bottom:1px solid #e8ecf0;">Cargo</td><td style="padding:9px 14px;color:#333;border-bottom:1px solid #e8ecf0;">${escapeHtml(q.cargo || "-")}</td></tr>
          </table>
          <p style="margin:0;color:#888;font-size:13px;line-height:1.6;">Urgent? <a href="mailto:quotes@sattvaglobal.in" style="color:#1B2E5E;">quotes@sattvaglobal.in</a> | +91 9136 121 123</p>
        </td></tr>
        <tr><td style="background:#f8f9fc;border-top:1px solid #e8ecf0;padding:18px 32px;">
          <p style="margin:0;color:#888;font-size:12px;"><a href="https://www.sattvaglobal.in" style="color:#1B2E5E;">www.sattvaglobal.in</a> | Navi Mumbai, India</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }
  try {
    const body = await req.json();
    const user = {
      name:    (body.name    || "").trim(),
      email:   (body.email   || "").trim().toLowerCase(),
      company: (body.company || "").trim(),
      phone:   (body.phone   || "").trim(),
    };
    if (!user.name || !user.email) {
      return new Response(JSON.stringify({ error: "Name and email are required." }), {
        status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }
    const q = {
      pol:       (body.pol       || "").trim(),
      pod:       (body.pod       || "").trim(),
      equipment: (body.equipment || "").trim(),
      containers: Math.min(Math.max(parseInt(body.containers) || 1, 1), 99),
      cargo:     (body.cargo     || "").trim(),
      notes:     (body.notes     || "").trim(),
      rateFound: false,
    };
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    );
    await supabase.from("quote_requests").insert({
      name: user.name, email: user.email, company: user.company || null,
      phone: user.phone || null, pol: q.pol, pod: q.pod,
      equipment: q.equipment, containers: q.containers,
      cargo: q.cargo || null, notes: q.notes || null, rate_found: false,
    }).select("id").single();

    const [opsRes, userRes] = await Promise.all([
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Sattva Global Logistics <noreply@sattvaglobal.in>",
          to: ["quotes@sattvaglobal.in"],
          reply_to: user.email,
          subject: `New Quote: ${q.pol} → ${q.pod} | ${user.company || user.name}`,
          html: quoteNotificationHtml(user, q),
        }),
      }),
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "Sattva Global Logistics <noreply@sattvaglobal.in>",
          to: [user.email],
          subject: `Quote Request Received — ${q.pol} → ${q.pod}`,
          html: quoteConfirmationHtml(user, q),
        }),
      }),
    ]);
    if (!opsRes.ok) console.error("Ops email failed:", await opsRes.text());
    if (!userRes.ok) console.error("User email failed:", await userRes.text());
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("submit-quote error:", err);
    return new Response(JSON.stringify({ error: "Failed to submit. Please try again." }), {
      status: 500, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
