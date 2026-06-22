import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { BadgeCheck, Camera, FileText, IdCard, Loader2, Trash2, Upload } from "lucide-react";
import type { AdminUser, DriverProfile } from "@/lib/api";
import { extractApiError } from "@/lib/api";
import { SecureFileLink, SecureImage } from "@/components/secure-image";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export type DriverProfileUpdate = Partial<
  Pick<DriverProfile, "licenseNumber" | "licenseExpiry" | "isApproved" | "reviewStatus" | "reviewRequestedAt">
>;

type FileField = "profilePhotoUrl" | "idFrontUrl" | "idBackUrl" | "licenseDocUrl";
type DocType = "id_front" | "id_back" | "license_doc";

interface DriverProfileEditFormProps {
  user: AdminUser;
  isSaving?: boolean;
  onSave: (driverProfileId: string, payload: DriverProfileUpdate) => void;
  onUploadPhoto: (driverProfileId: string, file: File) => Promise<void>;
  onUploadDocument: (driverProfileId: string, file: File, type: DocType) => Promise<void>;
  onRemoveFile: (driverProfileId: string, field: FileField) => Promise<void>;
}

export function DriverProfileEditForm({
  user,
  isSaving,
  onSave,
  onUploadPhoto,
  onUploadDocument,
  onRemoveFile,
}: DriverProfileEditFormProps) {
  const profile = user.driverProfile;
  const [form, setForm] = useState({
    licenseNumber: "",
    licenseExpiry: "",
    isApproved: false,
    reviewStatus: "rejected" as DriverProfile["reviewStatus"],
    reviewRequestedAt: "",
  });

  useEffect(() => {
    if (!profile) return;
    setForm({
      licenseNumber: profile.licenseNumber ?? "",
      licenseExpiry: profile.licenseExpiry ? toDateInput(profile.licenseExpiry) : "",
      isApproved: profile.isApproved,
      reviewStatus: profile.reviewStatus,
      reviewRequestedAt: profile.reviewRequestedAt ? toDateTimeInput(profile.reviewRequestedAt) : "",
    });
  }, [profile]);

  if (!profile) return null;
  const driverProfile = profile;

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave(driverProfile.id, {
      licenseNumber: form.licenseNumber,
      licenseExpiry: form.licenseExpiry,
      isApproved: form.isApproved,
      reviewStatus: form.reviewStatus,
      reviewRequestedAt: form.reviewRequestedAt
        ? new Date(form.reviewRequestedAt).toISOString()
        : null,
    });
  }

  return (
    <div className="space-y-4 rounded-md border border-border bg-card p-4">
      <div>
        <h2 className="font-display text-base font-semibold">Edit driver profile</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Update licence details and replace or remove submitted files.
        </p>
      </div>

      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Licence number">
            <Input
              value={form.licenseNumber}
              onChange={(e) => update("licenseNumber", e.target.value)}
              required
            />
          </Field>
          <Field label="Licence expiry">
            <Input
              type="date"
              value={form.licenseExpiry}
              onChange={(e) => update("licenseExpiry", e.target.value)}
              required
            />
          </Field>
          <Field label="Review status">
            <Select
              value={form.reviewStatus}
              onValueChange={(v: string) => update("reviewStatus", v as DriverProfile["reviewStatus"])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Review requested at">
            <Input
              type="datetime-local"
              value={form.reviewRequestedAt}
              onChange={(e) => update("reviewRequestedAt", e.target.value)}
            />
          </Field>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <Checkbox
              checked={form.isApproved}
              onCheckedChange={(value) => update("isApproved", value === true)}
            />
            Approved
          </label>
        </div>

        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save profile fields"}
        </Button>
      </form>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminFileCard
          currentUrl={profile.profilePhotoUrl}
          label="Profile photo"
          description="Driver face photo"
          icon={<Camera className="h-5 w-5" />}
          accept="image/jpeg,image/png,image/webp"
          onUpload={(file) => onUploadPhoto(profile.id, file)}
          onRemove={() => onRemoveFile(profile.id, "profilePhotoUrl")}
        />
        <AdminFileCard
          currentUrl={profile.idFrontUrl}
          label="ID front"
          description="Front side of national ID"
          icon={<IdCard className="h-5 w-5" />}
          onUpload={(file) => onUploadDocument(profile.id, file, "id_front")}
          onRemove={() => onRemoveFile(profile.id, "idFrontUrl")}
        />
        <AdminFileCard
          currentUrl={profile.idBackUrl}
          label="ID back"
          description="Back side of national ID"
          icon={<IdCard className="h-5 w-5" />}
          onUpload={(file) => onUploadDocument(profile.id, file, "id_back")}
          onRemove={() => onRemoveFile(profile.id, "idBackUrl")}
        />
        <AdminFileCard
          currentUrl={profile.licenseDocUrl}
          label="Licence document"
          description="Driving licence image or PDF"
          icon={<FileText className="h-5 w-5" />}
          onUpload={(file) => onUploadDocument(profile.id, file, "license_doc")}
          onRemove={() => onRemoveFile(profile.id, "licenseDocUrl")}
        />
      </div>
    </div>
  );
}

