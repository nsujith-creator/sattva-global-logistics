export function normalizeText(value) {
  return (value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\(w\)/g, " west ")
    .replace(/\(e\)/g, " east ")
    .replace(/\bstn\b/g, " station ")
    .replace(/\bstn\./g, " station ")
    .replace(/\bsec\b/g, " sector ")
    .replace(/\bdept\b/g, " depot ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseClockTime(value) {
  const safe = String(value || "").replace(".", ":");
  const [hours, minutes] = safe.split(":").map(Number);
  return (hours * 60) + minutes;
}

export function formatClockTime(date) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true
  }).format(date);
}

export function detectServiceProfileKey(selectedKey, now = new Date()) {
  if (selectedKey && selectedKey !== "auto") {
    const normalizedKey = String(selectedKey).toLowerCase();
    if (normalizedKey === "monday_to_saturday") return "weekday";
    if (normalizedKey === "sunday_and_holidays") return "holiday";
    return normalizedKey;
  }
  return now.getDay() === 0 ? "holiday" : "weekday";
}

const DIRECTION_POINT_KEYS = {
  inbound: "to_ghansoli",
  outbound: "to_kharkopar"
};

const DIRECTION_POINT_LABELS = {
  shared: "shared stop point",
  to_ghansoli: "boarding side toward Ghansoli Depot",
  to_kharkopar: "boarding side toward Kharkopar Railway Station"
};

export function enrichRouteData(routeData) {
  const totalStops = routeData.stops.length;
  const etaModel = routeData.eta_model;
  const referenceSegmentMinutes = etaModel.default_total_runtime_minutes / Math.max(etaModel.reference_in_bus_stop_count - 1, 1);
  const actualDensityFactor = (etaModel.reference_in_bus_stop_count - 1) / Math.max(totalStops - 1, 1);

  const stops = routeData.stops.map((stop, index) => {
    const sequence = index + 1;
    const normalizedName = normalizeText(stop.name);
    const normalizedAliases = (stop.aliases || []).map((alias) => normalizeText(alias));
    const geoPoints = buildGeoPoints(stop);
    const sharedPoint = geoPoints.find((point) => point.key === "shared") || null;
    const resolvedCumulativeMinutes =
      typeof stop.cumulative_minutes_from_origin === "number"
        ? stop.cumulative_minutes_from_origin
        : Number((index * referenceSegmentMinutes * actualDensityFactor).toFixed(1));

    return {
      ...stop,
      lat: Number.isFinite(stop.lat) ? stop.lat : sharedPoint?.lat ?? null,
      lng: Number.isFinite(stop.lng) ? stop.lng : sharedPoint?.lng ?? null,
      sequence,
      normalized_name: normalizedName,
      normalized_aliases: normalizedAliases,
      search_blob: [normalizedName, ...normalizedAliases].join(" "),
      geo_points: geoPoints,
      resolved_cumulative_minutes: resolvedCumulativeMinutes
    };
  });

  return {
    ...routeData,
    derived: {
      total_stops: totalStops,
      reference_segment_minutes: Number(referenceSegmentMinutes.toFixed(2)),
      actual_segment_minutes: Number((referenceSegmentMinutes * actualDensityFactor).toFixed(2))
    },
    stops
  };
}

export function rankStopMatches(query, stops) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) return [];

  const queryTokens = normalizedQuery.split(" ").filter(Boolean);
  return stops
    .map((stop) => {
      const terms = [stop.normalized_name, ...stop.normalized_aliases];
      const exact = terms.some((term) => term === normalizedQuery);
      const startsWith = terms.some((term) => term.startsWith(normalizedQuery));
      const includes = terms.some((term) => term.includes(normalizedQuery));
      const tokenCoverage = terms.some((term) => queryTokens.every((token) => term.includes(token)));
      const locationHint = normalizeText(stop.location_hint || "");
      const locationMatch = locationHint && queryTokens.every((token) => locationHint.includes(token));

      let score = 0;
      if (exact) score += 120;
      if (startsWith) score += 70;
      if (includes) score += 40;
      if (tokenCoverage) score += 30;
      if (locationMatch) score += 10;

      return { stop, score };
    })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.stop.sequence - right.stop.sequence)
    .slice(0, 8)
    .map((item) => item.stop);
}

export function findStopById(stops, stopId) {
  return stops.find((stop) => stop.id === stopId) || null;
}

export function estimateWalkingMinutes(distanceMeters) {
  if (!Number.isFinite(distanceMeters) || distanceMeters <= 0) return 0;
  if (distanceMeters < 25) return 0;
  return Math.max(1, Math.round(distanceMeters / 80));
}

