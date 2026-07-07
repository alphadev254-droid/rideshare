import type { Vehicle } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerField } from "@/components/date-picker-field";
import { Clock } from "lucide-react";
import { useRef } from "react";
import { DistrictSearch } from "./district-search";
import type { MainTripDraft } from "./trip-create-types";
import { useI18n } from "@/lib/i18n";

export function MainTripStep({
  form,
  vehicles,
  districts,
  filteredOrigin,
  filteredDestination,
  originSearch,
  destinationSearch,
  originOpen,
  destinationOpen,
  errors,
  onChange,
  onOriginSearch,
  onDestinationSearch,
  onOriginOpen,
  onDestinationOpen,
  onNext,
}: {
  form: MainTripDraft;
  vehicles: Vehicle[];
  districts: string[];
  filteredOrigin: string[];
  filteredDestination: string[];
  originSearch: string;
  destinationSearch: string;
  originOpen: boolean;
  destinationOpen: boolean;
  errors: Record<string, string>;
  onChange: <K extends keyof MainTripDraft>(key: K, value: MainTripDraft[K]) => void;
  onOriginSearch: (value: string) => void;
  onDestinationSearch: (value: string) => void;
  onOriginOpen: (open: boolean) => void;
  onDestinationOpen: (open: boolean) => void;
  onNext: () => void;
}) {
  const { t } = useI18n();
  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === form.vehicleId);
  const capacity = selectedVehicle?.seatCapacity ?? 0;

  return (
    <div className="space-y-4 rounded-md border border-border bg-card p-4 sm:p-6">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="label-eyebrow">{t("driverTripForm.origin")}</Label>
          <DistrictSearch
            value={form.originName}
            search={originSearch}
            onSearch={(value) => {
              onOriginSearch(value);
              onOriginOpen(true);
            }}
            onPick={(district) => {
              onChange("originName", district);
              onOriginSearch("");
              onOriginOpen(false);
            }}
            onClear={() => {
              onChange("originName", "");
              onOriginSearch("");
            }}
            open={originOpen}
            setOpen={onOriginOpen}
            districts={districts.length ? filteredOrigin : []}
            placeholder={t("driverTripForm.searchOrigin")}
            invalid={!!errors.originName}
          />
          <FieldError message={errors.originName} />
        </div>
        <div className="space-y-1.5">
          <Label className="label-eyebrow">{t("driverTripForm.destination")}</Label>
          <DistrictSearch
            value={form.destinationName}
            search={destinationSearch}
            onSearch={(value) => {
              onDestinationSearch(value);
              onDestinationOpen(true);
            }}
            onPick={(district) => {
              onChange("destinationName", district);
              onDestinationSearch("");
              onDestinationOpen(false);
            }}
            onClear={() => {
              onChange("destinationName", "");
              onDestinationSearch("");
            }}
            open={destinationOpen}
            setOpen={onDestinationOpen}
            districts={districts.length ? filteredDestination : []}
            placeholder={t("driverTripForm.searchDestination")}
            invalid={!!errors.destinationName}
          />
          <FieldError message={errors.destinationName} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label className="label-eyebrow">{t("driverTripForm.tripDate")}</Label>
          <DatePickerField
            value={form.departureDate}
            onChange={(value) => onChange("departureDate", value)}
            placeholder={t("driverTripForm.chooseTripDate")}
            fromYear={new Date().getFullYear()}
            toYear={new Date().getFullYear() + 3}
          />
          <FieldError message={errors.departureDate} />
        </div>
        <div className="space-y-1.5">
          <Label className="label-eyebrow">{t("driverTripForm.departureTime")}</Label>
          <TimePickerField
            value={form.departureTime}
            onChange={(value) => onChange("departureTime", value)}
            invalid={!!errors.departureTime}
          />
          <FieldError message={errors.departureTime} />
        </div>
        <div className="space-y-1.5">
          <Label className="label-eyebrow">{t("driverTripForm.arrivalTime")}</Label>
          <TimePickerField
            value={form.arrivalTime}
            onChange={(value) => onChange("arrivalTime", value)}
            invalid={!!errors.arrivalTime}
          />
          <FieldError message={errors.arrivalTime} />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_160px]">
        <div className="space-y-1.5">
          <Label className="label-eyebrow">{t("driverTripForm.vehicle")}</Label>
          <Select value={form.vehicleId} onValueChange={(value) => onChange("vehicleId", value)}>
            <SelectTrigger aria-invalid={!!errors.vehicleId}>
              <SelectValue placeholder={vehicles.length ? t("driverTripForm.chooseVehicle") : t("driverTripForm.noApprovedVehicles")} />
            </SelectTrigger>
            <SelectContent>
              {vehicles.map((vehicle) => (
                <SelectItem key={vehicle.id} value={vehicle.id}>
                  {vehicle.make} {vehicle.model} - {vehicle.plateNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldError message={errors.vehicleId} />
        </div>
        <div className="space-y-1.5">
          <Label className="label-eyebrow">{t("driverTripForm.seatsToSell")}</Label>
          <Input
            type="number"
            min={1}
            max={capacity || undefined}
            value={form.totalSeats}
            onChange={(event) => onChange("totalSeats", event.target.value)}
            aria-invalid={!!errors.totalSeats}
          />
          <FieldError message={errors.totalSeats} />
          <p className="text-xs text-muted-foreground">
            {t("driverTripForm.seatsHelp")}
          </p>
        </div>
      </div>

      {selectedVehicle && (
        <div className="rounded-md bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
          {t("driverTripForm.vehicleCapacity", { seats: selectedVehicle.seatCapacity })}
        </div>
      )}

      <div className="flex justify-end">
        <Button type="button" onClick={onNext}>
          {t("driverTripForm.nextRoutePrices")}
        </Button>
      </div>
    </div>
  );
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs font-medium text-destructive">{message}</p>;
}

function TimePickerField({
  value,
  onChange,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
}) {
  const { t } = useI18n();
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
        aria-invalid={invalid}
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
        aria-label={t("driverTripForm.departureTime")}
      >
        <Clock className="h-4 w-4" />
      </button>
    </div>
  );
}