function AdminFileCard({
  currentUrl,
  onUpload,
  onRemove,
  label,
  description,
  icon,
  accept = "image/jpeg,image/png,image/webp,application/pdf",
}: {
  currentUrl?: string | null;
  onUpload: (file: File) => Promise<void>;
  onRemove: () => Promise<void>;
  label: string;
  description: string;
  icon: ReactNode;
  accept?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState<string | null>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);

  const hasFile = !!currentUrl || !!preview;
  const isPdf =
    (previewMime ? previewMime === "application/pdf" : false) ||
    (!!currentUrl && /\.pdf($|\?)/i.test(currentUrl));

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setPreviewMime(file.type || null);
    setBusy("upload");
    try {
      await onUpload(file);
      toast.success(`${label} replaced`);
    } catch (error) {
      toast.error(extractApiError(error, `Could not replace ${label}`));
      setPreview(null);
      setPreviewMime(null);
    } finally {
      setBusy(null);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remove() {
    setBusy("remove");
    try {
      await onRemove();
      setPreview(null);
      setPreviewMime(null);
      toast.success(`${label} removed`);
    } catch (error) {
      toast.error(extractApiError(error, `Could not remove ${label}`));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-3 text-muted-foreground">
            {icon}
          </span>
          <div>
            <div className="text-sm font-medium">{label}</div>
            <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
        {hasFile && (
          <span className="shrink-0 text-xs text-primary">
            <BadgeCheck className="inline h-3.5 w-3.5" /> Uploaded
          </span>
        )}
      </div>

      <div className={cn("mt-3 flex h-32 items-center justify-center rounded-md border border-border bg-card")}>
        {!hasFile ? (
          <span className="text-xs text-muted-foreground">No file</span>
        ) : isPdf ? (
          preview ? (
            <a href={preview} target="_blank" rel="noreferrer" className="text-sm text-primary hover:underline">
              View selected PDF
            </a>
          ) : currentUrl ? (
            <SecureFileLink href={currentUrl} className="text-sm text-primary hover:underline">
              View uploaded PDF
            </SecureFileLink>
          ) : null
        ) : preview ? (
          <img src={preview} alt={label} className="h-full w-full rounded-md object-cover" />
        ) : currentUrl ? (
          <SecureImage src={currentUrl} alt={label} className="h-full w-full rounded-md object-cover" />
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleFile}
        className="hidden"
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!!busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy === "upload" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
          {hasFile ? "Replace" : "Upload"}
        </Button>
        {hasFile && (
          <Button type="button" variant="outline" size="sm" disabled={!!busy} onClick={remove}>
            {busy === "remove" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="label-eyebrow">{label}</Label>
      {children}
    </div>
  );
}

function toDateInput(value: string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function toDateTimeInput(value: string): string {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
