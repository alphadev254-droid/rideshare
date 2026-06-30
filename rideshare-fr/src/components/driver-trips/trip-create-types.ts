import type { ComfortClass, TripSegmentInput, TripStopInput } from "@/lib/api";
import { differenceInMinutes, parse } from "date-fns";

export type MainTripDraft = {
  vehicleId: string;
  originName: string;
  destinationName: string;
  departureDate: string;
  totalSeats: string;
};

export type RouteStopDraft = {
  id: string;
  name: string;
};

export type RouteSegmentDraft = {
  key: string;
  fromIndex: number;
  toIndex: number;
  from: string;
  to: string;
  departureTime: string;
  arrivalTime: string;
  seats: string;
  distanceKm: string;
  amountMwk: string;
  enabled: boolean;
  isFullJourney: boolean;
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

export function minutesBetween(start: Date, end: Date) {
  return Math.max(1, differenceInMinutes(end, start));
}

export function dateTimeFromParts(date: string, time: string) {
  return parse(`${date} ${time}`, "yyyy-MM-dd HH:mm", new Date());
}

export function minutesOffset(base: Date, value: Date) {
  return Math.max(0, differenceInMinutes(value, base));
}
