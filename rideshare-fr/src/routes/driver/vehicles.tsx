import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ChangeEvent } from "react";
import { Camera, Pencil, Trash2, Upload, Loader2, ShieldAlert, BadgeCheck, Car, X } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SecureImage, SecureFileLink } from "@/components/secure-image";
import { DatePickerField, isPastIsoDate } from "@/components/date-picker-field";
import { driverService, type ComfortClass, type InsuranceCategory, type Vehicle } from "@/lib/api";
import { toast } from "sonner";

export const Route = createFileRoute("/driver/vehicles")({
  component: VehiclesPage,
});

type VehicleForm = {
  make: string;
  model: string;
  year: string;
  plateNumber: string;
  cofNumber: string;
  cofExpiry: string;
  insuranceCategory: InsuranceCategory;
  insuranceExpiry: string;
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
    cofNumber: vehicle?.cofNumber ?? "",
    cofExpiry: vehicle?.cofExpiry ? new Date(vehicle.cofExpiry).toISOString().split("T")[0] : "",
    insuranceCategory: vehicle?.insuranceCategory ?? "third_party",
    insuranceExpiry: vehicle?.insuranceExpiry
      ? new Date(vehicle.insuranceExpiry).toISOString().split("T")[0]
      : "",
    color: vehicle?.color ?? "",
    comfortClass: vehicle?.comfortClass ?? "economy",
    seatCapacity: vehicle?.seatCapacity ? String(vehicle.seatCapacity) : "4",
  };
}

