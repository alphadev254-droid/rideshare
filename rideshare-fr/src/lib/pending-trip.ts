const PENDING_TRIP_KEY = "rideshare.pendingTripId";
const PENDING_TRIP_RETURN_KEY = "rideshare.pendingTripReturn";

export function setPendingTripId(tripId: string, returnPath?: string) {
  window.localStorage.setItem(PENDING_TRIP_KEY, tripId);
  if (returnPath) {
    window.localStorage.setItem(PENDING_TRIP_RETURN_KEY, returnPath);
  } else {
    window.localStorage.removeItem(PENDING_TRIP_RETURN_KEY);
  }
}

export function getPendingTripId() {
  return window.localStorage.getItem(PENDING_TRIP_KEY);
}

export function getPendingTripReturn() {
  return window.localStorage.getItem(PENDING_TRIP_RETURN_KEY);
}

export function clearPendingTripId() {
  window.localStorage.removeItem(PENDING_TRIP_KEY);
  window.localStorage.removeItem(PENDING_TRIP_RETURN_KEY);
}

export function consumePendingTripId() {
  const tripId = getPendingTripId();
  if (tripId) clearPendingTripId();
  return tripId;
}
