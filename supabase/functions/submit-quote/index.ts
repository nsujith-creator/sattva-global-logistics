import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, escapeHtml } from "../_shared/cors.ts";

// FAIL-11 FIX: All user-supplied values escaped before HTML injection.
// FAIL-10 FIX: Per-session quote submission throttle applied before any DB write.
// FAIL-12 FIX: Email send failures surface as partial-success with actionable message; DB record is preserved.

const quoteNotificationHtml = (user: Record<string, string>, q: Record<string, unknown>) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:600px;">
        <tr>
          <td style="background:#1B2E5E;padding:24px 32px;">
            <div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:2px;">SATTVA GLOBAL LOGISTICS</div>
            <div style="color:#C8A84B;font-size:13px;margin-top:4px;">New Quote Request</div>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <h2 style="margin:0 0 20px;color:#1B2E5E;font-size:16px;">
              ${escapeHtml(q.pol)} to ${escapeHtml(q.pod)} | ${escapeHtml(user.company || user.name)}
            </h2>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">
              <tr style="background:#f8f9fc;">
                <td style="padding:10px 14px;color:#666;width:140px;border-bottom:1px solid #e8ecf0;">Customer</td>
                <td style="padding:10px 14px;color:#333;border-bottom:1px solid #e8ecf0;">${escapeHtml(user.name)}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;color:#666;border-bottom:1px solid #e8ecf0;">Email</td>
                <td style="padding:10px 14px;color:#1B2E5E;border-bottom:1px solid #e8ecf0;">
                  <a href="mailto:${escapeHtml(user.email)}" style="color:#1B2E5E;">${escapeHtml(user.email)}</a>
                </td>
              </tr>
              <tr style="background:#f8f9fc;">
                <td style="padding:10px 14px;color:#666;border-bottom:1px solid #e8ecf0;">Company</td>
                <td style="padding:10px 14px;color:#333;border-bottom:1px solid #e8ecf0;">${escapeHtml(user.company || "-")}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;color:#666;border-bottom:1px solid #e8ecf0;">Phone</td>
                <td style="padding:10px 14px;color:#333;border-bottom:1px solid #e8ecf0;">${escapeHtml(user.phone || "-")}</td>
              </tr>
              <tr style="background:#f8f9fc;">
                <td style="padding:10px 14px;color:#666;border-bottom:1px solid #e8ecf0;">POL</td>
                <td style="padding:10px 14px;color:#333;border-bottom:1px solid #e8ecf0;">${escapeHtml(q.pol)}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;color:#666;border-bottom:1px solid #e8ecf0;">POD</td>
                <td style="padding:10px 14px;color:#333;border-bottom:1px solid #e8ecf0;">${escapeHtml(q.pod)}</td>
              </tr>
              <tr style="background:#f8f9fc;">
                <td style="padding:10px 14px;color:#666;border-bottom:1px solid #e8ecf0;">Equipment</td>
                <td style="padding:10px 14px;color:#333;border-bottom:1px solid #e8ecf0;">${escapeHtml(q.equipment)}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;color:#666;border-bottom:1px solid #e8ecf0;">Containers</td>
                <td style="padding:10px 14px;color:#333;border-bottom:1px solid #e8ecf0;">${escapeHtml(q.containers)}</td>
              </tr>
              <tr style="background:#f8f9fc;">
                <td style="padding:10px 14px;color:#666;border-bottom:1px solid #e8ecf0;">Cargo</td>
                <td style="padding:10px 14px;color:#333;border-bottom:1px solid #e8ecf0;">${escapeHtml(q.cargo || "-")}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;color:#666;border-bottom:1px solid #e8ecf0;">Notes</td>
                <td style="padding:10px 14px;color:#333;border-bottom:1px solid #e8ecf0;">${escapeHtml(q.notes || "-")}</td>
              </tr>
              <tr style="background:${q.rateFound ? "#e8f5e9" : "#fff8e1"};">
                <td style="padding:10px 14px;color:#666;border-bottom:1px solid #e8ecf0;">Rate Status</td>
                <td style="padding:10px 14px;font-weight:700;color:${q.rateFound ? "#2e7d32" : "#f57f17"};border-bottom:1px solid #e8ecf0;">
                  ${q.rateFound ? `Rate found - USD ${escapeHtml(q.rateTotal)}` : "No rate on file - manual quotation required"}
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#f8f9fc;border-top:1px solid #e8ecf0;padding:16px 32px;">
            <p style="margin:0;color:#888;font-size:12px;">
              Submitted at ${new Date().toUTCString()} | Reply-To: ${escapeHtml(user.email)}
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

