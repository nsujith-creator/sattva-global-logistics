import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";

const SHIPSGO_BASE = "https://api.shipsgo.com/v2";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

function isContainerNumber(s: string): boolean {
  return /^[A-Z]{4}\d{7}$/.test(s);
}

function normalizeTracking(s: string): string {
  return s.toUpperCase().trim().replace(/\s+/g, "");
}

// Last 10 digits — matches approved_tracking_users.whatsapp format
function normalizeWhatsapp(s: string): string {
  return s.replace(/\D/g, "").slice(-10);
}

function buildCacheKey(trackingNumber: string, carrier: string): string {
  return `${carrier || "AUTO"}:${trackingNumber}`;
}

function hashIp(ip: string): string {
  let h = 0;
  for (const c of ip) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return (h >>> 0).toString(16);
}

function hasMovementData(shipment: Record<string, unknown>): boolean {
  const containers = (shipment.containers as Array<{ movements: unknown[] }>) ?? [];
  return containers.some(c => (c.movements ?? []).length > 0);
}

Deno.serve(async (req: Request) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  const jsonHeaders = { ...cors, "Content-Type": "application/json" };
  const respond = (body: Record<string, unknown>, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: jsonHeaders });

  try {
    const body = await req.json();
    const name = (body.name ?? "").trim();
    const whatsappRaw = (body.whatsapp ?? "").trim();
    const raw = (body.trackingNumber ?? "").trim();
    const carrier = ((body.carrier ?? "").trim()).toUpperCase();
    const pollId = body.pollId ? Number(body.pollId) : null;

    if (!whatsappRaw || whatsappRaw.replace(/\D/g, "").length < 7)
      return respond({ error: "Enter a valid WhatsApp number." }, 400);

    const whatsapp = normalizeWhatsapp(whatsappRaw);
    const token = Deno.env.get("SHIPSGO_API_KEY")!;
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SERVICE_ROLE_KEY")!
    );

    // ── APPROVAL GATE — nothing credit-spending happens for unknown users ──
    const { data: approved } = await sb
      .from("approved_tracking_users")
      .select("status")
      .eq("whatsapp", whatsapp)
      .maybeSingle();

    if (!approved || approved.status !== "approved") {
      // Save the lead anyway — a rejected tracking attempt is still a warm lead
      if (!pollId && name && raw) {
        await sb.from("tracking_leads").insert({
          name, whatsapp: whatsappRaw,
          tracking_number: normalizeTracking(raw),
          carrier: carrier || null,
          cache_key: "NOT_APPROVED",
          ip_hash: hashIp(req.headers.get("x-real-ip") ?? "unknown"),
          from_cache: false,
        });
      }
      return respond({ success: true, notApproved: true });
    }

    // ── POLL PATH — GET only, zero credit spend ──
    if (pollId) {
      const getRes = await fetch(`${SHIPSGO_BASE}/ocean/shipments/${pollId}`, {
        headers: { "X-Shipsgo-User-Token": token },
      });
      const getText = await getRes.text();
      let getData: Record<string, unknown> = {};
      try { getData = JSON.parse(getText); } catch { /* ignore */ }

      if (!getRes.ok) return respond({ success: true, processing: true });

      const s = (getData.shipment as Record<string, unknown>) ?? {};
      const status = String(s.status ?? "");
      const ready = hasMovementData(s) || !["NEW", "INPROGRESS"].includes(status);

      if (ready) {
        // Cache the final result so subsequent lookups skip ShipsGo entirely
        const trackingNumber = String(s.booking_number ?? s.container_number ?? "");
        const cacheKey = buildCacheKey(normalizeTracking(trackingNumber), carrier);
        await sb.from("tracking_cache").insert({
          cache_key: cacheKey, shipsgo_id: pollId, result_json: getData,
        });
        return respond({ success: true, data: getData });
      }
      return respond({ success: true, processing: true, pollId });
    }

    // ── INITIAL REQUEST PATH ──
    if (!name) return respond({ error: "Name is required." }, 400);
    if (!raw) return respond({ error: "Tracking number is required." }, 400);

    const trackingNumber = normalizeTracking(raw);
    const cacheKey = buildCacheKey(trackingNumber, carrier);
    const cutoff = new Date(Date.now() - CACHE_TTL_MS).toISOString();

    // 1. Cache check
    const { data: hit } = await sb
      .from("tracking_cache")
      .select("result_json")
      .eq("cache_key", cacheKey)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Lead write — every initial request
    await sb.from("tracking_leads").insert({
      name, whatsapp: whatsappRaw,
      tracking_number: trackingNumber,
      carrier: carrier || null,
      cache_key: cacheKey,
      ip_hash: hashIp(req.headers.get("x-real-ip") ?? "unknown"),
      from_cache: !!hit,
    });

    if (hit) return respond({ success: true, fromCache: true, data: hit.result_json });

    // 2. POST — this is the credit spend. 409 = exists, no charge.
    const postPayload: Record<string, unknown> = {
      reference: null,
      carrier: carrier || null,
    };
    if (isContainerNumber(trackingNumber)) postPayload.container_number = trackingNumber;
    else postPayload.booking_number = trackingNumber;

    const createRes = await fetch(`${SHIPSGO_BASE}/ocean/shipments`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shipsgo-User-Token": token },
      body: JSON.stringify(postPayload),
    });
    const createText = await createRes.text();
    let createData: Record<string, unknown> = {};
    try { createData = JSON.parse(createText); } catch { /* ignore */ }

    if (!createRes.ok && createRes.status !== 409) {
      console.error("ShipsGo create failed", createRes.status, createText.slice(0, 300));
      return respond({ success: true, data: { error: "tracking_unavailable" } });
    }

    const created = (createData.shipment ?? createData) as Record<string, unknown>;
    const shipmentId = created?.id;
    if (!shipmentId) return respond({ success: true, data: { error: "tracking_unavailable" } });

    // 3. First GET — Maersk often resolves instantly; others need polling
    const getRes = await fetch(`${SHIPSGO_BASE}/ocean/shipments/${shipmentId}`, {
      headers: { "X-Shipsgo-User-Token": token },
    });
    const getText = await getRes.text();
    let getData: Record<string, unknown> = {};
    try { getData = JSON.parse(getText); } catch { /* ignore */ }

    if (!getRes.ok) return respond({ success: true, processing: true, pollId: shipmentId });

    const s = (getData.shipment as Record<string, unknown>) ?? {};
    const status = String(s.status ?? "");
    const ready = hasMovementData(s) || !["NEW", "INPROGRESS"].includes(status);

    if (ready) {
      await sb.from("tracking_cache").insert({
        cache_key: cacheKey, shipsgo_id: shipmentId, result_json: getData,
      });
      return respond({ success: true, data: getData });
    }

    // Not ready — hand the poll ID back to the frontend
    return respond({ success: true, processing: true, pollId: shipmentId });

  } catch (err) {
    console.error("track-container error:", err);
    return respond({ error: "Something went wrong. Please try again." }, 500);
  }
});
