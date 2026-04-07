# NMMT Route 18 MVP

Standalone single-route commuter planner for NMMT Route 18.

This project is intentionally small:

- no framework
- no heavy dependencies
- no live GPS feed
- no fake live ETA claims
- Route 18 only

## Project structure

```text
nmmt-route18/
  data/
    route18.json
  app.js
  index.html
  route18-core.js
  server.mjs
  styles.css
  package.json
  README.md
```

## Run locally

```powershell
Set-Location C:\sattva\nmmt-route18
npm start
```

Open:

```text
http://127.0.0.1:4178
```

## What `route18.json` contains

The file is the source of truth for the Route 18 MVP.

Top-level sections:

- `route`: basic route metadata
- `service`: weekday / holiday frequency and first / last bus in each direction
- `eta_model`: current runtime assumptions and wait-model settings
- `stops`: ordered Route 18 stop sequence

## How the data file works

### Route metadata

`route` stores:

- route number
- route name
- route type
- terminals
- via text

### Service data

`service.profiles` stores:

- label
- frequency label
- min frequency
- typical frequency
- max frequency

`service.directions` stores:

- directional label
- from terminal
- to terminal
- first bus
- last bus

### ETA model

`eta_model` stores:

- `default_total_runtime_minutes`
- `reference_in_bus_stop_count`
- `reference_runtime_note`
- `default_wait_strategy`
- `display_note`

Current Route 18 assumption:

- Google screenshots show the in-bus ride as about `75 stops` and `1 hr 36 min`
- this MVP therefore uses `96 minutes` as the full-route in-bus baseline
- the larger `2 hr 4 min` screenshot time is not used as pure bus runtime because it includes walking

## How ETA is calculated today

1. The app determines direction from the selected source stop and destination stop.
2. It selects the right first-bus / last-bus window for that direction.
3. It selects the right service profile for weekday or holiday.
4. If a stop has an explicit `cumulative_minutes_from_origin`, that value is used.
5. If explicit cumulative minutes are missing, the app derives them from:
   - the `96-minute` full-route runtime baseline
   - the `75-stop` Google reference
   - the actual editable stop sequence length in `route18.json`
6. Wait time is modeled from service frequency:
   - before first bus: wait until first bus
   - during service: use half-headway as the estimate
   - after last bus: show that service is likely closed for the day

Important:

- all ETAs are model-based
- nothing in this MVP is live vehicle data

## How to edit stops

Every stop lives under `stops`.

Each stop currently supports:

- `id`
- `name`
- `location_hint`
- `aliases`
- `lat`
- `lng`
- `cumulative_minutes_from_origin`

### Add or edit aliases

Add alternative user-facing names in `aliases`.

Example:

```json
{
  "id": "ghansoli-railway-station",
  "name": "Ghansoli Railway Station",
  "location_hint": "Ghansoli",
  "aliases": ["ghansoli station", "ghansoli stn"],
  "lat": null,
  "lng": null,
  "cumulative_minutes_from_origin": null
}
```

Aliases help with:

- case-insensitive search
- partial matches
- alternate spellings
- common short names

### Add coordinates later

Coordinates are optional.

To enable better nearby-stop detection later, replace:

```json
"lat": null,
"lng": null
```

with real values, for example:

```json
"lat": 19.123456,
"lng": 73.012345
```

If coordinates stay blank, the app still works in manual mode.

### Add explicit stop timing later

If you later get better timing data, update:

```json
"cumulative_minutes_from_origin": null
```

with an actual number.

Example:

```json
"cumulative_minutes_from_origin": 42
```

When explicit cumulative stop minutes exist, they are preferred over the derived runtime model.

## Screenshot usage in this MVP

The Google screenshots are used as observational route evidence only.

They were used to improve:

- stop naming
- alias handling
- sequence confidence
- runtime baseline

They are not treated as:

- live bus tracking
- live ETA
- live departure status

## Limitations

- Route 18 only
- no multi-route support
- no transfers
- no fare calculation
- no live bus positions
- no official GTFS feed
- some stop names are still best-effort reconciliations from screenshots and static route references
- coordinates are still blank until manually added

## Best next improvement

Add real stop coordinates to `route18.json`.

That unlocks:

- proper nearby-stop detection
- cleaner current-location boarding suggestions
- better walking-to-stop guidance

After coordinates, the next best improvement is explicit cumulative minutes for key anchor stops.
