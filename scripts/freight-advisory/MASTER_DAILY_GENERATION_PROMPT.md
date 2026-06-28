# Sattva Freight Intelligence Desk - Master Daily Generation Prompt

## How to use this prompt daily

Daily use:

1. Open Codex in repo `C:\sattva`.
2. Say:
   `Use scripts/freight-advisory/MASTER_DAILY_GENERATION_PROMPT.md.`
   `Today is <date>.`
   `Generate today's advisory artifacts and dry-run only.`
3. Review output.
4. Publish separately using:
   `C:\sattva\scripts\freight-advisory\run-freight-advisory.ps1`

Do not publish.
Do not call the Edge Function.
Do not call Vercel.
Do not modify website source files.
Do not edit Supabase schema.
Do not direct-upsert Supabase.
Do not create the final PDF unless explicitly asked.
Do not commit unless explicitly approved.

## Daily task

Create the daily Sattva Freight Intelligence Desk artifacts only.

Repo:
`C:\sattva`

Output folder:
`C:\sattva\docs\advisories`

Required files for each day:

1. Website advisory payload:
   `C:\sattva\docs\advisories\advisory-payload-YYYY-MM-DD.json`
2. Latest website advisory payload copy:
   `C:\sattva\docs\advisories\advisory-payload-latest.json`
3. LinkedIn draft pack:
   `C:\sattva\docs\advisories\linkedin-post-YYYY-MM-DD.txt`
4. WhatsApp/PDF digest source:
   `C:\sattva\docs\advisories\daily-freight-intelligence-digest-YYYY-MM-DD.md`

The dated website payload and `advisory-payload-latest.json` must be byte-for-byte identical.

## Product identity

Sattva Freight Intelligence Desk is Indian exporter freight intelligence.

It is not a Hormuz crisis tracker and not a generic shipping-news digest.

The desk monitors and interprets:

- Carrier advisories
- Surcharge and rate mechanics
- Blank sailings
- Routing changes
- Port, terminal, gate-in and cut-off disruption
- Indian export logistics
- DGFT, CBIC and GOI trade notifications
- Export promotion council circulars
- Trade body circulars
- GOI trade deals and FTAs
- Geopolitical shifts affecting Indian logistics
- Global logistics developments affecting Indian trade
- Oil and bunker movement where relevant
- Carrier appointments, port leadership and logistics-market structure
- New trends in freight forwarding, shipping, compliance and supply-chain operations

## Desk view first rule

Every advisory must begin with a desk view before it has bullets.

Before writing any output, decide the day's desk view in one sentence.

The desk view must answer:
What changed that affects Indian freight decisions this week?

Good desk view examples:

- July bookings need a fresh freight breakup before exporters quote customers.
- The practical risk today is not the headline rate, but what is included and what is extra.
- Exporters should not quote from an old rate sheet without checking carrier surcharges and validity.
- Gulf risk matters, but shipment-level acceptance and routing confirmation matter more than broad headlines.
- Port schedules are active, but cut-off certainty still needs shipment-level confirmation.

Bad desk view examples:

- Here are today's shipping updates.
- Several developments happened in logistics.
- Hormuz remains important.
- Rates are changing.
- Exporters should monitor the situation.

Do not start with a list of random updates.
Do not write a news digest.
Do not stitch source summaries together.
Do not open with a generic paragraph.

## Signal selection

Research and select only 3 to 5 signals for the day.

Prioritize exporter actionability over headline size.

High-priority signals:

- Change booking decisions this week
- Change surcharge, rate or local-charge exposure
- Affect routing, transit, cut-off or equipment acceptance
- Affect Indian export compliance or documentation
- Affect Gulf, Red Sea, East Africa, Europe, Mediterranean, South Africa or Latin America lanes
- Affect carrier quote validity or customer communication

Medium-priority signals:

- Relevant policy or circular with near-term impact
- Early trend affecting Indian logistics
- Carrier or process change not widely noticed

Low-priority signals:

- Generic geopolitics
- Broad trade optimism
- Distant appointments with no operational consequence
- Old surcharges already absorbed
- Vague "rates may move" claims

For every selected signal, internally record:

- Source name
- Source URL or identifier
- Publication or update date
- Verified fact
- Sattva interpretation
- India/exporter impact
- Confidence: High, Medium or Low
- What remains unverified

## Source discipline

Use only credible, dated sources.

Tier 1 sources:

- Official carrier advisories, newsrooms and tariff notices
- Official port and terminal circulars
- DGFT
- CBIC and customs
- Ministry of Commerce
- Ministry of Ports, Shipping and Waterways
- Export promotion councils
- Trade body circulars
- Official government trade-deal releases

Tier 2 sources:

- Drewry
- Freightos
- Xeneta
- Sea-Intelligence
- Alphaliner
- Recognized shipping and trade publications with date and attribution
- Reputable mainstream news only for geopolitical background

Do not use:

- Unsourced social media
- Random blogs
- AI summaries
- Undated claims
- Vague "market sources"
- Invented container counts
- Invented rates
- Stale surcharge or rate numbers
- Drama-heavy geopolitical commentary

If a source URL, claim or date cannot be verified, do not use it as a selected signal. Put it in open items only if it is worth watching.

## Hormuz and Middle East tapering rule

Include Hormuz, Red Sea or Middle East disruption only as one signal bucket unless it is clearly the day's main operational risk.

If included, focus only on practical exporter impact:

- Carrier acceptance
- Routing
- Surcharges
- Insurance
- Quote validity
- Gulf, Red Sea or Middle East bookings
- Transit reliability
- Cargo-type restrictions
- Direct-delivery or pre-approval conditions

Do not let Hormuz dominate unless it is truly the lead operational risk.

## Writing style

Sattva voice:

- Knowledgeable
- Fast
- Practical
- Business casual
- Premium
- Calm
- Operator-led
- Direct
- Sparse jargon
- No hype
- No generic newsletter fluff
- No shipping analyst theatre
- No "sky is falling"
- No long macro essay

Preferred Indian exporter language:

- full freight breakup
- don't quote from an old rate sheet
- get the full breakup in writing
- check what is included and what is extra
- carrier quote and surcharge breakup matter more
- confirm before booking
- verify before quoting
- rate validity
- local charges
- destination charges
- origin charges
- cargo acceptance
- routing confirmation
- cut-off confirmation
- customer quote
- CFR/CIF number
- shipment-level confirmation

Avoid awkward AI phrasing such as:

- use it as context, not cover
- charge-stack
- acceptance-control
- operationalize the signal
- unlock visibility
- navigate uncertainty
- monitor the situation
- in today's dynamic landscape
- amidst ongoing volatility
- underscores the importance
- it is imperative
- robust framework
- seamless logistics
- end-to-end synergy

## Emoji and lightly engaging style

The desk may sound lightly engaging, but it must stay premium and practical.

Website payload:

- Website payload should stay professional and usually avoid emojis.
- Stay professional.
- Usually avoid emojis.
- Do not include markdown.
- Do not make the website copy look like a social post.

LinkedIn:

- LinkedIn and WhatsApp may use moderate relevant emojis.
- Moderate relevant emojis are allowed.
- Use emojis only when they make the post easier to scan or warmer.
- Avoid emoji clutter.
- Avoid hype and clickbait.
- Each version must stand alone.

PDF digest:

- PDF digest should be premium and structured, with emojis mainly in WhatsApp summary if useful.
- Keep it premium and structured.
- Emojis are usually not needed in the main digest.
- Emojis may be used mainly in the WhatsApp summary if useful.

WhatsApp:

- May use moderate relevant emojis.
- Keep it polished, compact and forwardable.
- Do not make it look like a casual group-chat dump.

## Website advisory payload

Create:

- `C:\sattva\docs\advisories\advisory-payload-YYYY-MM-DD.json`
- `C:\sattva\docs\advisories\advisory-payload-latest.json`

Both JSON files must be byte-for-byte identical.

The `situation` field must open with the desk view. It must not start with generic wording like "For <date>..." unless the sentence still has a clear desk view.

Use exactly this JSON shape:

```json
{
  "date_display": "<DD Month YYYY>",
  "updated_at_display": "<DD Mon YYYY, 3:00 PM IST>",
  "situation": "<desk view + 2-4 sentence advisory summary>",
  "carrier_notes": [
    {
      "carrier": "<carrier/source/topic>",
      "status": "<normal|monitor|restricted|cautious|changed|verify>",
      "note": "<specific operational note>"
    }
  ],
  "surcharges": [
    {
      "carrier": "<carrier>",
      "date": "<effective date or source date>",
      "name": "<surcharge/rate/program name>",
      "amount": "<amount or 'confirm carrier tariff'>",
      "currency": "<currency or 'as quoted'>",
      "trade": "<trade lane>"
    }
  ],
  "india_impact": "<clear exporter action paragraph>",
  "source_tags": [
    "<dated source/source category tag>",
    "<dated source/source category tag>"
  ],
  "verification_markers": [
    "<marker expected in static HTML>",
    "<marker expected in static HTML>",
    "<marker expected in static HTML>"
  ],
  "stale_markers": [
    "<old framing or stale claim that must disappear>",
    "<old framing or stale claim that must disappear>"
  ],
  "updated_by": "windows-deterministic-runner"
}
```

Website payload rules:

