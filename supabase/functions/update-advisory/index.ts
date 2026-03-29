// update-advisory Edge Function
// Called by Cowork digest at 9am and 3pm IST every day
// Authenticated via ADVISORY_SECRET header token
// Rejects test/garbage payloads at the gate

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, escapeHtml } from "../_shared/cors.ts";

const ADVISORY_SECRET = Deno.env.get("ADVISORY_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY") ?? "";

// Test/garbage patterns — reject if situation matches these
const TEST_PATTERNS = [/^test\b/i, /test check/i, /test only/i, /test ping/i, /verifying db/i];
const MIN_SITUATION_LENGTH = 80; // Real digest content is always much longer

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  // Auth check
  const secret = req.headers.get("x-advisory-secret") ?? "";
  if (!ADVISORY_SECRET || secret !== ADVISORY_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  let body: {
    situation?: string;
    carrier_notes?: { carrier: string; status: string; note: string }[];
    surcharges?: { name: string; amount: string; currency: string; trade: string; effective: string }[];
    india_impact?: string;
    source_tags?: string[];
    updated_by?: string;
    force?: boolean; // set true to bypass content validation (admin override only)
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const rawSituation = body.situation ?? "";
  const force = body.force === true;

  // Content validation gate — reject test/garbage payloads
  if (!force) {
    if (rawSituation.length < MIN_SITUATION_LENGTH) {
      return new Response(JSON.stringify({
        error: "Payload rejected: situation too short",
        detail: `Minimum ${MIN_SITUATION_LENGTH} characters required. Got ${rawSituation.length}. Use force:true to override.`,
      }), {
        status: 422,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    for (const pattern of TEST_PATTERNS) {
      if (pattern.test(rawSituation)) {
        return new Response(JSON.stringify({
          error: "Payload rejected: situation looks like test content",
          detail: `Matched pattern: ${pattern}. Use force:true to override.`,
        }), {
          status: 422,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
    }
  }

  // Sanitise all fields
  const situation = escapeHtml(rawSituation);
  const india_impact = escapeHtml(body.india_impact ?? "");
  const updated_by = escapeHtml(body.updated_by ?? "cowork-digest");
  const source_tags = (body.source_tags ?? []).map((t) => escapeHtml(t));

  const carrier_notes = (body.carrier_notes ?? []).map((c) => ({
    carrier: escapeHtml(c.carrier),
    status: escapeHtml(c.status),
    note: escapeHtml(c.note),
  }));

  const surcharges = (body.surcharges ?? []).map((s) => ({
    name: escapeHtml(s.name),
    amount: escapeHtml(s.amount),
    currency: escapeHtml(s.currency),
    trade: escapeHtml(s.trade),
    effective: escapeHtml(s.effective),
  }));

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  const { error } = await supabase
    .from("trade_advisory")
    .upsert(
      {
        id: "current",
        updated_at: new Date().toISOString(),
        updated_by,
        situation,
        carrier_notes,
        surcharges,
        india_impact,
        source_tags,
      },
      { onConflict: "id" }
    );

  if (error) {
    console.error("trade_advisory upsert failed:", error);
    return new Response(JSON.stringify({ error: "DB write failed", detail: error.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true, updated_at: new Date().toISOString() }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
