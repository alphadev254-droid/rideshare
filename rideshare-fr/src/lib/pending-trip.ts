const PENDING_TRIP_KEY = "rideshare.pendingTripId";

export function setPendingTripId(tripId: string) {
  window.localStorage.setItem(PENDING_TRIP_KEY, tripId);
}

export function getPendingTripId() {
  return window.localStorage.getItem(PENDING_TRIP_KEY);
}

export function clearPendingTripId() {
  window.localStorage.removeItem(PENDING_TRIP_KEY);
}

export function consumePendingTripId() {
  const tripId = getPendingTripId();
  if (tripId) clearPendingTripId();
  return tripId;
}