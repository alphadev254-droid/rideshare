import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { addDays, isAfter } from "date-fns";
import { ArrowRight, CircleDot, Clock, Flag, MapPin, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldError } from "./main-trip-step";
import { dateTimeFromParts, minutesBetween, type MainTripDraft, type RouteSegmentDraft } from "./trip-create-types";

export function RouteTableStep({
  form,
  districts,
  segments,
  errors,
  publishing,
  publishLabel = "Publish trip",
  publishingLabel = "Publishing...",
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
  publishLabel?: string;
  publishingLabel?: string;
  onBack: () => void;
  onAddRow: () => void;
  onRemoveRow: (key: string) => void;
  onUpdateSegment: (key: string, patch: Partial<RouteSegmentDraft>) => void;
  onPublish: () => void;
}) {
  const bookableSeats = Number(form.totalSeats || 1);
  const totalDistance = segments.reduce((total, segment) => total + Number(segment.distanceKm || 0), 0);
  const fullDuration = getDurationMinutes(form.departureDate, form.departureTime, form.arrivalTime);
  const routeRows = segments.slice(1);

  return (
    <div className="space-y-5">
      <div className="rounded-md border border-border bg-card">
        <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div>
            <div className="label-eyebrow text-primary">Route manifest</div>
            <h2 className="mt-2 flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-normal sm:text-3xl">
              <span>{form.originName}</span>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
              <span>{form.destinationName}</span>
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Full trip: depart {formatTimeLabel(form.departureTime)} - arrive {formatTimeLabel(form.arrivalTime)}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:min-w-64">
            <Metric label="Distance" value={totalDistance ? `${totalDistance.toLocaleString("en-MW")} km` : "Add km"} />
            <Metric label="Drive" value={fullDuration ? formatMinutes(fullDuration) : "Set time"} />
          </div>
        </div>

        <div className="p-4 lg:p-6">
          <div>
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-4">
              <div>
                <div className="label-eyebrow">Your route</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Add bookable routes along the journey. Each route vacancy must be {bookableSeats} or fewer.
                </p>
              </div>
              <span className="text-xs text-muted-foreground">{routeRows.length + 2} points</span>
            </div>

            <div className="relative space-y-4 pl-11">
              <div className="absolute bottom-6 left-[17px] top-5 w-px bg-border" />
              <Endpoint
                tone="start"
                title={form.originName}
                subtitle={`Depart - ${formatTimeLabel(form.departureTime)}`}
              />

              {routeRows.length > 0 && (
                <div className="space-y-4">
                  {routeRows.map((segment, index) => (
                    <RouteCard
                      key={segment.key}
                      index={index + 1}
                      segment={segment}
                      districts={districts}
                      bookableSeats={bookableSeats}
                      onRemove={() => onRemoveRow(segment.key)}
                      onUpdate={(patch) => onUpdateSegment(segment.key, patch)}
                    />
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={onAddRow}
                className="group relative flex w-full items-center gap-4 rounded-md border border-dashed border-border bg-background px-4 py-3 text-left text-sm text-muted-foreground hover:border-primary hover:text-foreground"
              >
                <span className="absolute -left-[38px] flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-border bg-card text-muted-foreground group-hover:border-primary group-hover:text-primary">
                  <Plus className="h-4 w-4" />
                </span>
                <span>Add route along journey</span>
              </button>

              <Endpoint
                tone="end"
                title={form.destinationName}
                subtitle={`Arrive - ${formatTimeLabel(form.arrivalTime)}`}
              />
            </div>

            <FieldError message={errors.route} />
          </div>
        </div>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
        <Button type="button" variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button type="button" onClick={onPublish} disabled={publishing}>
          {publishing ? publishingLabel : publishLabel}
        </Button>
      </div>
    </div>
  );
}

function RouteCard({
  index,
  segment,
  districts,
  bookableSeats,
  onRemove,
  onUpdate,
}: {
  index: number;
  segment: RouteSegmentDraft;
  districts: string[];
  bookableSeats: number;
  onRemove: () => void;
  onUpdate: (patch: Partial<RouteSegmentDraft>) => void;
}) {
  const routeTitle = `${segment.from || "From"} to ${segment.to || "To"}`;

  return (
    <div className="relative rounded-md border border-border bg-card p-3 shadow-sm">
      <span
        className="absolute -left-[38px] flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-xs font-semibold text-muted-foreground"
      >
        {index}
      </span>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{routeTitle}</div>
          <div className="mt-1 text-xs text-muted-foreground">Additional bookable route</div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={onRemove}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(130px,1fr)_minmax(130px,1fr)_112px_112px_92px_104px_124px] xl:items-end">
        <Field label="From">
          <RoutePlaceInput districts={districts} value={segment.from} onChange={(value) => onUpdate({ from: value })} />
        </Field>
        <Field label="To">
          <RoutePlaceInput districts={districts} value={segment.to} onChange={(value) => onUpdate({ to: value })} />
        </Field>
        <Field label="Departure">
          <RouteTimeInput value={segment.departureTime} onChange={(value) => onUpdate({ departureTime: value })} />
        </Field>
        <Field label="Arrival">
          <RouteTimeInput value={segment.arrivalTime} onChange={(value) => onUpdate({ arrivalTime: value })} />
        </Field>
        <Field label="Route vacancy">
          <Input
            type="number"
            min={1}
            max={bookableSeats}
            value={segment.seats}
            onChange={(event) => onUpdate({ seats: event.target.value })}
            className="h-8"
          />
          <p className="text-[11px] text-muted-foreground xl:hidden">
            Seats passengers can book on this route. Max {bookableSeats}.
          </p>
        </Field>
        <Field label="Distance (km)">
          <Input
            type="number"
            min={0}
            step="0.1"
            value={segment.distanceKm}
            onChange={(event) => onUpdate({ distanceKm: event.target.value })}
            placeholder="km"
            className="h-8"
          />
        </Field>
        <Field label="Amount (MWK)">
          <Input
            type="number"
            min={1}
            value={segment.amountMwk}
            onChange={(event) => onUpdate({ amountMwk: event.target.value })}
            placeholder="MWK"
            className="h-8"
          />
        </Field>
      </div>
    </div>
  );
}

function Endpoint({ tone, title, subtitle }: { tone: "start" | "end"; title: string; subtitle: string }) {
  const Icon = tone === "start" ? CircleDot : Flag;
  return (
    <div className="relative flex items-start justify-between gap-3 py-1">
      <span
        className={`absolute -left-[39px] flex h-9 w-9 items-center justify-center rounded-full ${
          tone === "start" ? "bg-foreground text-background" : "bg-primary text-primary-foreground"
        }`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div>
        <div className="font-semibold">{title}</div>
        <div className="mt-1 text-sm text-muted-foreground">{subtitle}</div>
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
    setDropdownStyle({ left: rect.left, top: rect.bottom + 4, width: rect.width });
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
        className="h-8 pl-8"
      />
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
      {open && filtered.length > 0 && (
        <div className="fixed z-[300] max-h-52 overflow-y-auto rounded-md border border-border bg-card shadow-lg" style={dropdownStyle}>
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
        className="h-8 cursor-pointer pr-8"
      />
      <button
        type="button"
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        onMouseDown={(event) => {
          event.preventDefault();
          inputRef.current?.focus();
          openPicker();
        }}
        aria-label="Choose time"
      >
        <Clock className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <div className="label-eyebrow text-[10px]">{label}</div>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-surface-2 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function formatTimeLabel(value: string) {
  return value || "Not set";
}

function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins} min`;
  if (!mins) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

function getDurationMinutes(date: string, departureTime: string, arrivalTime: string) {
  if (!date || !departureTime || !arrivalTime) return 0;
  const start = dateTimeFromParts(date, departureTime);
  const rawEnd = dateTimeFromParts(date, arrivalTime);
  const end = isAfter(rawEnd, start) ? rawEnd : addDays(rawEnd, 1);
  return minutesBetween(start, end);
}