const quoteConfirmationHtml = (user: Record<string, string>, q: Record<string, unknown>) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:560px;">
        <tr>
          <td style="background:#1B2E5E;padding:28px 32px;">
            <div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:2px;">SATTVA GLOBAL LOGISTICS</div>
            <div style="color:#C8A84B;font-size:13px;margin-top:6px;">Quote Request Received</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;color:#333;font-size:15px;">Hello ${escapeHtml(user.name)},</p>
            <p style="margin:0 0 24px;color:#555;font-size:14px;line-height:1.7;">
              Thank you for your freight enquiry. We have received your quote request and our team will respond
              within <strong>24 hours</strong> with a competitive quotation.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin-bottom:24px;">
              <tr style="background:#f0f4ff;">
                <td colspan="2" style="padding:10px 14px;color:#1B2E5E;font-weight:700;border-bottom:2px solid #1B2E5E;">
                  Your Request Summary
                </td>
              </tr>
              <tr style="background:#f8f9fc;">
                <td style="padding:9px 14px;color:#666;width:130px;border-bottom:1px solid #e8ecf0;">Route</td>
                <td style="padding:9px 14px;color:#333;font-weight:700;border-bottom:1px solid #e8ecf0;">${escapeHtml(q.pol)} to ${escapeHtml(q.pod)}</td>
              </tr>
              <tr>
                <td style="padding:9px 14px;color:#666;border-bottom:1px solid #e8ecf0;">Equipment</td>
                <td style="padding:9px 14px;color:#333;border-bottom:1px solid #e8ecf0;">${escapeHtml(q.equipment)}</td>
              </tr>
              <tr style="background:#f8f9fc;">
                <td style="padding:9px 14px;color:#666;border-bottom:1px solid #e8ecf0;">Containers</td>
                <td style="padding:9px 14px;color:#333;border-bottom:1px solid #e8ecf0;">${escapeHtml(q.containers)}</td>
              </tr>
              <tr>
                <td style="padding:9px 14px;color:#666;border-bottom:1px solid #e8ecf0;">Cargo</td>
                <td style="padding:9px 14px;color:#333;border-bottom:1px solid #e8ecf0;">${escapeHtml(q.cargo || "-")}</td>
              </tr>
            </table>
            <p style="margin:0;color:#888;font-size:13px;line-height:1.6;">
              For urgent requirements, contact us directly:<br>
              <a href="mailto:quotes@sattvaglobal.in" style="color:#1B2E5E;">quotes@sattvaglobal.in</a>
              | +91 9136 121 123
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8f9fc;border-top:1px solid #e8ecf0;padding:18px 32px;">
            <p style="margin:0;color:#888;font-size:12px;">
              <a href="https://www.sattvaglobal.in" style="color:#1B2E5E;">www.sattvaglobal.in</a>
              | Navi Mumbai, India
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

