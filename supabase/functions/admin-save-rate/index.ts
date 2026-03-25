import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

function isValidRouteKey(key: string): boolean {
  return /^[A-Z0-9]+:[A-Z0-9]+:[A-Z0-9]+$/i.test(key);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const authHeader = req.headers.get("authorization") || "";
    const jwt = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

    if (!jwt) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    if (user.app_metadata?.role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const routeKey = (body.routeKey || "").trim().toUpperCase();

    if (!routeKey || !isValidRouteKey(routeKey)) {
      return new Response(
        JSON.stringify({ error: "Invalid route key format. Expected: POL:POD:EQUIPMENT (e.g. INNSA:KWSHW:40HC)" }),
        { status: 400, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
      );
    }

    const rateRecord = {
      route_key:     routeKey,
      carrier:       (body.carrier || "").trim(),
      ocean_freight: parseFloat(body.oceanFreight) || 0,
      thc_origin:    parseFloat(body.thcOrigin)    || 0,
      thc_dest:      parseFloat(body.thcDest)      || 0,
      bl_fee:        parseFloat(body.blFee)        || 0,
      surcharges:    parseFloat(body.surcharges)   || 0,
      total:         parseFloat(body.total)        || 0,
      valid_from:    body.validFrom  || null,
      valid_to:      body.validTo    || null,
      updated_at:    new Date().toISOString(),
    };

    const { data, error: upsertError } = await supabaseAdmin
      .from("rates")
      .upsert(rateRecord, { onConflict: "route_key" })
      .select()
      .single();

    if (upsertError) throw upsertError;

    return new Response(
      JSON.stringify({ success: true, rate: data }),
      { status: 200, headers: { ...getCorsHeaders(req), "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("admin-save-rate error:", err);
    return new Response(JSON.stringify({ error: "Failed to save rate." }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
