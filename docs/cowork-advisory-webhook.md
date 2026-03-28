# Cowork → Sattva Trade Advisory — Webhook Integration

## Endpoint
POST https://cakmipiqchlotuhahuds.supabase.co/functions/v1/update-advisory

## Auth Header (must be set in Cowork task)
X-Advisory-Secret: <value of ADVISORY_SECRET in Supabase dashboard>

## Content-Type
application/json

## Schedule
Run at: 09:00 IST and 15:00 IST every day

## Payload Schema
{
  "updated_by": "cowork-digest-9am",
  "situation": "string — 1-3 paragraphs describing current situation",
  "india_impact": "string — India-specific impact, JNPT/Mundra origin focus",
  "source_tags": ["MSC", "Maersk", "UKMTO"],
  "carrier_notes": [
    {
      "carrier": "Maersk",
      "status": "disrupted",
      "note": "Free text — what is happening with this carrier"
    }
  ],
  "surcharges": [
    {
      "name": "Emergency Contingency Surcharge",
      "amount": "USD 150",
      "currency": "USD",
      "trade": "India-Gulf",
      "effective": "01 Apr 2026 onwards"
    }
  ]
}

## Status Values
normal | disrupted | suspended | diverted

## ADVISORY_SECRET setup
Supabase dashboard -> Project Settings -> Edge Functions -> Secrets
Add: ADVISORY_SECRET = <strong 32-char random string>