export function computeTripPlan({ routeData, sourceStopId, destinationStopId, walkingMinutes = 0, profileKey = "auto", now = new Date() }) {
  const profile = routeData.service.profiles[detectServiceProfileKey(profileKey, now)];
  const sourceStop = findStopById(routeData.stops, sourceStopId);
  const destinationStop = findStopById(routeData.stops, destinationStopId);

  if (!sourceStop || !destinationStop || sourceStop.id === destinationStop.id) {
    return null;
  }

  const directionKey = destinationStop.sequence > sourceStop.sequence ? "outbound" : "inbound";
  const direction = routeData.service.directions[directionKey];
  const orderedStops = directionKey === "outbound" ? routeData.stops : [...routeData.stops].reverse();
  const sourceIndex = orderedStops.findIndex((stop) => stop.id === sourceStop.id);
  const destinationIndex = orderedStops.findIndex((stop) => stop.id === destinationStop.id);

  if (sourceIndex === -1 || destinationIndex === -1 || destinationIndex <= sourceIndex) {
    return null;
  }

  const downstreamStops = orderedStops.slice(sourceIndex, destinationIndex + 1);
  const rideMinutes = Number(Math.abs(destinationStop.resolved_cumulative_minutes - sourceStop.resolved_cumulative_minutes).toFixed(1));
  const waitEstimate = estimateWait({
    firstBus: direction.first_bus,
    lastBus: direction.last_bus,
    frequencyMin: profile.frequency_min_minutes,
    frequencyMax: profile.frequency_max_minutes,
    frequencyTypical: profile.frequency_typical_minutes,
    now
  });
  const totalMinutes = waitEstimate.service_active ? Math.round(walkingMinutes + waitEstimate.estimated_wait_minutes + rideMinutes) : null;
  const arrivalTime = totalMinutes === null ? null : new Date(now.getTime() + totalMinutes * 60000);

  return {
    sourceStop,
    destinationStop,
    profile,
    direction,
    downstreamStops: downstreamStops.map((stop) => ({
      ...stop,
      ride_minutes_from_boarding: Number(Math.abs(stop.resolved_cumulative_minutes - sourceStop.resolved_cumulative_minutes).toFixed(1))
    })),
    ride_minutes: Math.round(rideMinutes),
    stop_count_remaining: downstreamStops.length - 1,
    waitEstimate,
    total_minutes: totalMinutes,
    arrival_clock: arrivalTime ? formatClockTime(arrivalTime) : null,
    model_note: routeData.eta_model.display_note
  };
}

export function estimateWait({ firstBus, lastBus, frequencyMin, frequencyMax, frequencyTypical, now = new Date() }) {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const firstBusMinutes = parseClockTime(firstBus);
  const lastBusMinutes = parseClockTime(lastBus);

  if (nowMinutes < firstBusMinutes) {
    return {
      service_active: true,
      estimated_wait_minutes: firstBusMinutes - nowMinutes,
      wait_range_label: `0-${frequencyMax} min`,
      note: `First bus for this direction is at ${firstBus}.`
    };
  }

  if (nowMinutes > lastBusMinutes) {
    return {
      service_active: false,
      estimated_wait_minutes: Math.round(frequencyTypical / 2),
      wait_range_label: `0-${frequencyMax} min`,
      note: `Last bus for this direction left at ${lastBus}.`
    };
  }

  return {
    service_active: true,
    estimated_wait_minutes: Math.round(frequencyTypical / 2),
    wait_range_label: `0-${frequencyMax} min`,
    note: `Wait is modeled from the ${frequencyMin}-${frequencyMax} minute service frequency.`
  };
}

export function findNearestStop({ latitude, longitude, stops, destinationStopId = null }) {
  const destinationStop = destinationStopId ? findStopById(stops, destinationStopId) : null;
  const candidates = stops
    .filter((stop) => stop.geo_points?.length)
    .filter((stop) => !destinationStop || stop.id !== destinationStop.id)
    .map((stop) => {
      const selectedPoint = pickPreferredGeoPoint(stop, destinationStop, latitude, longitude);
      if (!selectedPoint) return null;

      return {
        stop,
        point_key: selectedPoint.key,
        point_label: DIRECTION_POINT_LABELS[selectedPoint.key] || DIRECTION_POINT_LABELS.shared,
        distance_km: selectedPoint.distance_km
      };
    })
    .filter(Boolean)
    .sort((left, right) => left.distance_km - right.distance_km || left.stop.sequence - right.stop.sequence);

  if (candidates.length === 0) return null;

  const nearest = candidates[0];
  const distanceMeters = Math.round(nearest.distance_km * 1000);
  return {
    stop: nearest.stop,
    point_key: nearest.point_key,
    point_label: nearest.point_label,
    distance_meters: distanceMeters,
    walking_minutes: estimateWalkingMinutes(distanceMeters)
  };
}

function haversine(lat1, lon1, lat2, lon2) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function buildGeoPoints(stop) {
  const points = [];
  const geo = stop.geo || {};

  const sharedLat = Number.isFinite(stop.lat) ? stop.lat : geo.shared?.lat;
  const sharedLng = Number.isFinite(stop.lng) ? stop.lng : geo.shared?.lng;
  if (Number.isFinite(sharedLat) && Number.isFinite(sharedLng)) {
    points.push({ key: "shared", lat: sharedLat, lng: sharedLng });
  }

  if (Number.isFinite(geo.to_ghansoli?.lat) && Number.isFinite(geo.to_ghansoli?.lng)) {
    points.push({ key: "to_ghansoli", lat: geo.to_ghansoli.lat, lng: geo.to_ghansoli.lng });
  }

  if (Number.isFinite(geo.to_kharkopar?.lat) && Number.isFinite(geo.to_kharkopar?.lng)) {
    points.push({ key: "to_kharkopar", lat: geo.to_kharkopar.lat, lng: geo.to_kharkopar.lng });
  }

  return points;
}

function pickPreferredGeoPoint(stop, destinationStop, latitude, longitude) {
  const points = stop.geo_points || [];
  if (!points.length) return null;

  const preferredPointKey = destinationStop
    ? DIRECTION_POINT_KEYS[destinationStop.sequence > stop.sequence ? "outbound" : "inbound"]
    : null;

  let candidatePoints = points;
  if (preferredPointKey) {
    const preferredPoints = points.filter((point) => point.key === preferredPointKey);
    const sharedPoints = points.filter((point) => point.key === "shared");

    if (preferredPoints.length) candidatePoints = preferredPoints;
    else if (sharedPoints.length) candidatePoints = sharedPoints;
  }

  return candidatePoints
    .map((point) => ({
      ...point,
      distance_km: haversine(latitude, longitude, point.lat, point.lng)
    }))
    .sort((left, right) => left.distance_km - right.distance_km)[0];
}
