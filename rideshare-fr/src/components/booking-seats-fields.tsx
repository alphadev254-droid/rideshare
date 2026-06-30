import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function BookingSeatsFields({
  availableSeats,
  seatsBooked,
  onSeatsBookedChange,
  travelerNames,
  onTravelerNamesChange,
  primaryName = "You",
}: {
  availableSeats: number;
  seatsBooked: number;
  onSeatsBookedChange: (value: number) => void;
  travelerNames: string[];
  onTravelerNamesChange: (value: string[]) => void;
  primaryName?: string;
}) {
  const maxSeats = Math.max(1, availableSeats);
  const safeSeats = Math.min(Math.max(1, seatsBooked), maxSeats);

  function setSeats(nextValue: number) {
    const nextSeats = Math.min(Math.max(1, nextValue), maxSeats);
    onSeatsBookedChange(nextSeats);
    onTravelerNamesChange(Array.from({ length: Math.max(0, nextSeats - 1) }, (_, index) => travelerNames[index] ?? ""));
  }

  function setTravelerName(index: number, value: string) {
    const next = Array.from({ length: Math.max(0, safeSeats - 1) }, (_, itemIndex) => travelerNames[itemIndex] ?? "");
    next[index] = value;
    onTravelerNamesChange(next);
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label className="label-eyebrow">Seats</Label>
        <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface-2 px-3 py-2">
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={() => setSeats(safeSeats - 1)}
            disabled={safeSeats <= 1}
          >
            <Minus className="h-3.5 w-3.5" />
          </Button>
          <div className="text-center">
            <div className="font-display text-lg font-semibold tabular">{safeSeats}</div>
            <div className="text-[11px] text-muted-foreground">of {availableSeats} available</div>
          </div>
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-8 w-8"
            onClick={() => setSeats(safeSeats + 1)}
            disabled={safeSeats >= maxSeats}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {safeSeats > 1 && (
        <div className="space-y-2 rounded-md border border-border bg-card p-3">
          <div>
            <div className="label-eyebrow">Traveler names</div>
            <p className="mt-1 text-xs text-muted-foreground">Optional, but helpful for the driver manifest.</p>
          </div>
          <div className="space-y-2">
            <div className="rounded-md bg-surface-2 px-3 py-2 text-sm">
              <span className="text-xs text-muted-foreground">Passenger 1</span>
              <div className="font-medium">{primaryName}</div>
            </div>
            {Array.from({ length: safeSeats - 1 }, (_, index) => (
              <div key={index} className="space-y-1.5">
                <Label className="label-eyebrow">Passenger {index + 2}</Label>
                <Input
                  value={travelerNames[index] ?? ""}
                  onChange={(event) => setTravelerName(index, event.target.value)}
                  placeholder="Optional full name"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}