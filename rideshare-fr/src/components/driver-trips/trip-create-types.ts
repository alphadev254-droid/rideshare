import type { ComfortClass, Trip, TripSegmentInput, TripStopInput, Vehicle } from "@/lib/api";
import { addDays, differenceInMinutes, format, isAfter, parse } from "date-fns";

export type MainTripDraft = {
  vehicleId: string;
  originName: string;
  destinationName: string;
  departureDate: string;
  departureTime: string;
  arrivalTime: string;
  totalSeats: string;
};

export type RouteSegmentDraft = {
  key: string;
  fromIndex: number;
  toIndex: number;
  from: string;
  to: string;
  departureTime: string;
  arrivalTime: string;
  pickupPoint: string;
  dropOffPoint: string;
  seats: string;
  distanceKm: string;
  amountMwk: string;
  enabled: boolean;
};

export type TripCreatePayloadParts = {
  departureTime: string;
  estimatedDurationMinutes: number;
  farePerSeatMwk: number;
  distanceKm?: number;
  stops: TripStopInput[];
  segments: TripSegmentInput[];
  comfortClass: ComfortClass;
};

export function defaultTripDate() {
  return format(new Date(), "yyyy-MM-dd");
}

export function emptyMainDraft(): MainTripDraft {
  return {
    vehicleId: "",
    originName: "",
    destinationName: "",
    departureDate: defaultTripDate(),
    departureTime: "",
    arrivalTime: "",
    totalSeats: "1",
  };
}

export function makeRouteRow(from: string, to: string, bookableSeats: string): RouteSegmentDraft {
  return {
    key: makeKey(),
    fromIndex: 0,
    toIndex: 1,
    from,
    to,
    departureTime: "",
    arrivalTime: "",
    pickupPoint: "",
    dropOffPoint: "",
    seats: bookableSeats || "1",
    distanceKm: "",
    amountMwk: "",
    enabled: true,
  };
}

export function addDayIfNeeded(start: Date, end: Date) {
  return isAfter(end, start) ? end : addDays(end, 1);
}

export function validateMainTrip(form: MainTripDraft, vehicle?: Vehicle) {
  const errors: Record<string, string> = {};
  const seats = Number(form.totalSeats);
  if (!form.originName.trim()) errors.originName = "Choose the trip origin.";
  if (!form.destinationName.trim()) errors.destinationName = "Choose the trip destination.";
  if (!form.departureDate) errors.departureDate = "Choose the trip date.";
  if (!form.departureTime) errors.departureTime = "Choose the full trip departure time.";
  if (!form.arrivalTime) errors.arrivalTime = "Choose the full trip arrival time.";
  if (!form.vehicleId) errors.vehicleId = "Choose the vehicle for this trip.";
  if (!Number.isFinite(seats) || seats < 1) {
    errors.totalSeats = "Enter at least 1 seat to sell.";
  } else if (vehicle && seats > vehicle.seatCapacity) {
    errors.totalSeats = `Seats to sell cannot exceed this vehicle's ${vehicle.seatCapacity} passenger seats.`;
  }
  return errors;
}

export function validateRouteManifest(form: MainTripDraft, segments: RouteSegmentDraft[], bookableSeats: number) {
  const errors: Record<string, string> = {};
  const enabled = normalizedRows(form, segments);
  if (enabled.length === 0) {
    errors.route = "Enable at least one route row.";
    return errors;
  }
  if (enabled.some((segment) => !segment.from.trim() || !segment.to.trim())) {
    errors.route = "Every enabled row needs From and To.";
    return errors;
  }
  if (enabled.some((segment) => !segment.departureTime || !segment.arrivalTime)) {
    errors.route = "Every enabled row needs a departure time and arrival time.";
    return errors;
  }
  const invalid = enabled.find((segment) => {
    const seats = Number(segment.seats);
    const amount = Number(segment.amountMwk);
    return (
      !Number.isFinite(seats) ||
      seats < 1 ||
      seats > bookableSeats ||
      !Number.isFinite(amount) ||
      amount < 1
    );
  });
  if (invalid) {
    errors.route = `Every route needs an amount and a route vacancy from 1 to ${bookableSeats}. Route vacancies reuse the same trip seats; they do not add extra seats.`;
  }
  if (!errors.route) {
    try {
      buildRoutePlan(form, enabled);
    } catch (error) {
      errors.route = error instanceof Error ? error.message : "Routes must follow the journey order.";
    }
  }
  return errors;
}

