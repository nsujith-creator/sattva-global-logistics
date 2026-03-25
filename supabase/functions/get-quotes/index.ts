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
      .from("quotes")
      .select("route_key, pol, pod, valid_until, options")
      .or(`valid_until.gte.${today},valid_until.is.null`)
      .order("route_key");

    if (error) throw error;

    const quotes: Record<string, object> = {};
    for (const row of data ?? []) {
      quotes[row.route_key] = {
        pol:        row.pol,
        pod:        row.pod,
        validUntil: row.valid_until,
        options:    row.options || [],
      };
    }

    return new Response(JSON.stringify({ quotes }), {
      status: 200,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("get-quotes error:", err);
    return new Response(JSON.stringify({ error: "Failed to load quotes" }), {
      status: 500,
      headers: { ...getCorsHeaders(req), "Content-Type": "application/json" },
    });
  }
});
