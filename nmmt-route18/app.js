import {
  computeTripPlan,
  detectServiceProfileKey,
  enrichRouteData,
  findNearestStop,
  rankStopMatches
} from "./route18-core.js";

const state = {
  routeData: null,
  sourceStopId: "",
  destinationStopId: "",
  sourceQuery: "",
  destinationQuery: "",
  nearestSuggestion: null,
  walkingMinutes: 5,
  dayProfile: "auto"
};

const sourceInput = document.querySelector("#source-input");
const destinationInput = document.querySelector("#destination-input");
const sourceSuggestions = document.querySelector("#source-suggestions");
const destinationSuggestions = document.querySelector("#destination-suggestions");
const resultCard = document.querySelector("#result-card");
const walkingInput = document.querySelector("#walking-input");
const walkingValue = document.querySelector("#walking-value");
const dayProfile = document.querySelector("#day-profile");
const locationSummary = document.querySelector("#location-summary");
const statusMessage = document.querySelector("#status-message");

init();

async function init() {
  const response = await fetch("./data/route18.json");
  const routeData = enrichRouteData(await response.json());
  state.routeData = routeData;
  walkingValue.textContent = `${state.walkingMinutes} min`;
  renderLocationSummary();
  renderIdleState();
  bindEvents();
}

function bindEvents() {
  sourceInput.addEventListener("input", (event) => {
    state.sourceQuery = event.target.value;
    state.sourceStopId = "";
    renderSuggestions("source");
    renderResult();
  });
  sourceInput.addEventListener("blur", () => window.setTimeout(() => commitBestMatch("source"), 100));
  sourceInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") commitBestMatch("source");
  });

  destinationInput.addEventListener("input", (event) => {
    state.destinationQuery = event.target.value;
    state.destinationStopId = "";
    renderSuggestions("destination");
    renderResult();
  });
  destinationInput.addEventListener("blur", () => window.setTimeout(() => commitBestMatch("destination"), 100));
  destinationInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") commitBestMatch("destination");
  });

  walkingInput.addEventListener("input", (event) => {
    state.walkingMinutes = Number(event.target.value);
    walkingValue.textContent = `${state.walkingMinutes} min`;
    renderResult();
  });

  dayProfile.addEventListener("change", (event) => {
    state.dayProfile = event.target.value;
    renderResult();
  });

  document.querySelector("#swap-stops").addEventListener("click", () => {
    const previousSourceId = state.sourceStopId;
    const previousSourceQuery = state.sourceQuery;
    state.sourceStopId = state.destinationStopId;
    state.sourceQuery = state.destinationQuery;
    state.destinationStopId = previousSourceId;
    state.destinationQuery = previousSourceQuery;
    sourceInput.value = state.sourceQuery;
    destinationInput.value = state.destinationQuery;
    clearSuggestionPanels();
    renderResult();
  });

  document.querySelector("#use-location").addEventListener("click", () => {
    const hasCoordinates = state.routeData.stops.some((stop) => (stop.geo_points || []).length > 0);
    if (!hasCoordinates) {
      statusMessage.textContent =
        "Manual mode is active because Route 18 stop coordinates are still blank in route18.json. Add coordinates later to unlock nearby stop detection.";
      return;
    }

    if (!navigator.geolocation) {
      statusMessage.textContent = "This browser does not support geolocation. Pick your stop manually instead.";
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nearestSuggestion = findNearestStop({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          stops: state.routeData.stops,
          destinationStopId: state.destinationStopId || null
        });

        if (!nearestSuggestion) {
          statusMessage.textContent = "Your location was read, but no Route 18 stop coordinates are usable yet.";
          return;
        }

        state.nearestSuggestion = nearestSuggestion;
        state.walkingMinutes = Math.min(20, nearestSuggestion.walking_minutes);
        walkingInput.value = String(state.walkingMinutes);
        walkingValue.textContent = `${state.walkingMinutes} min`;
        applyStopSelection("source", nearestSuggestion.stop);
        renderLocationSummary();
        statusMessage.textContent = "Location-based boarding stop suggested. You can still override it manually.";
      },
      () => {
        statusMessage.textContent = "Location access was denied. Pick your boarding stop manually.";
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".field")) clearSuggestionPanels();
  });
}

function renderLocationSummary() {
  if (!state.nearestSuggestion) {
    locationSummary.innerHTML = "";
    locationSummary.hidden = true;
    return;
  }

  const suggestion = state.nearestSuggestion;
  locationSummary.hidden = false;
  locationSummary.innerHTML = `
    <strong>Nearest Route 18 stop:</strong> ${suggestion.stop.name}<br>
    Distance: ${suggestion.distance_meters} m | Estimated walk: ${suggestion.walking_minutes} min<br>
    ${suggestion.point_label}
  `;
}

