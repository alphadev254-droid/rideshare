import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Clock, MapPin, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError } from "./main-trip-step";
import type { MainTripDraft, RouteSegmentDraft } from "./trip-create-types";

export function RouteTableStep({
  form,
  districts,
  segments,
  errors,
  publishing,
  onBack,
  onAddRow,
  onRemoveRow,
  onUpdateSegment,
  onPublish,
}: {
  form: MainTripDraft;
  districts: string[];
  segments: RouteSegmentDraft[];
  errors: Record<string, string>;
  publishing: boolean;
  onBack: () => void;
  onAddRow: () => void;
  onRemoveRow: (key: string) => void;
  onUpdateSegment: (key: string, patch: Partial<RouteSegmentDraft>) => void;
  onPublish: () => void;
}) {
  const bookableSeats = Number(form.totalSeats || 1);

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
          <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={onAddRow}>
            <Plus className="h-3.5 w-3.5" /> Add route
          </Button>
        </div>

        <div className="overflow-x-auto overflow-y-visible rounded-md border border-border pb-56">
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
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {segments.map((segment, index) => (
                <tr key={segment.key}>
                  <td className="px-3 py-2">
                    {index === 0 ? (
                      <div className="flex h-9 items-center rounded-md border border-border bg-surface-2 px-3 text-sm font-medium">
                        {form.originName}
                      </div>
                    ) : (
                      <RoutePlaceInput
                        districts={districts}
                        value={segment.from}
                        onChange={(value) => onUpdateSegment(segment.key, { from: value })}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {index === 0 ? (
                      <div className="flex h-9 items-center rounded-md border border-border bg-surface-2 px-3 text-sm font-medium">
                        {form.destinationName}
                      </div>
                    ) : (
                      <RoutePlaceInput
                        districts={districts}
                        value={segment.to}
                        onChange={(value) => onUpdateSegment(segment.key, { to: value })}
                      />
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <RouteTimeInput
                      value={segment.departureTime}
                      onChange={(value) => onUpdateSegment(segment.key, { departureTime: value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <RouteTimeInput
                      value={segment.arrivalTime}
                      onChange={(value) => onUpdateSegment(segment.key, { arrivalTime: value })}
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
                  <td className="px-3 py-2 text-right">
                    {segments.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => onRemoveRow(segment.key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <FieldError message={errors.route} />
      </div>

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

function RoutePlaceInput({
  districts,
  value,
  onChange,
}: {
  districts: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState<CSSProperties>();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = useMemo(() => {
    const q = value.toLowerCase().trim();
    return q ? districts.filter((district) => district.toLowerCase().includes(q)) : districts;
  }, [districts, value]);

  function updateDropdownPosition() {
    const rect = inputRef.current?.getBoundingClientRect();
    if (!rect) return;
    setDropdownStyle({
      left: rect.left,
      top: rect.bottom + 4,
      width: rect.width,
    });
  }

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleMove() {
      updateDropdownPosition();
    }
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("resize", handleMove);
    window.addEventListener("scroll", handleMove, true);
    updateDropdownPosition();
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("resize", handleMove);
      window.removeEventListener("scroll", handleMove, true);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <Input
        ref={inputRef}
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          updateDropdownPosition();
          setOpen(true);
        }}
        onFocus={() => {
          updateDropdownPosition();
          setOpen(true);
        }}
        onClick={() => {
          updateDropdownPosition();
          setOpen(true);
        }}
        className="pl-9"
      />
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      {open && filtered.length > 0 && (
        <div
          className="fixed z-[300] max-h-52 overflow-y-auto rounded-md border border-border bg-card shadow-lg"
          style={dropdownStyle}
        >
          {filtered.map((district) => (
            <button
              key={district}
              type="button"
              className="flex w-full items-center px-3 py-2 text-left text-sm hover:bg-surface-2"
              onMouseDown={(event) => {
                event.preventDefault();
                onChange(district);
                setOpen(false);
              }}
            >
              <MapPin className="mr-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              {district}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function RouteTimeInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    const input = inputRef.current as (HTMLInputElement & { showPicker?: () => void }) | null;
    try {
      input?.showPicker?.();
    } catch {
      input?.focus();
    }
  }

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type="time"
        value={value}
        onMouseDown={openPicker}
        onClick={openPicker}
        onFocus={openPicker}
        onChange={(event) => onChange(event.target.value)}
        className="cursor-pointer pr-9"
      />
      <button
        type="button"
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        onMouseDown={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
          openPicker();
        }}
        aria-label="Choose time"
      >
        <Clock className="h-4 w-4" />
      </button>
    </div>
  );
}
