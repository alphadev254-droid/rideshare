import { useState, type ChangeEvent } from "react";
import { Camera, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SecureImage } from "@/components/secure-image";
import type { ComfortClass, Vehicle } from "@/lib/api";

type VehiclePayload = Omit<
  Vehicle,
  "id" | "driverId" | "isActive" | "createdAt" | "imageUrls" | "photoUrl"
>;

type VehicleForm = {
  make: string;
  model: string;
  year: string;
  plateNumber: string;
  color: string;
  comfortClass: ComfortClass;
  seatCapacity: string;
};

function formFromVehicle(vehicle?: Vehicle): VehicleForm {
  return {
    make: vehicle?.make ?? "",
    model: vehicle?.model ?? "",
    year: vehicle?.year ? String(vehicle.year) : "",
    plateNumber: vehicle?.plateNumber ?? "",
    color: vehicle?.color ?? "",
    comfortClass: vehicle?.comfortClass ?? "economy",
    seatCapacity: vehicle?.seatCapacity ? String(vehicle.seatCapacity) : "4",
  };
}

function toPayload(form: VehicleForm): VehiclePayload {
  return {
    make: form.make,
    model: form.model,
    year: Number(form.year),
    plateNumber: form.plateNumber,
    color: form.color || undefined,
    comfortClass: form.comfortClass,
    seatCapacity: Number(form.seatCapacity),
  };
}

export function AdminVehiclesManager({
  vehicles,
  onAdd,
  onUpdate,
  onDelete,
  onUploadImage,
  onRemoveImage,
  onToggleActive,
}: {
  vehicles: Vehicle[];
  onAdd: (payload: VehiclePayload) => Promise<void>;
  onUpdate: (vehicleId: string, payload: VehiclePayload) => Promise<void>;
  onDelete: (vehicleId: string) => Promise<void>;
  onUploadImage: (vehicleId: string, file: File) => Promise<void>;
  onRemoveImage: (vehicleId: string, url: string) => Promise<void>;
  onToggleActive: (vehicleId: string, isActive: boolean) => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [form, setForm] = useState<VehicleForm>(formFromVehicle());

  function start(vehicle?: Vehicle) {
    setEditingId(vehicle?.id ?? "new");
    setForm(formFromVehicle(vehicle));
  }

  async function save() {
    if (editingId === "new") await onAdd(toPayload(form));
    else if (editingId) await onUpdate(editingId, toPayload(form));
    setEditingId(null);
    setForm(formFromVehicle());
  }

  async function upload(vehicle: Vehicle, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    await onUploadImage(vehicle.id, file);
  }

  return (
    <div className="space-y-4 rounded-md border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-base font-semibold">Manage vehicles</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Add, edit, delete vehicles and manage up to four images per vehicle.
          </p>
        </div>
        <Button onClick={() => start()}>Add</Button>
      </div>

      {editingId && (
        <div className="rounded-md border border-border bg-surface p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Make" value={form.make} onChange={(v) => setForm({ ...form, make: v })} />
            <Field label="Model" value={form.model} onChange={(v) => setForm({ ...form, model: v })} />
            <Field label="Year" type="number" value={form.year} onChange={(v) => setForm({ ...form, year: v })} />
            <Field label="Plate" value={form.plateNumber} onChange={(v) => setForm({ ...form, plateNumber: v })} />
            <Field label="Color" value={form.color} onChange={(v) => setForm({ ...form, color: v })} />
            <Field label="Seats" type="number" value={form.seatCapacity} onChange={(v) => setForm({ ...form, seatCapacity: v })} />
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="label-eyebrow">Comfort class</Label>
              <Select value={form.comfortClass} onValueChange={(v) => setForm({ ...form, comfortClass: v as ComfortClass })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="economy">Economy</SelectItem>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="comfort">Comfort</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button onClick={save}>Save</Button>
            <Button variant="outline" onClick={() => setEditingId(null)}>Cancel</Button>
          </div>
        </div>
      )}

      {(vehicles ?? []).length === 0 ? (
        <p className="text-sm text-muted-foreground">No active vehicles.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {vehicles.map((vehicle) => (
            <div key={vehicle.id} className="rounded-md border border-border bg-surface p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-medium">
                    {vehicle.make} {vehicle.model}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {vehicle.plateNumber} · {vehicle.year} · {vehicle.seatCapacity} seats · {vehicle.comfortClass}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Switch
                      checked={vehicle.isActive}
                      onCheckedChange={(checked) => onToggleActive(vehicle.id, checked)}
                    />
                    <span className={`text-xs font-medium ${vehicle.isActive ? "text-primary" : "text-muted-foreground"}`}>
                      {vehicle.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => start(vehicle)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" className="text-destructive" onClick={() => onDelete(vehicle.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {(vehicle.imageUrls ?? []).map((url) => (
                  <div key={url} className="relative aspect-[4/3] overflow-hidden rounded-md border border-border">
                    <SecureImage src={url} alt={`${vehicle.make} ${vehicle.model}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded-md bg-background/90 p-1 text-destructive"
                      onClick={() => onRemoveImage(vehicle.id, url)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {(vehicle.imageUrls?.length ?? 0) < 4 && (
                  <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                    <Camera className="mb-1 h-4 w-4" />
                    Upload
                    <input type="file" accept="image/*" className="sr-only" onChange={(e) => upload(vehicle, e)} />
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="label-eyebrow">{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