function renderSuggestions(kind) {
  const query = kind === "source" ? state.sourceQuery : state.destinationQuery;
  const host = kind === "source" ? sourceSuggestions : destinationSuggestions;
  const matches = rankStopMatches(query, state.routeData.stops);

  if (!query.trim() || matches.length === 0) {
    host.innerHTML = "";
    return;
  }

  host.innerHTML = `
    <div class="suggestion-list">
      ${matches
        .map(
          (stop) => `
            <button class="suggestion-item" type="button" data-kind="${kind}" data-stop-id="${stop.id}">
              <span class="suggestion-name">${stop.name}</span>
              <span class="suggestion-meta">${stop.location_hint} | Stop ${stop.sequence}</span>
            </button>
          `
        )
        .join("")}
    </div>
  `;

  host.querySelectorAll(".suggestion-item").forEach((button) => {
    button.addEventListener("click", () => {
      const stop = state.routeData.stops.find((item) => item.id === button.dataset.stopId);
      if (!stop) return;
      applyStopSelection(kind, stop);
    });
  });
}

function applyStopSelection(kind, stop) {
  if (kind === "source") {
    state.sourceStopId = stop.id;
    state.sourceQuery = stop.name;
    sourceInput.value = stop.name;
  } else {
    state.destinationStopId = stop.id;
    state.destinationQuery = stop.name;
    destinationInput.value = stop.name;
  }
  clearSuggestionPanels();
  renderResult();
}

function commitBestMatch(kind) {
  const query = kind === "source" ? state.sourceQuery : state.destinationQuery;
  const selectedId = kind === "source" ? state.sourceStopId : state.destinationStopId;
  if (selectedId || !query.trim()) {
    clearSuggestionPanels();
    return;
  }
  const bestMatch = rankStopMatches(query, state.routeData.stops)[0];
  if (bestMatch) applyStopSelection(kind, bestMatch);
  else clearSuggestionPanels();
}

function clearSuggestionPanels() {
  sourceSuggestions.innerHTML = "";
  destinationSuggestions.innerHTML = "";
}

function renderIdleState() {
  const route = state.routeData.route;
  const weekday = state.routeData.service.profiles.weekday;
  const holiday = state.routeData.service.profiles.holiday;
  resultCard.className = "result-card";
  resultCard.innerHTML = `
    <section class="route-facts">
      <h3>Route 18 snapshot</h3>
      <div class="route-facts-grid">
        <div class="fact-chip"><span>Direction</span><strong>${route.origin_name} to ${route.destination_name}</strong></div>
        <div class="fact-chip"><span>Runtime model</span><strong>${state.routeData.eta_model.default_total_runtime_minutes} min in-bus baseline</strong></div>
        <div class="fact-chip"><span>Weekday frequency</span><strong>${weekday.frequency_label}</strong></div>
        <div class="fact-chip"><span>Holiday frequency</span><strong>${holiday.frequency_label}</strong></div>
        <div class="fact-chip"><span>Reference evidence</span><strong>${state.routeData.eta_model.reference_in_bus_stop_count} stops | ${state.routeData.eta_model.reference_runtime_note}</strong></div>
        <div class="fact-chip"><span>Current mode</span><strong>Location assist plus manual override</strong></div>
      </div>
      <p class="empty-note" style="margin-top:16px;">
        Pick any two Route 18 stops to get direction, estimated wait, estimated ride time, stop count, and a model-based arrival estimate.
      </p>
    </section>
  `;
}

