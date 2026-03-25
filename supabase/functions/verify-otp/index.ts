import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

async function hashOtp(otp: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(otp);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const body = await req.json();
    const email: string   = (body.email   || "").trim().toLowerCase();
    const otp: string     = (body.otp     || "").trim();
    const name: string    = (body.name    || "").trim();
    const company: string = (body.company || "").trim();
    const phone: string   = (body.phone   || "").trim();

    if (!email || !otp) {
      return new Response(JSON.stringify({ error: "Email and OTP are required." }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (!/^\d{6}$/.test(otp)) {
      return new Response(JSON.stringify({ error: "OTP must be 6 digits." }), {
        status: 400,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    const now = new Date().toISOString();
    const { data: challenges, error: fetchError } = await supabase
      .from("otp_challenges")
      .select("*")
      .eq("email", email)
      .eq("verified", false)
      .gt("expires_at", now)
      .order("created_at", { ascending: false })
      .limit(1);

    if (fetchError) throw fetchError;

    if (!challenges || challenges.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid OTP found. Please request a new one." }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const challenge = challenges[0];

    if (challenge.attempt_count >= 5) {
      return new Response(
        JSON.stringify({ error: "Too many incorrect attempts. Please request a new OTP." }),
        { status: 429, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("otp_challenges")
      .update({ attempt_count: challenge.attempt_count + 1 })
      .eq("id", challenge.id);

    const providedHash = await hashOtp(otp);

    if (providedHash !== challenge.otp_hash) {
      const remaining = 4 - challenge.attempt_count;
      return new Response(
        JSON.stringify({
          error: remaining > 0
            ? `Incorrect OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.`
            : "Too many incorrect attempts. Please request a new OTP.",
        }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    await supabase
      .from("otp_challenges")
      .update({ verified: true })
      .eq("id", challenge.id);

    const token = generateToken();

    // Session expires in 7 days
    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const ip_address =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;
    const user_agent = req.headers.get("user-agent") || null;

    const { error: sessionError } = await supabase
      .from("verified_sessions")
      .insert({ email, name, company: company || null, phone: phone || null, token, expires_at, ip_address, user_agent });

    if (sessionError) throw sessionError;

    return new Response(
      JSON.stringify({ token, user: { email, name, company, phone } }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("verify-otp error:", err);
    return new Response(JSON.stringify({ error: "Verification failed. Please try again." }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