- JSON must be valid.
- No markdown in JSON values.
- No comments.
- No trailing commas.
- Do not include URLs unless the current schema expects URLs.
- Use short `source_tags`, not long citations.
- `verification_markers` must be words or phrases expected to appear in the static HTML after publish.
- `stale_markers` should include outdated prior advisory claims that must disappear.
- If no surcharge is freshly verified, do not invent one. If the schema requires a surcharge item, use a conservative "No new verified surcharge" item.
- Keep website copy professional and usually avoid emojis.

## LinkedIn draft pack

Create:
`C:\sattva\docs\advisories\linkedin-post-YYYY-MM-DD.txt`

Create 4 LinkedIn versions:

Version A - Premium operator insight

- 180 to 250 words
- Strong first line
- One clear desk view
- Reads like a founder/operator who knows freight
- End with:
  `Message 'preview' if you want the 7-day Freight Intelligence Desk preview.`

Version B - Exporter education

- 220 to 300 words
- Explain one freight signal clearly
- Useful for exporters, purchase teams and EXIM managers
- Must include what to ask before booking
- No alarmism

Version C - Sattva desk note

- 150 to 220 words
- Concise desk-style daily note
- Formatted cleanly
- Suitable to post as a daily intelligence update
- Must mention `Sattva Freight Intelligence Desk`

Version D - Short punchy post

- 80 to 120 words
- Sharp and memorable
- Not clickbait
- Suitable for quick LinkedIn post

LinkedIn rules:

- Every version must start from the desk view, not from a list of news.
- No fake certainty.
- No panic language.
- No "breaking news" unless truly sourced and fresh.
- Do not over-focus on Hormuz unless it is genuinely the lead.
- Make Sattva look informed, not alarmist.
- Include source confidence in plain English if needed.
- Each version must stand alone.
- Mention Sattva Freight Intelligence Desk naturally, not like an ad.
- Moderate relevant emojis are allowed, but do not overuse them.

## WhatsApp/PDF digest source

Create:
`C:\sattva\docs\advisories\daily-freight-intelligence-digest-YYYY-MM-DD.md`

This is the source file for a future PDF digest shared on WhatsApp.

Required structure:

```markdown
# Sattva Freight Intelligence Digest

Date: <DD Month YYYY>
Prepared by: Sattva Global Logistics

## Desk view

Write 2-3 tight paragraphs.
This must open with the desk view.
No generic intro.
No random bullet lead.

## Lead intelligence

* Signal:
* What changed:
* Why it matters:
* Sattva interpretation:
* Exporter action:
* Confidence:
* Source trail:

## Secondary signals

Include 2-3 secondary signals only.
For each:

* Signal:
* What changed:
* Exporter action:
* Confidence:
* Source trail:

## Charge watch / Operations watch / Policy watch

Use the best table for the selected signals:

| Item | Source date | Lane / scope | What to verify before quoting |
| --- | --- | --- | --- |

## India exporter checklist

Maximum 7 bullets.
Every bullet must begin with a verb:

* Confirm...
* Ask...
* Check...
* Revalidate...
* Separate...
* Avoid...

## What not to assume

Short section with 4 bullets.

## Watch tomorrow

3-5 bullets only.

## Source trail

List source names and dates only.
No long URLs unless already clean and necessary.

## WhatsApp forward

Write a polished 7-9 line WhatsApp-ready summary.
It should sound premium, not like a rough note.
It should be forwardable to exporters.
End with:
"Sattva Global Logistics - Freight Intelligence Desk"
```

PDF digest rules:

- This is not a glossy magazine.
- It must be compact and useful.
- No generic introduction.
- No huge paragraphs.
- No filler.
- No unsupported claims.
- Separate verified facts from Sattva interpretation.
- Every actionable claim must be tied to a source or clearly framed as operator interpretation.
- Prefer "verify before booking" over pretending certainty.
- Keep the main PDF digest premium and structured.
- Use emojis mainly in the WhatsApp summary if useful.

## Dry-run requirement

After creating the artifacts, run dry-run only:

```powershell
& 'C:\sattva\scripts\freight-advisory\run-freight-advisory.ps1' -PayloadPath 'C:\sattva\docs\advisories\advisory-payload-latest.json' -DryRun
```

Do not run the deterministic publisher without `-DryRun`.
Do not run real publish.
Do not call the Edge Function.
Do not call Vercel.
Do not direct-upsert Supabase.
Do not modify website source files.
Do not edit Supabase schema.
Do not commit.

## Final report requirements

The final report must include:

- Desk view selected
- Files created or modified
- Confirmation that both payload JSON files are identical
- Dry-run result
- Real publish attempted: no
- Edge Function called: no
- Vercel hook called: no
- Direct Supabase upsert used: no
- Website source files modified: no
- Secrets exposed: no
- Sources used with dates
- Selected signals
- Unverified/open items
- `git status --short`

Keep the final report direct and evidence-led.