function renderResult() {
  if (!state.routeData) return;

  const plan = computeTripPlan({
    routeData: state.routeData,
    sourceStopId: state.sourceStopId,
    destinationStopId: state.destinationStopId,
    walkingMinutes: state.walkingMinutes,
    profileKey: state.dayProfile,
    now: new Date()
  });

  if (!state.sourceStopId || !state.destinationStopId) {
    renderIdleState();
    return;
  }

  if (!plan) {
    resultCard.className = "result-empty";
    resultCard.textContent = "Pick two different Route 18 stops in the order you want to travel.";
    return;
  }

  const profileLabel = detectServiceProfileKey(state.dayProfile) === "holiday" ? "Sunday / holiday service" : "Monday to Saturday service";
  const previewStops = plan.downstreamStops.slice(1, 5);

  resultCard.className = "result-card";
  resultCard.innerHTML = `
    <section class="compact-hero">
      <p class="eyebrow">Route 18 answer</p>
      <h3 class="route-command">Board Route 18 toward ${plan.direction.to_terminal_name}.</h3>
      <p class="route-subtitle">
        Walk about ${state.walkingMinutes} min to ${plan.sourceStop.name}, then get down at ${plan.destinationStop.name}.<br>
        This planner is still model-based and uses static Route 18 timetable plus stop-sequence data.
      </p>
    </section>

    <section class="metric-grid">
      <article class="metric">
        <span class="metric-label">Estimated wait</span>
        <strong>${plan.waitEstimate.service_active ? `${plan.waitEstimate.estimated_wait_minutes} min` : "No service now"}</strong>
        <small>${plan.waitEstimate.note}</small>
      </article>
      <article class="metric">
        <span class="metric-label">Estimated ride</span>
        <strong>${plan.ride_minutes} min</strong>
        <small>Modeled from a ${state.routeData.eta_model.default_total_runtime_minutes}-minute full-route baseline.</small>
      </article>
      <article class="metric">
        <span class="metric-label">Estimated arrival</span>
        <strong>${plan.arrival_clock || "Unavailable"}</strong>
        <small>${plan.total_minutes !== null ? `About ${plan.total_minutes} min total from now.` : "Try again during service hours."}</small>
      </article>
    </section>

    <section class="summary-grid">
      <article class="summary-card">
        <h3>Trip summary</h3>
        <ul>
          <li>Boarding stop: <strong>${plan.sourceStop.name}</strong></li>
          <li>Destination stop: <strong>${plan.destinationStop.name}</strong></li>
          <li>Stops remaining: <strong>${plan.stop_count_remaining}</strong></li>
          <li>Service profile: <strong>${profileLabel}</strong></li>
        </ul>
      </article>

      <article class="summary-card">
        <h3>First / last bus</h3>
        <ul>
          <li>Direction: <strong>${plan.direction.label}</strong></li>
          <li>First bus: <strong>${plan.direction.first_bus}</strong> from ${plan.direction.from_terminal_name}</li>
          <li>Last bus: <strong>${plan.direction.last_bus}</strong> from ${plan.direction.from_terminal_name}</li>
          <li>Wait model: <strong>${plan.waitEstimate.wait_range_label}</strong></li>
        </ul>
      </article>
    </section>

    <section class="timeline-card">
      <h3>Downstream stops</h3>
      <p>${plan.model_note}</p>
      <div class="timeline-list">
        ${plan.downstreamStops
          .map(
            (stop) => `
              <div class="timeline-item ${stop.id === plan.sourceStop.id ? "is-board" : ""} ${stop.id === plan.destinationStop.id ? "is-destination" : ""}">
                <div class="timeline-dot"></div>
                <div>
                  <strong>${stop.name}</strong>
                  <span>${stop.location_hint}${stop.id === plan.sourceStop.id ? " | Board here" : ""}${stop.id === plan.destinationStop.id ? " | Get down here" : ""}</span>
                </div>
                <div class="timeline-time">+${Math.round(stop.ride_minutes_from_boarding)} min</div>
              </div>
            `
          )
          .join("")}
      </div>
    </section>

    <section class="route-facts">
      <h3>Quick trust notes</h3>
      <div class="route-facts-grid">
        <div class="fact-chip"><span>Route runtime</span><strong>${state.routeData.eta_model.default_total_runtime_minutes} min in-bus baseline</strong></div>
        <div class="fact-chip"><span>Google reference</span><strong>${state.routeData.eta_model.reference_in_bus_stop_count} stops | ${state.routeData.eta_model.reference_runtime_note}</strong></div>
        <div class="fact-chip"><span>Current stop density</span><strong>${state.routeData.derived.total_stops} editable stop entries</strong></div>
        <div class="fact-chip"><span>Coordinates</span><strong>${state.routeData.stops.some((stop) => (stop.geo_points || []).length > 0) ? "Available" : "Still blank"}</strong></div>
      </div>
      <details class="route-details">
        <summary>Show full stop sequence for Route 18</summary>
        <ol class="full-route-list">
          ${state.routeData.stops
            .map((stop) => `<li><strong>${stop.name}</strong><span>${stop.location_hint}</span></li>`)
            .join("")}
        </ol>
      </details>
      <details class="route-details">
        <summary>Show next stop preview only</summary>
        <ol class="full-route-list">
          ${previewStops.map((stop) => `<li><strong>${stop.name}</strong><span>${stop.location_hint}</span></li>`).join("")}
        </ol>
      </details>
    </section>
  `;
}