export function buildTripPayload(
  form: MainTripDraft,
  vehicle: Vehicle,
  segments: RouteSegmentDraft[],
) {
  const publishRows = normalizedRows(form, segments);
  const mainRow = publishRows[0];
  if (!mainRow) throw new Error("Enable at least one route row");

  const tripStart = dateTimeFromParts(form.departureDate, mainRow.departureTime);
  const tripEnd = addDayIfNeeded(tripStart, dateTimeFromParts(form.departureDate, form.arrivalTime));
  const routePlan = buildRoutePlan(form, publishRows);
  const stopInputs = routePlan.points.slice(1, -1).map((point) => {
    const arrival = point.arrivalTime
      ? addDayIfNeeded(tripStart, dateTimeFromParts(form.departureDate, point.arrivalTime))
      : tripStart;
    const departure = point.departureTime
      ? addDayIfNeeded(tripStart, dateTimeFromParts(form.departureDate, point.departureTime))
      : arrival;
    return {
      name: point.name,
      pickupPoint: point.pickupPoint || undefined,
      dropOffPoint: point.dropOffPoint || undefined,
      arrivalOffsetMinutes: minutesOffset(tripStart, arrival),
      departureOffsetMinutes: minutesOffset(tripStart, departure),
    };
  });

  const segmentInputs = routePlan.segments.map(({ row, fromStopIndex, toStopIndex }) => {
    const segment = row;
    const start = dateTimeFromParts(form.departureDate, segment.departureTime);
    const end = addDayIfNeeded(start, dateTimeFromParts(form.departureDate, segment.arrivalTime));
    return {
      fromStopIndex,
      toStopIndex,
      farePerSeatMwk: Number(segment.amountMwk),
      maxSeats: Math.min(Number(segment.seats), Number(form.totalSeats)),
      distanceKm: segment.distanceKm ? Number(segment.distanceKm) : undefined,
      estimatedDurationMinutes: minutesBetween(start, end),
      isEnabled: true,
    };
  });

  const distanceKm = segmentInputs.reduce((total, segment) => total + (segment.distanceKm ?? 0), 0) || undefined;
  const farePerSeatMwk = segmentInputs.reduce((total, segment) => total + segment.farePerSeatMwk, 0);

  return {
    vehicleId: form.vehicleId,
    originName: form.originName.trim(),
    pickupPoint: mainRow.pickupPoint.trim() || undefined,
    destinationName: form.destinationName.trim(),
    dropOffPoint: mainRow.dropOffPoint.trim() || undefined,
    departureTime: tripStart.toISOString(),
    totalSeats: Number(form.totalSeats),
    comfortClass: vehicle.comfortClass,
    distanceKm,
    estimatedDurationMinutes: minutesBetween(tripStart, tripEnd),
    farePerSeatMwk,
    stops: stopInputs,
    segments: segmentInputs,
  };
}

export function tripToDrafts(trip: Trip) {
  const departure = new Date(trip.departureTime);
  const routeStops = [...(trip.routeStops ?? [])].sort((a, b) => a.stopOrder - b.stopOrder);
  const tripEnd = routeStops.at(-1)?.arrivalOffsetMinutes
    ? new Date(departure.getTime() + (routeStops.at(-1)?.arrivalOffsetMinutes ?? 0) * 60_000)
    : new Date(departure.getTime() + (trip.estimatedDurationMinutes ?? 60) * 60_000);
  const form: MainTripDraft = {
    vehicleId: trip.vehicleId ?? "",
    originName: trip.parentOriginName ?? trip.originName,
    destinationName: trip.parentDestinationName ?? trip.destinationName,
    departureDate: format(departure, "yyyy-MM-dd"),
    departureTime: format(departure, "HH:mm"),
    arrivalTime: format(tripEnd, "HH:mm"),
    totalSeats: String(trip.totalSeats),
  };
  const lastOrder = routeStops.at(-1)?.stopOrder ?? 1;
  const routeSegments = [...(trip.routeSegments ?? [])].sort((a, b) => {
    if (a.fromOrder !== b.fromOrder) return a.fromOrder - b.fromOrder;
    return a.toOrder - b.toOrder;
  });
  const direct = routeSegments.find((segment) => segment.fromOrder === 0 && segment.toOrder === lastOrder);
  const extras = routeSegments.filter((segment) => segment !== direct);
  const main = makeRouteRow(form.originName, form.destinationName, String(direct?.maxSeats ?? trip.totalSeats));
  main.departureTime = form.departureTime;
  main.arrivalTime = form.arrivalTime;
  main.amountMwk = String(Math.round(Number(direct?.farePerSeatMwk ?? trip.farePerSeatMwk ?? 0)));
  main.distanceKm = direct?.distanceKm ? String(direct.distanceKm) : trip.distanceKm ? String(trip.distanceKm) : "";
  main.pickupPoint = routeStops[0]?.pickupPoint ?? trip.pickupPoint ?? "";
  main.dropOffPoint = routeStops.at(-1)?.dropOffPoint ?? trip.dropOffPoint ?? "";
  const segments = [
    main,
    ...extras.map((segment) => {
      const row = makeRouteRow(segment.fromStop.name, segment.toStop.name, String(segment.maxSeats ?? trip.totalSeats));
      row.departureTime = formatOffsetTime(departure, segment.fromStop.departureOffsetMinutes);
      row.arrivalTime = formatOffsetTime(departure, segment.toStop.arrivalOffsetMinutes);
      row.amountMwk = String(Math.round(Number(segment.farePerSeatMwk)));
      row.distanceKm = segment.distanceKm ? String(segment.distanceKm) : "";
      row.pickupPoint = segment.fromStop.pickupPoint ?? "";
      row.dropOffPoint = segment.toStop.dropOffPoint ?? "";
      return row;
    }),
  ];
  return { form, segments };
}

