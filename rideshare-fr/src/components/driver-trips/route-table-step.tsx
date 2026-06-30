import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError } from "./main-trip-step";
import type { MainTripDraft, RouteSegmentDraft, RouteStopDraft } from "./trip-create-types";

export function RouteTableStep({
  form,
  stops,
  segments,
  errors,
  publishing,
  onBack,
  onAddStop,
  onUpdateStop,
  onRemoveStop,
  onUpdateSegment,
  onPublish,
}: {
  form: MainTripDraft;
  stops: RouteStopDraft[];
  segments: RouteSegmentDraft[];
  errors: Record<string, string>;
  publishing: boolean;
  onBack: () => void;
  onAddStop: () => void;
  onUpdateStop: (id: string, name: string) => void;
  onRemoveStop: (id: string) => void;
  onUpdateSegment: (key: string, patch: Partial<RouteSegmentDraft>) => void;
  onPublish: () => void;
}) {
  const bookableSeats = Number(form.totalSeats || 1);
  const legSegments = segments.filter((segment) => !segment.isFullJourney || segments.length === 1);
  const fullSegment = segments.find((segment) => segment.isFullJourney && segments.length > 1);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border bg-card p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="label-eyebrow">Route table</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Set the route rows passengers can book. Seats cannot exceed the {bookableSeats} bookable seats from the main trip.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onAddStop}>
            <Plus className="h-3.5 w-3.5" /> Add stop
          </Button>
        </div>

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-surface-2 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2">From</th>
                <th className="px-3 py-2">To</th>
                <th className="px-3 py-2">Departure time</th>
                <th className="px-3 py-2">Arrival time</th>
                <th className="px-3 py-2">Seats available</th>
                <th className="px-3 py-2">Distance</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Sell</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {legSegments.map((segment, index) => {
                const stop = stops[index];
                const isFinalLeg = index === legSegments.length - 1;
                return (
                  <tr key={segment.key}>
                    <td className="px-3 py-2 font-medium">{segment.from}</td>
                    <td className="px-3 py-2">
                      {stop ? (
                        <Input
                          value={stop.name}
                          onChange={(event) => onUpdateStop(stop.id, event.target.value)}
                          placeholder="Stop name"
                        />
                      ) : (
                        <span className="font-medium">{segment.to}</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="time"
                        value={segment.departureTime}
                        onChange={(event) => onUpdateSegment(segment.key, { departureTime: event.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="time"
                        value={segment.arrivalTime}
                        onChange={(event) => onUpdateSegment(segment.key, { arrivalTime: event.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={1}
                        max={bookableSeats}
                        value={segment.seats}
                        onChange={(event) => onUpdateSegment(segment.key, { seats: event.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={0}
                        step="0.1"
                        value={segment.distanceKm}
                        onChange={(event) => onUpdateSegment(segment.key, { distanceKm: event.target.value })}
                        placeholder="km"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="number"
                        min={1}
                        value={segment.amountMwk}
                        onChange={(event) => onUpdateSegment(segment.key, { amountMwk: event.target.value })}
                        placeholder="MWK"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={segment.enabled}
                        onChange={(event) => onUpdateSegment(segment.key, { enabled: event.target.checked })}
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      {stop && !isFinalLeg && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => onRemoveStop(stop.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <FieldError message={errors.route} />
      </div>

      {fullSegment && (
        <div className="rounded-md border border-border bg-card p-4">
          <div className="mb-3">
            <div className="label-eyebrow">Full journey listing</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Keep this enabled if passengers can book {fullSegment.from} to {fullSegment.to}.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_140px_120px_140px_80px] sm:items-center">
            <div className="text-sm font-medium">{fullSegment.from} to {fullSegment.to}</div>
            <Input
              type="number"
              min={1}
              max={bookableSeats}
              value={fullSegment.seats}
              onChange={(event) => onUpdateSegment(fullSegment.key, { seats: event.target.value })}
              placeholder="Seats"
            />
            <Input
              type="number"
              min={0}
              step="0.1"
              value={fullSegment.distanceKm}
              onChange={(event) => onUpdateSegment(fullSegment.key, { distanceKm: event.target.value })}
              placeholder="Distance"
            />
            <Input
              type="number"
              min={1}
              value={fullSegment.amountMwk}
              onChange={(event) => onUpdateSegment(fullSegment.key, { amountMwk: event.target.value })}
              placeholder="Amount"
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={fullSegment.enabled}
                onChange={(event) => onUpdateSegment(fullSegment.key, { enabled: event.target.checked })}
              />
              Sell
            </label>
          </div>
        </div>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={onPublish} disabled={publishing}>
          {publishing ? "Publishing..." : "Publish trip"}
        </Button>
      </div>
    </div>
  );
}
