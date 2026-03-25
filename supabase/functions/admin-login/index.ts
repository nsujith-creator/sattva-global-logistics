import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const { email, password } = await req.json();

    const adminEmail    = Deno.env.get("ADMIN_EMAIL")    || "sujith@sattvaglobal.in";
    const adminPassword = Deno.env.get("ADMIN_PASSWORD") || "";

    if (!adminPassword) {
      return new Response(JSON.stringify({ error: "Admin not configured." }), {
        status: 500,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (email !== adminEmail || password !== adminPassword) {
      return new Response(JSON.stringify({ error: "Invalid email or password." }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    // Generate a session token valid for 24 hours
    const arr = new Uint8Array(32);
    crypto.getRandomValues(arr);
    const token = "admin_" + Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");

    // Store expiry in token itself as a signed payload isn't needed —
    // admin-save-rate and admin-delete-rate will accept this token
    // after we update them to also check for admin_ prefix tokens.
    return new Response(JSON.stringify({ token }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("admin-login error:", err);
    return new Response(JSON.stringify({ error: "Login failed." }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