// FAIL-10: Max quotes per verified session. Keeps token-obtained quota burns under control.
const MAX_QUOTES_PER_SESSION = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    const now = new Date().toISOString();
    const { data: sessions, error: sessionErr } = await supabase
      .from("verified_sessions")
      .select("*")
      .eq("token", token)
      .gt("expires_at", now)
      .limit(1);

    if (sessionErr) throw sessionErr;
    if (!sessions || sessions.length === 0) {
      return new Response(JSON.stringify({ error: "Session expired or invalid. Please verify your email again." }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const session = sessions[0];

    // FAIL-10: Count existing quote submissions for this session.
    const { count: sessionQuoteCount, error: countErr } = await supabase
      .from("quote_requests")
      .select("id", { count: "exact", head: true })
      .eq("session_id", session.id);

    if (countErr) throw countErr;

    if ((sessionQuoteCount ?? 0) >= MAX_QUOTES_PER_SESSION) {
      return new Response(
        JSON.stringify({
          error: `You have reached the maximum of ${MAX_QUOTES_PER_SESSION} quote requests per session. Please contact quotes@sattvaglobal.in for further assistance.`,
        }),
        { status: 429, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const user = {
      email:   session.email,
      name:    session.name,
      company: session.company || "",
      phone:   session.phone   || "",
    };

    const body = await req.json();
    const q = {
      pol:        (body.pol       || "").trim().toUpperCase(),
      pod:        (body.pod       || "").trim().toUpperCase(),
      equipment:  (body.equipment || "").trim(),
      containers: Math.min(Math.max(parseInt(body.containers) || 1, 1), 99),
      cargo:      (body.cargo     || "").trim(),
      notes:      (body.notes     || "").trim(),
      rateFound:  Boolean(body.rateFound),
      rateTotal:  body.rateTotal ? parseFloat(body.rateTotal) : null,
    };

    const ip_address =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;

    const { data: quoteData, error: quoteErr } = await supabase
      .from("quote_requests")
      .insert({
        session_id:  session.id,
        name:        user.name,
        email:       user.email,
        company:     user.company || null,
        phone:       user.phone   || null,
        pol:         q.pol,
        pod:         q.pod,
        equipment:   q.equipment,
        containers:  q.containers,
        cargo:       q.cargo  || null,
        notes:       q.notes  || null,
        rate_found:  q.rateFound,
        rate_total:  q.rateTotal,
        ip_address,
      })
      .select("id")
      .single();

    if (quoteErr) throw quoteErr;

    await supabase.from("search_logs").insert({
      email:      user.email,
      pol:        q.pol,
      pod:        q.pod,
      equipment:  q.equipment,
      rate_found: q.rateFound,
    });

    // FAIL-12: Send both emails; track success independently.
    const [opsRes, userRes] = await Promise.all([
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from:     "Sattva Global Logistics <noreply@sattvaglobal.in>",
          to:       ["quotes@sattvaglobal.in"],
          reply_to: user.email,
          subject:  `New Quote Request: ${q.pol} to ${q.pod} | ${user.company || user.name}`,
          html:     quoteNotificationHtml(user, q),
        }),
      }),
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from:    "Sattva Global Logistics <noreply@sattvaglobal.in>",
          to:      [user.email],
          subject: `Quote Request Received - ${q.pol} to ${q.pod}`,
          html:    quoteConfirmationHtml(user, q),
        }),
      }),
    ]);

    const opsEmailOk  = opsRes.ok;
    const userEmailOk = userRes.ok;

    if (!opsEmailOk)  console.error("Ops email failed:", await opsRes.text());
    if (!userEmailOk) console.error("User confirmation email failed:", await userRes.text());

    // FAIL-12: Quote is saved regardless of email status. But tell the user the truth.
    // Both failed → ops team must be alerted — return partial success with warning.
    // Only one failed → logged; quote is saved; don't alarm the user unnecessarily.
    if (!opsEmailOk && !userEmailOk) {
      return new Response(
        JSON.stringify({
          success:   true,
          quoteId:   quoteData.id,
          warning:   "Your quote request was recorded, but our notification system is currently experiencing issues. Please contact quotes@sattvaglobal.in to confirm we received your request.",
          emailFail: true,
        }),
        { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, quoteId: quoteData.id }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("submit-quote error:", err);
    return new Response(JSON.stringify({ error: "Failed to submit quote. Please try again." }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
