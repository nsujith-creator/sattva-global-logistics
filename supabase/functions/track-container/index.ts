import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const SHIPSGO_BASE = "https://api.shipsgo.com/v2";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// ISO 6346 container number: 4 alpha + 7 digits (e.g. MRKU9410437)
function isContainerNumber(s: string): boolean {
  return /^[A-Z]{4}\d{7}$/.test(s);
}

function normalizeTracking(s: string): string {
  return s.toUpperCase().trim().replace(/\s+/g, "");
}

function buildCacheKey(trackingNumber: string, carrier: string): string {
  return `${carrier || "AUTO"}:${trackingNumber}`;
}

function hashIp(ip: string): string {
  let h = 0;
  for (const c of ip) {
    h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  }
  return (h >>> 0).toString(16);
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const jsonHeaders = { ...cors, "Content-Type": "application/json" };
  const fail = (msg: string, status = 400) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: jsonHeaders });
  const noData = () =>
    new Response(JSON.stringify({ success: true, data: { error: "tracking_unavailable" } }), {
      status: 200, headers: jsonHeaders,
    });

  try {
    const body = await req.json();
    const name = (body.name ?? "").trim();
    const whatsapp = (body.whatsapp ?? "").trim();
    const raw = (body.trackingNumber ?? "").trim();
    const carrier = ((body.carrier ?? "").trim()).toUpperCase();

    if (!name) return fail("Name is required.");
    if (!whatsapp || whatsapp.replace(/\D/g, "").length < 7)
      return fail("Enter a valid WhatsApp number.");
    if (!raw) return fail("Tracking number is required.");

    const trackingNumber = normalizeTracking(raw);
    const cacheKey = buildCacheKey(trackingNumber, carrier);
    const ip = req.headers.get("cf-connecting-ip") ??
      req.headers.get("x-real-ip") ?? "unknown";
    const ipHash = hashIp(ip);
    const token = Deno.env.get("SHIPSGO_API_KEY")!;
    const cutoff = new Date(Date.now() - CACHE_TTL_MS).toISOString();

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    // 1. Cache check — skip ShipsGo if same tracking number was looked up in last 24h
    const { data: hit } = await sb
      .from("tracking_cache")
      .select("result_json")
      .eq("cache_key", cacheKey)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let result: Record<string, unknown>;
    let fromCache = false;

    if (hit) {
      result = hit.result_json as Record<string, unknown>;
      fromCache = true;
    } else {
      // 2. POST to ShipsGo — creates or returns existing (409 = already tracked, no credit spend)
      const postPayload: Record<string, unknown> = {
        reference: null,
        carrier: carrier || null,
      };
      if (isContainerNumber(trackingNumber)) {
        postPayload.container_number = trackingNumber;
      } else {
        postPayload.booking_number = trackingNumber;
      }

      const createRes = await fetch(`${SHIPSGO_BASE}/ocean/shipments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shipsgo-User-Token": token,
        },
        body: JSON.stringify(postPayload),
      });

      const createText = await createRes.text();
      let createData: Record<string, unknown> = {};
      try { createData = JSON.parse(createText); } catch { /* ignore */ }

      // 200 = new shipment created; 409 = already exists — both return shipment with id
      if (!createRes.ok && createRes.status !== 409) {
        console.error("ShipsGo create failed", createRes.status, createText.slice(0, 300));
        return noData();
      }

      const created = (createData.shipment ?? createData) as Record<string, unknown>;
      const shipmentId = created?.id;
      if (!shipmentId) return noData();

      // 3. GET full shipment detail (route + movements)
      const getRes = await fetch(`${SHIPSGO_BASE}/ocean/shipments/${shipmentId}`, {
        headers: { "X-Shipsgo-User-Token": token },
      });
      const getText = await getRes.text();
      let getData: Record<string, unknown> = {};
      try { getData = JSON.parse(getText); } catch { /* ignore */ }

      if (!getRes.ok) {
        console.error("ShipsGo GET failed", getRes.status, getText.slice(0, 300));
        return noData();
      }

      result = getData;

      // 4. Cache only when we have real movement data (not just NEW/INPROGRESS with nothing)
      const s = (getData.shipment as Record<string, unknown>) ?? {};
      const containers = (s.containers as Array<{ movements: unknown[] }>) ?? [];
      const hasMovements = containers.some(c => (c.movements ?? []).length > 0);
      const status = String(s.status ?? "");
      if (hasMovements || !["NEW", "INPROGRESS"].includes(status)) {
        await sb.from("tracking_cache").insert({
          cache_key: cacheKey,
          shipsgo_id: shipmentId,
          result_json: result,
        });
      }
    }

    // 5. Save lead on every request (even cache hits — different person may have searched)
    await sb.from("tracking_leads").insert({
      name,
      whatsapp,
      tracking_number: trackingNumber,
      carrier: carrier || null,
      cache_key: cacheKey,
      ip_hash: ipHash,
      from_cache: fromCache,
    });

    return new Response(JSON.stringify({ success: true, fromCache, data: result }), {
      status: 200, headers: jsonHeaders,
    });

  } catch (err) {
    console.error("track-container error:", err);
    return new Response(
      JSON.stringify({ error: "Something went wrong. Please try again." }),
      { status: 500, headers: jsonHeaders }
    );
  }
});