export function minutesBetween(start: Date, end: Date) {
  return Math.max(1, differenceInMinutes(end, start));
}

export function dateTimeFromParts(date: string, time: string) {
  return parse(`${date} ${time}`, "yyyy-MM-dd HH:mm", new Date());
}

export function minutesOffset(base: Date, value: Date) {
  return Math.max(0, differenceInMinutes(value, base));
}

function normalizedRows(form: MainTripDraft, segments: RouteSegmentDraft[]) {
  return segments
    .filter((segment) => segment.enabled)
    .map((segment, index) => ({
      ...segment,
      from: index === 0 ? form.originName : segment.from,
      to: index === 0 ? form.destinationName : segment.to,
      departureTime: index === 0 ? form.departureTime : segment.departureTime,
      arrivalTime: index === 0 ? form.arrivalTime : segment.arrivalTime,
    }));
}

function buildRoutePlan(form: MainTripDraft, rows: RouteSegmentDraft[]) {
  const points: Array<{
    name: string;
    arrivalTime?: string;
    departureTime?: string;
    pickupPoint?: string;
    dropOffPoint?: string;
  }> = [
    {
      name: form.originName.trim(),
      departureTime: form.departureTime,
      pickupPoint: rows[0]?.pickupPoint?.trim() || undefined,
    },
  ];
  const extraRows = rows.slice(1);
  for (const row of extraRows) {
    appendPoint(points, row.from.trim(), undefined, row.departureTime, row.pickupPoint, undefined);
    appendPoint(points, row.to.trim(), row.arrivalTime, undefined, undefined, row.dropOffPoint);
  }
  appendPoint(
    points,
    form.destinationName.trim(),
    form.arrivalTime,
    undefined,
    undefined,
    rows[0]?.dropOffPoint?.trim() || undefined,
  );

  const pointIndex = new Map(points.map((point, index) => [point.name.toLowerCase(), index]));
  const segments = rows.map((row, index) => {
    const fromName = index === 0 ? form.originName.trim() : row.from.trim();
    const toName = index === 0 ? form.destinationName.trim() : row.to.trim();
    const fromStopIndex = pointIndex.get(fromName.toLowerCase());
    const toStopIndex = pointIndex.get(toName.toLowerCase());
    if (fromStopIndex === undefined || toStopIndex === undefined) {
      throw new Error("Every route must use places on the main journey.");
    }
    if (fromStopIndex >= toStopIndex) {
      throw new Error("Routes must follow the journey order from origin to destination.");
    }
    return { row, fromStopIndex, toStopIndex };
  });

  return { points, segments };
}

function appendPoint(
  points: Array<{
    name: string;
    arrivalTime?: string;
    departureTime?: string;
    pickupPoint?: string;
    dropOffPoint?: string;
  }>,
  name: string,
  arrivalTime?: string,
  departureTime?: string,
  pickupPoint?: string,
  dropOffPoint?: string,
) {
  if (!name) return;
  const nextPickup = pickupPoint?.trim();
  const nextDropOff = dropOffPoint?.trim();
  const existing = points.find((point) => point.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    existing.arrivalTime ||= arrivalTime;
    existing.departureTime ||= departureTime;
    existing.pickupPoint ||= nextPickup || undefined;
    existing.dropOffPoint ||= nextDropOff || undefined;
    return;
  }
  points.push({
    name,
    arrivalTime,
    departureTime,
    pickupPoint: nextPickup || undefined,
    dropOffPoint: nextDropOff || undefined,
  });
}

function formatOffsetTime(departure: Date, offset?: number | null) {
  if (offset === null || offset === undefined) return "";
  return format(new Date(departure.getTime() + offset * 60_000), "HH:mm");
}

function makeKey() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
