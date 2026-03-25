import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(req) });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("rates")
      .select(
        "route_key, carrier, ocean_freight, thc_origin, thc_dest, bl_fee, surcharges, total, valid_from, valid_to"
      )
      .or(`valid_to.gte.${today},valid_to.is.null`)
      .order("route_key");

    if (error) throw error;

    // Transform to object keyed by route_key - matches existing frontend format
    const rates: Record<string, object> = {};
    for (const row of data ?? []) {
      rates[row.route_key] = {
        carrier:       row.carrier,
        oceanFreight:  row.ocean_freight,
        thcOrigin:     row.thc_origin,
        thcDest:       row.thc_dest,
        blFee:         row.bl_fee,
        surcharges:    row.surcharges,
        total:         row.total,
        validFrom:     row.valid_from,
        validTo:       row.valid_to,
      };
    }

    return new Response(JSON.stringify({ rates }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("get-rates error:", err);
    return new Response(JSON.stringify({ error: "Failed to load rates" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