function VehiclesPage() {
  const queryClient = useQueryClient();
  const { data: vehicles, isLoading } = useQuery({
    queryKey: ["driver", "vehicles"],
    queryFn: () => driverService.vehicles(),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Driver"
        title="Vehicles"
        description="Manage your vehicles, upload photos, insurance documents, COF details, and more."
        actions={<AddVehicleButton />}
      />

      {isLoading ? (
        <div className="rounded-md border border-border bg-card p-6 text-sm text-muted-foreground">
          Loading vehicles...
        </div>
      ) : (vehicles ?? []).length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-12 text-center">
          <Car className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-4 text-sm font-medium text-muted-foreground">No vehicles yet.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Add your first vehicle to start publishing trips.
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {(vehicles ?? []).map((vehicle) => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} />
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Vehicle Card (read-only summary) ──────────────────────────────────────

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const queryClient = useQueryClient();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const deleteVehicle = useMutation({
    mutationFn: (id: string) => driverService.deleteVehicle(id),
    onSuccess: () => {
      toast.success("Vehicle deleted");
      queryClient.invalidateQueries({ queryKey: ["driver", "vehicles"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not delete vehicle"),
  });

  return (
    <li className="rounded-md border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-display text-sm font-semibold">
            {vehicle.make} {vehicle.model}
          </div>
          <div className="mt-0.5 text-[11px] text-muted-foreground space-y-0.5">
            <div>
              {vehicle.plateNumber} · {vehicle.year} · {vehicle.seatCapacity}s ·{" "}
              {vehicle.comfortClass}
            </div>
            {vehicle.cofNumber && (
              <div>COF: {vehicle.cofNumber}{vehicle.cofExpiry ? ` · ${new Date(vehicle.cofExpiry).toLocaleDateString()}` : ""}</div>
            )}
            {vehicle.insuranceCategory && (
              <div>{vehicle.insuranceCategory}{vehicle.insuranceExpiry ? ` · ${new Date(vehicle.insuranceExpiry).toLocaleDateString()}` : ""}</div>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <EditVehicleDialog vehicle={vehicle}>
            <Button variant="outline" size="sm" className="gap-1 text-xs h-7 px-2">
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
          </EditVehicleDialog>
          <Button
            variant="outline"
            size="sm"
            className="gap-1 text-xs h-7 px-2 border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={() => deleteVehicle.mutate(vehicle.id)}
            disabled={deleteVehicle.isPending}
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </Button>
        </div>
      </div>

      {/* Insurance Document Summary */}
      {vehicle.insuranceDocUrl && (
        <div className="mt-2 rounded-md border border-border bg-surface-2 px-2 py-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs">
              <ShieldAlert className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Insurance</span>
              <span className="text-[10px] text-primary"><BadgeCheck className="inline h-2.5 w-2.5" /> Uploaded</span>
            </div>
            <div>
              {/\.pdf($|\?)/i.test(vehicle.insuranceDocUrl) ? (
                <SecureFileLink href={vehicle.insuranceDocUrl} className="text-[10px] text-primary hover:underline">PDF</SecureFileLink>
              ) : (
                <a href={vehicle.insuranceDocUrl} target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline">View</a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Vehicle Images */}
      {(vehicle.imageUrls?.length ?? 0) > 0 && (
        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {(vehicle.imageUrls ?? []).map((url) => (
            <button
              key={url}
              type="button"
              className="aspect-square overflow-hidden rounded border border-border bg-surface-2 cursor-pointer hover:ring-2 hover:ring-primary transition-all"
              onClick={() => setPreviewUrl(url)}
            >
              <SecureImage src={url} alt={`${vehicle.make} ${vehicle.model}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {previewUrl && (
        <div
          className="fixed inset-0 z-50 bg-background/90"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            type="button"
            className="absolute right-4 top-4 z-10 rounded-full bg-card p-2 text-muted-foreground hover:text-foreground"
            onClick={() => setPreviewUrl(null)}
          >
            <X className="h-5 w-5" />
          </button>
          <div className="absolute inset-4" onClick={(e) => e.stopPropagation()}>
            <SecureImage
              src={previewUrl}
              alt={`${vehicle.make} ${vehicle.model}`}
              className="h-full w-full object-contain"
            />
          </div>
        </div>
      )}
    </li>
  );
}

// ─── Add Vehicle Button ────────────────────────────────────────────────────

function AddVehicleButton() {
  const [open, setOpen] = useState(false);

  return (
    <EditVehicleDialog open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)}>Add vehicle</Button>
    </EditVehicleDialog>
  );
}

// ─── Edit Vehicle Dialog ───────────────────────────────────────────────────

function EditVehicleDialog({
  vehicle,
  children,
  open: controlledOpen,
  onOpenChange,
}: {
  vehicle?: Vehicle;
  children?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const isNew = !vehicle;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  const [form, setForm] = useState<VehicleForm>(formFromVehicle(vehicle));
  const [newImages, setNewImages] = useState<Array<{ file: File; previewUrl: string }>>([]);
  const [pendingInsuranceDoc, setPendingInsuranceDoc] = useState<{
    file: File;
    previewUrl: string;
    mime: string;
  } | null>(null);

  function reset() {
    setForm(formFromVehicle(vehicle));
    setNewImages((imgs) => {
      imgs.forEach((i) => URL.revokeObjectURL(i.previewUrl));
      return [];
    });
    setPendingInsuranceDoc((doc) => {
      if (doc) URL.revokeObjectURL(doc.previewUrl);
      return null;
    });
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset();
    setOpen(next);
  }

  const save = useMutation({
    mutationFn: async () => {
      const body = {
        make: form.make,
        model: form.model,
        year: Number(form.year),
        plateNumber: form.plateNumber,
        cofNumber: form.cofNumber,
        cofExpiry: form.cofExpiry,
        insuranceCategory: form.insuranceCategory,
        insuranceExpiry: form.insuranceExpiry,
        color: form.color || undefined,
        comfortClass: form.comfortClass,
        seatCapacity: Number(form.seatCapacity),
      };
      const result = isNew
        ? await driverService.addVehicle(body, pendingInsuranceDoc?.file)
        : await driverService.updateVehicle(vehicle!.id, body, pendingInsuranceDoc?.file);

      if (newImages.length > 0) {
        for (const image of newImages) {
          await driverService.uploadVehicleImage(result.id, image.file);
        }
      }
      return result;
    },
    onSuccess: () => {
      toast.success(isNew ? "Vehicle added" : "Vehicle saved");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["driver", "vehicles"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not save vehicle"),
  });

  const removeImage = useMutation({
    mutationFn: ({ id, url }: { id: string; url: string }) =>
      driverService.removeVehicleImage(id, url),
    onSuccess: () => {
      toast.success("Image removed");
      queryClient.invalidateQueries({ queryKey: ["driver", "vehicles"] });
    },
  });

  const uploadInsuranceDoc = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) =>
      driverService.uploadVehicleInsuranceDocument(id, file),
    onSuccess: () => {
      toast.success("Insurance document uploaded");
      queryClient.invalidateQueries({ queryKey: ["driver", "vehicles"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not upload insurance document"),
  });

  const removeInsuranceDoc = useMutation({
    mutationFn: (id: string) => driverService.removeVehicleInsuranceDocument(id),
    onSuccess: () => {
      toast.success("Insurance document removed");
      queryClient.invalidateQueries({ queryKey: ["driver", "vehicles"] });
    },
    onError: (error: Error) => toast.error(error.message || "Could not remove insurance document"),
  });

  function handleNewImages(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length === 0) return;
    const existingCount = vehicle?.imageUrls?.length ?? 0;
    setNewImages((current) => {
      const remaining = Math.max(0, 4 - existingCount - current.length);
      if (remaining === 0) {
        toast.error("A vehicle can have a maximum of 4 images");
        return current;
      }
      if (files.length > remaining) {
        toast.error(`Only ${remaining} more image${remaining === 1 ? "" : "s"} can be added`);
      }
      return current.concat(
        files.slice(0, remaining).map((file) => ({
          file,
          previewUrl: URL.createObjectURL(file),
        })),
      );
    });
  }

  function removeNewImage(previewUrl: string) {
    setNewImages((imgs) => {
      const found = imgs.find((i) => i.previewUrl === previewUrl);
      if (found) URL.revokeObjectURL(found.previewUrl);
      return imgs.filter((i) => i.previewUrl !== previewUrl);
    });
  }

  function handleInsuranceDocSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPendingInsuranceDoc((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return { file, previewUrl: URL.createObjectURL(file), mime: file.type || "" };
    });
  }

  function handleInsuranceDocUpload() {
    if (!pendingInsuranceDoc || isNew) return;
    uploadInsuranceDoc.mutate({ id: vehicle!.id, file: pendingInsuranceDoc.file });
    setPendingInsuranceDoc((current) => {
      if (current) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
  }

  const totalImageCount = (vehicle?.imageUrls?.length ?? 0) + newImages.length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[92svh] overflow-y-auto p-4 sm:max-w-xl sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">
            {isNew ? "Add vehicle" : `Edit ${vehicle.make} ${vehicle.model}`}
          </DialogTitle>
          <DialogDescription>
            {isNew
              ? "Fill in vehicle details, upload photos and insurance document."
              : "Update vehicle information, manage photos and insurance."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Basic Info */}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Make" required value={form.make} onChange={(v) => setForm({ ...form, make: v })} />
            <Field label="Model" required value={form.model} onChange={(v) => setForm({ ...form, model: v })} />
            <Field label="Year" required type="number" value={form.year} onChange={(v) => setForm({ ...form, year: v })} />
            <Field label="Plate number" required value={form.plateNumber} onChange={(v) => setForm({ ...form, plateNumber: v })} />
            <Field label="Color" value={form.color} onChange={(v) => setForm({ ...form, color: v })} />
            <Field label="Seat capacity" required type="number" value={form.seatCapacity} onChange={(v) => setForm({ ...form, seatCapacity: v })} />
          </div>

          {/* COF */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="label-eyebrow">COF number <Required /></Label>
              <Input
                required
                value={form.cofNumber}
                onChange={(e) => setForm({ ...form, cofNumber: e.target.value })}
                placeholder="Certificate of Fitness number"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow">COF expiry date <Required /></Label>
              <DatePickerField
                required
                value={form.cofExpiry}
                onChange={(v) => setForm({ ...form, cofExpiry: v })}
                placeholder="Select COF expiry date"
                fromYear={new Date().getFullYear() - 5}
                toYear={new Date().getFullYear() + 10}
              />
              {form.cofExpiry && isPastIsoDate(form.cofExpiry) && (
                <p className="text-xs text-destructive">The COF has expired.</p>
              )}
            </div>
          </div>

          {/* Insurance */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Insurance category <Required /></Label>
              <Select
                required
                value={form.insuranceCategory}
                onValueChange={(v) => setForm({ ...form, insuranceCategory: v as InsuranceCategory })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="third_party">Third party</SelectItem>
                  <SelectItem value="comprehensive">Comprehensive</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow">Insurance expiry date <Required /></Label>
              <DatePickerField
                required
                value={form.insuranceExpiry}
                onChange={(v) => setForm({ ...form, insuranceExpiry: v })}
                placeholder="Select insurance expiry date"
                fromYear={new Date().getFullYear() - 5}
                toYear={new Date().getFullYear() + 10}
              />
              {form.insuranceExpiry && isPastIsoDate(form.insuranceExpiry) && (
                <p className="text-xs text-destructive">The insurance has expired.</p>
              )}
            </div>
          </div>

          {/* Comfort Class */}
          <div className="space-y-1.5 sm:w-64">
            <Label className="label-eyebrow">Comfort class</Label>
            <Select
              value={form.comfortClass}
              onValueChange={(v) => setForm({ ...form, comfortClass: v as ComfortClass })}
            >
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

          {/* Insurance Document */}
          <div className="rounded-md border border-border bg-surface-2 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Insurance document</span>
                {vehicle?.insuranceDocUrl && !pendingInsuranceDoc && (
                  <span className="text-xs text-primary">
                    <BadgeCheck className="inline h-3 w-3" /> Uploaded
                  </span>
                )}
              </div>
              {!isNew && vehicle?.insuranceDocUrl && !pendingInsuranceDoc && (
                <button
                  type="button"
                  className="text-xs text-destructive hover:underline"
                  onClick={() => removeInsuranceDoc.mutate(vehicle.id)}
                  disabled={removeInsuranceDoc.isPending}
                >
                  Remove
                </button>
              )}
            </div>

            {vehicle?.insuranceDocUrl && !pendingInsuranceDoc && (
              <div className="mt-2">
                {/\.pdf($|\?)/i.test(vehicle.insuranceDocUrl) ? (
                  <SecureFileLink
                    href={vehicle.insuranceDocUrl}
                    className="text-xs text-primary hover:underline"
                  >
                    View current document (PDF)
                  </SecureFileLink>
                ) : (
                  <a
                    href={vehicle.insuranceDocUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    View current document
                  </a>
                )}
              </div>
            )}

            <div className="mt-3">
              {pendingInsuranceDoc ? (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                    {pendingInsuranceDoc.file.name}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      if (isNew) return;
                      handleInsuranceDocUpload();
                    }}
                    disabled={isNew || uploadInsuranceDoc.isPending}
                  >
                    {uploadInsuranceDoc.isPending ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <Upload className="mr-1 h-3 w-3" />
                    )}
                    Upload
                  </Button>
                  <button
                    type="button"
                    className="text-xs text-destructive hover:underline"
                    onClick={() => {
                      setPendingInsuranceDoc((d) => {
                        if (d) URL.revokeObjectURL(d.previewUrl);
                        return null;
                      });
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-primary hover:underline">
                  <Upload className="h-3 w-3" />
                  {vehicle?.insuranceDocUrl ? "Replace document" : "Upload document"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="sr-only"
                    onChange={handleInsuranceDocSelect}
                  />
                </label>
              )}
              {isNew && pendingInsuranceDoc && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Insurance document will upload when you save the vehicle.
                </p>
              )}
            </div>
          </div>

          {/* Vehicle Images */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label className="label-eyebrow">Vehicle photos</Label>
              <span className="text-xs text-muted-foreground">{totalImageCount}/4</span>
            </div>

            {(vehicle?.imageUrls?.length ?? 0) > 0 || newImages.length > 0 ? (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {!isNew &&
                  (vehicle!.imageUrls ?? []).map((url) => (
                    <div
                      key={url}
                      className="group relative aspect-[4/3] overflow-hidden rounded-md border border-border bg-surface-2"
                    >
                      <SecureImage
                        src={url}
                        alt={`${vehicle!.make} ${vehicle!.model}`}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        className="absolute right-1 top-1 rounded-md bg-background/90 p-1 text-destructive opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
                        onClick={() => removeImage.mutate({ id: vehicle!.id, url })}
                        aria-label="Remove image"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                {newImages.map((img) => (
                  <div
                    key={img.previewUrl}
                    className="group relative aspect-[4/3] overflow-hidden rounded-md border border-border bg-surface-2"
                  >
                    <img src={img.previewUrl} alt="Selected" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      className="absolute right-1 top-1 rounded-md bg-background/90 p-1 text-destructive opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100"
                      onClick={() => removeNewImage(img.previewUrl)}
                      aria-label="Remove selected image"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {totalImageCount < 4 && (
                  <label className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-surface-2 text-xs text-muted-foreground">
                    <Camera className="mb-1 h-4 w-4" />
                    Add photo
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      onChange={handleNewImages}
                    />
                  </label>
                )}
              </div>
            ) : (
              <label className="flex aspect-[4/3] w-32 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border bg-surface-2 text-xs text-muted-foreground">
                <Camera className="mb-1 h-5 w-5" />
                Add photos
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={handleNewImages}
                />
              </label>
            )}
            {isNew && newImages.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Photos will upload when you save the vehicle.
              </p>
            )}
          </div>

          <Button
            className="w-full"
            onClick={() => save.mutate()}
            disabled={save.isPending}
          >
            {save.isPending && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            {save.isPending ? "Saving..." : isNew ? "Add vehicle" : "Save changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Reusable Field ────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="label-eyebrow">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} />
    </div>
  );
}

function Required() {
  return <span className="text-destructive ml-0.5">*</span>;
}