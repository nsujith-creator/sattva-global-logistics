import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const authHeader = req.headers.get("authorization") || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
    if (!token) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });

    const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SERVICE_ROLE_KEY")!);

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user || user.app_metadata?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    const body = await req.json();
    const routeKey = (body.routeKey || "").trim().toUpperCase();
    if (!routeKey || !/^[A-Z0-9]+:[A-Z0-9]+$/i.test(routeKey)) {
      return new Response(JSON.stringify({ error: "Invalid route key. Expected: POL:POD" }), { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } });
    }

    const [pol, pod] = routeKey.split(":");
    const record = {
      route_key:   routeKey,
      pol,
      pod,
      valid_until: body.validUntil || null,
      options:     body.options || [],
      updated_at:  new Date().toISOString(),
    };

    const { data, error: upsertError } = await supabaseAdmin
      .from("quotes")
      .upsert(record, { onConflict: "route_key" })
      .select()
      .single();

    if (upsertError) throw upsertError;

    return new Response(JSON.stringify({ success: true, quote: data }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("admin-save-quote error:", err);
    return new Response(JSON.stringify({ error: "Failed to save quote." }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
