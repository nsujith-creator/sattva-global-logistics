import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, escapeHtml } from "../_shared/cors.ts";

// FAIL-11 FIX: All user-supplied values escaped before HTML injection.

const FREE_DOMAINS = [
  "gmail.com","yahoo.com","yahoo.in","yahoo.co.in","hotmail.com","outlook.com",
  "live.com","msn.com","icloud.com","me.com","mac.com","aol.com","protonmail.com",
  "proton.me","tutanota.com","zoho.com","rediffmail.com","ymail.com","inbox.com",
  "mail.com","gmx.com","gmx.net","fastmail.com","hushmail.com","lycos.com",
  "excite.com","usa.com","email.com","consultant.com","contractor.net",
];

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function hashOtp(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateOtp(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return (100000 + (arr[0] % 900000)).toString();
}

// FAIL-11: name and otp are escaped. otp is numeric-only so escaping is a no-op, but kept for defence-in-depth.
const otpEmailHtml = (name: string, otp: string) => `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;max-width:560px;">
        <tr>
          <td style="background:#1B2E5E;padding:28px 32px;">
            <div style="color:#ffffff;font-size:18px;font-weight:700;letter-spacing:2px;">SATTVA GLOBAL LOGISTICS</div>
            <div style="color:#C8A84B;font-size:13px;margin-top:6px;letter-spacing:1px;">Rate Access Verification</div>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 32px;">
            <p style="margin:0 0 16px;color:#333;font-size:15px;">Hello ${escapeHtml(name)},</p>
            <p style="margin:0 0 28px;color:#555;font-size:14px;line-height:1.6;">
              Your one-time access code to view freight rates is:
            </p>
            <div style="text-align:center;margin:0 0 32px;">
              <div style="display:inline-block;background:#f0f4ff;border:2px solid #1B2E5E;border-radius:8px;padding:20px 40px;">
                <span style="font-size:36px;font-weight:700;color:#1B2E5E;letter-spacing:8px;">${escapeHtml(otp)}</span>
              </div>
            </div>
            <p style="margin:0 0 12px;color:#888;font-size:13px;text-align:center;">
              This code expires in <strong>10 minutes</strong>.
            </p>
            <p style="margin:0;color:#aaa;font-size:12px;text-align:center;">
              If you did not request this, please ignore this email.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f8f9fc;border-top:1px solid #e8ecf0;padding:20px 32px;">
            <p style="margin:0;color:#888;font-size:12px;line-height:1.8;">
              quotes@sattvaglobal.in &nbsp;|&nbsp; +91 9136 121 123 &nbsp;|&nbsp;
              <a href="https://www.sattvaglobal.in" style="color:#1B2E5E;">www.sattvaglobal.in</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const body = await req.json();
    const email: string   = (body.email   || "").trim().toLowerCase();
    const name: string    = (body.name    || "").trim();
    const company: string = (body.company || "").trim();
    const phone: string   = (body.phone   || "").trim();

    if (!email || !isValidEmail(email)) {
      return new Response(JSON.stringify({ error: "Invalid email address." }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const domain = email.split("@")[1];
    if (FREE_DOMAINS.includes(domain)) {
      return new Response(
        JSON.stringify({ error: "Please use your company email address." }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    const ip_address =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;

    const fifteenMinsAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();

    // FAIL-09 FIX: Dual throttle — per email AND per IP.
    // Per-email: max 3 OTPs per 15 min (protects against using us to spam one inbox).
    // Per-IP:    max 5 OTPs per 15 min (protects against rotating emails from one attacker IP).

    const [emailCountRes, ipCountRes] = await Promise.all([
      supabase
        .from("otp_challenges")
        .select("id", { count: "exact", head: true })
        .eq("email", email)
        .gte("created_at", fifteenMinsAgo),

      ip_address
        ? supabase
            .from("otp_challenges")
            .select("id", { count: "exact", head: true })
            .eq("ip_address", ip_address)
            .gte("created_at", fifteenMinsAgo)
        : Promise.resolve({ count: 0, error: null }),
    ]);

    if ((emailCountRes.count ?? 0) >= 3) {
      return new Response(
        JSON.stringify({ error: "Too many OTP requests for this address. Please email quotes@sattvaglobal.in directly." }),
        { status: 429, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    if ((ipCountRes.count ?? 0) >= 5) {
      return new Response(
        JSON.stringify({ error: "Too many requests from this network. Please try again later." }),
        { status: 429, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const otp = generateOtp();
    const otp_hash = await hashOtp(otp);

    const { error: insertError } = await supabase
      .from("otp_challenges")
      .insert({ email, otp_hash, ip_address });

    if (insertError) throw insertError;

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Sattva Global Logistics <noreply@sattvaglobal.in>",
        to: [email],
        subject: `Your Sattva Rate Access Code: ${otp}`,
        html: otpEmailHtml(name, otp),
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      console.error("Resend error:", errBody);
      throw new Error("Failed to send email");
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-otp error:", err);
    return new Response(JSON.stringify({ error: "Failed to send OTP. Please try again." }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
