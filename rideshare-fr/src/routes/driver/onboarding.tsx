import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import {
  driverService,
  type DriverProfile,
  extractApiError,
} from "@/lib/api";
import { SecureImage, SecureFileLink } from "@/components/secure-image";
import { DatePickerField, isPastIsoDate } from "@/components/date-picker-field";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import {
  BadgeCheck,
  AlertCircle,
  Upload,
  Loader2,
  FileText,
  IdCard,
  Camera,
  ChevronLeft,
  Clock,
  Send,
  ShieldAlert,
  CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/driver/onboarding")({
  component: Onboarding,
});

type DocType = "id_front" | "id_back" | "license_doc";
type PendingFile = { file: File; preview: string; mime: string | null };

const docLabels: Record<DocType, { label: string; description: string }> = {
  id_front: { label: "ID — Front", description: "Front side of your national ID or passport" },
  id_back: { label: "ID — Back", description: "Back side of your national ID or passport" },
  license_doc: {
    label: "Driving License",
    description: "Your valid driving license (image or PDF)",
  },
};

type OnboardingStatus =
  | "not_started"
  | "in_progress"
  | "ready_to_submit"
  | "under_review"
  | "approved";

const flowSteps = [
  { key: "profile", label: "Complete profile" },
  { key: "submit", label: "Submit for review" },
  { key: "review", label: "Admin review" },
  { key: "approved", label: "Start driving" },
] as const;

function isProfileComplete(profile: DriverProfile | null | undefined): boolean {
  if (!profile) return false;
  return !!(
    profile.licenseNumber?.length >= 4 &&
    profile.licenseExpiry &&
    profile.profilePhotoUrl &&
    profile.idFrontUrl &&
    profile.idBackUrl &&
    profile.licenseDocUrl
  );
}

function getOnboardingStatus(profile: DriverProfile | null | undefined): OnboardingStatus {
  if (!profile) return "not_started";
  if (profile.isApproved) return "approved";
  if (profile.reviewStatus === "pending") return "under_review";
  if (isProfileComplete(profile)) return "ready_to_submit";
  return "in_progress";
}

function getActiveFlowIndex(status: OnboardingStatus): number {
  switch (status) {
    case "not_started":
    case "in_progress":
      return 0;
    case "ready_to_submit":
      return 1;
    case "under_review":
      return 2;
    case "approved":
      return 3;
    default:
      return 0;
  }
}

function OnboardingStatusBadge({ status }: { status: OnboardingStatus }) {
  const config = {
    not_started: {
      label: "Not started",
      icon: Clock,
      className: "border-border bg-surface-2 text-muted-foreground",
    },
    in_progress: {
      label: "In progress",
      icon: Clock,
      className: "border-border bg-surface-2 text-muted-foreground",
    },
    ready_to_submit: {
      label: "Ready to submit",
      icon: Send,
      className: "border-primary/30 bg-primary/10 text-primary",
    },
    under_review: {
      label: "Waiting approval",
      icon: ShieldAlert,
      className: "border-gold/30 bg-gold/10 text-gold",
    },
    approved: {
      label: "Approved",
      icon: CheckCircle2,
      className: "border-primary/30 bg-primary/10 text-primary",
    },
  }[status];

  const Icon = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
        config.className,
      )}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      {config.label}
    </span>
  );
}

function OnboardingFlowBar({ status }: { status: OnboardingStatus }) {
  const activeIndex = getActiveFlowIndex(status);

  return (
    <div className="rounded-md border border-border bg-card p-4">
      <p className="label-eyebrow mb-3">Application progress</p>
      <ol className="grid gap-3 sm:grid-cols-4">
        {flowSteps.map((step, index) => {
          const isComplete = index < activeIndex || status === "approved";
          const isActive = index === activeIndex && status !== "approved";
          const isApprovedStep = status === "approved" && index === flowSteps.length - 1;

          return (
            <li
              key={step.key}
              className={cn(
                "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
                isComplete || isApprovedStep
                  ? "border-primary/30 bg-primary/5 text-primary"
                  : isActive
                    ? "border-gold/30 bg-gold/5 text-gold"
                    : "border-border bg-surface-2 text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
                  isComplete || isApprovedStep
                    ? "bg-primary text-primary-foreground"
                    : isActive
                      ? "bg-gold text-background"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {isComplete || isApprovedStep ? "✓" : index + 1}
              </span>
              <span className="leading-snug">{step.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// ─── Reusable File Upload Widget ────────────────────────────────────────────

function FileUpload({
  currentUrl,
  onUpload,
  onSelect,
  pendingFile,
  label,
  description,
  icon,
  accept = "image/jpeg,image/png,image/webp,application/pdf",
  disabled = false,
}: {
  currentUrl?: string | null;
  onUpload: (file: File) => Promise<void>;
  onSelect?: (file: File) => void;
  pendingFile?: PendingFile | null;
  label: string;
  description: string;
  icon: React.ReactNode;
  accept?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewMime, setPreviewMime] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const shownPreview = pendingFile?.preview ?? preview;
  const shownPreviewMime = pendingFile?.mime ?? previewMime;
  const hasFile = !!currentUrl || !!shownPreview;
  const isPdf =
    (shownPreviewMime ? shownPreviewMime === "application/pdf" : false) ||
    (!!currentUrl && /\.pdf($|\?)/i.test(currentUrl));

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || disabled) return;

    if (onSelect) {
      onSelect(file);
      if (inputRef.current) inputRef.current.value = "";
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    setPreviewMime(file.type || null);

    setUploading(true);
    try {
      await onUpload(file);
      toast.success(`${label} uploaded`);
    } catch (err) {
      toast.error(extractApiError(err, `Failed to upload ${label}`));
      setPreview(null);
      setPreviewMime(null);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={cn("rounded-md border border-border bg-card p-4", disabled && "opacity-70")}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-3 text-muted-foreground">
            {icon}
          </span>
          <div>
            <div className="font-medium text-sm">{label}</div>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
        {hasFile && (
          <span className="shrink-0 text-xs text-primary">
            <BadgeCheck className="inline h-3.5 w-3.5" /> Uploaded
          </span>
        )}
      </div>

      {(shownPreview || currentUrl) && (
        <div className="mt-3">
          {isPdf ? (
            shownPreview ? (
              <a
                href={shownPreview}
                target="_blank"
                rel="noreferrer"
                className="flex h-28 w-full items-center justify-center gap-2 rounded-md border border-border bg-surface-2 text-sm text-primary hover:underline"
              >
                <FileText className="h-4 w-4" />
                View uploaded PDF
              </a>
            ) : currentUrl ? (
              <SecureFileLink
                href={currentUrl}
                className="flex h-28 w-full items-center justify-center gap-2 rounded-md border border-border bg-surface-2 text-sm text-primary hover:underline"
              >
                <FileText className="h-4 w-4" />
                View uploaded PDF
              </SecureFileLink>
            ) : null
          ) : shownPreview ? (
            <img
              src={shownPreview}
              alt={label}
              className="h-28 w-full rounded-md border border-border object-cover"
            />
          ) : currentUrl ? (
            <SecureImage
              src={currentUrl}
              alt={label}
              className="h-28 w-full rounded-md border border-border object-cover"
            />
          ) : null}
          {currentUrl && !shownPreview && (
            <p className="mt-1 text-xs text-muted-foreground">Previously uploaded</p>
          )}
          {pendingFile && (
            <p className="mt-1 text-xs text-primary">Ready to upload when you continue</p>
          )}
        </div>
      )}

      <div className="mt-3">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFile}
          className="hidden"
          id={`file-${label.replace(/\s+/g, "-").toLowerCase()}`}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading || disabled}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? (
            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
          ) : (
            <Upload className="mr-2 h-3 w-3" />
          )}
          {disabled ? "Locked" : uploading ? "Uploading..." : hasFile ? "Replace" : "Upload"}
        </Button>
      </div>
    </div>
  );
}

// ─── Main Onboarding Page ───────────────────────────────────────────────────

function Onboarding() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["driver", "profile"],
    queryFn: () => driverService.profile().catch(() => null),
  });

  const hasProfile = !!profile;
  const isApproved = profile?.isApproved ?? false;
  const dbStatus = getOnboardingStatus(profile);
  const [reviewMode, setReviewMode] = useState(false);
  const isReady = dbStatus === "ready_to_submit";
  const status = isReady && reviewMode ? "ready_to_submit" : dbStatus;
  const canEdit = !isApproved && status !== "under_review" && !(isReady && reviewMode);

  // ── License & Documents State ────

  const [licenseNumber, setLicenseNumber] = useState(profile?.licenseNumber ?? "");
  const [licenseExpiry, setLicenseExpiry] = useState(
    profile?.licenseExpiry ? new Date(profile.licenseExpiry).toISOString().split("T")[0] : "",
  );
  const [pendingPhoto, setPendingPhoto] = useState<PendingFile | null>(null);
  const [pendingDocs, setPendingDocs] = useState<Partial<Record<DocType, PendingFile>>>({});

  const allFieldsComplete = !!(
    licenseNumber.length >= 4 &&
    licenseExpiry.length > 0 &&
    (profile?.profilePhotoUrl || pendingPhoto) &&
    (profile?.idFrontUrl || pendingDocs.id_front) &&
    (profile?.idBackUrl || pendingDocs.id_back) &&
    (profile?.licenseDocUrl || pendingDocs.license_doc)
  );

  function handleSubmitForReview() {
    if (!allFieldsComplete) {
      toast.error("Fill in all required fields before submitting for review");
      return;
    }
    requestReview.mutate();
  }
  const pendingPhotoRef = useRef<PendingFile | null>(null);
  const pendingDocsRef = useRef<Partial<Record<DocType, PendingFile>>>({});

  useEffect(() => {
    if (profile) {
      setLicenseNumber(profile.licenseNumber ?? "");
      if (profile.licenseExpiry)
        setLicenseExpiry(new Date(profile.licenseExpiry).toISOString().split("T")[0]);
    }
  }, [profile]);

  // ── Mutations ──────────────────────────────────────────────────────

  const submitLicense = useMutation({
    mutationFn: async () => {
      await driverService.register({ licenseNumber, licenseExpiry });

      if (pendingPhoto) {
        await driverService.uploadProfilePhoto(pendingPhoto.file);
      }

      for (const [type, pending] of Object.entries(pendingDocs) as Array<[DocType, PendingFile]>) {
        await driverService.uploadDocument(pending.file, type);
      }
    },
    onSuccess: () => {
      toast.success("Driver documents saved");
      clearPendingProfileFiles();
      qc.invalidateQueries({ queryKey: ["driver", "profile"] });
    },
    onError: (err) => toast.error(extractApiError(err, "Failed to save driver documents")),
  });

  const uploadDoc = useMutation({
    mutationFn: ({ file, type }: { file: File; type: DocType }) =>
      driverService.uploadDocument(file, type),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["driver", "profile"] }),
  });

  const uploadPhoto = useMutation({
    mutationFn: (file: File) => driverService.uploadProfilePhoto(file),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["driver", "profile"] }),
  });

  const requestReview = useMutation({
    mutationFn: () => driverService.requestReview(),
    onSuccess: async () => {
      toast.success("Application submitted for review");
      await qc.invalidateQueries({ queryKey: ["driver", "profile"] });
    },
    onError: (err) => toast.error(extractApiError(err, "Failed to submit for review")),
  });

  // ── Handlers ───────────────────────────────────────────────────────

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit) return;
    submitLicense.mutate();
  }

  function queueProfilePhoto(file: File) {
    setPendingPhoto((current) => {
      if (current?.preview) URL.revokeObjectURL(current.preview);
      return { file, preview: URL.createObjectURL(file), mime: file.type || null };
    });
  }

  function queueDocument(type: DocType, file: File) {
    setPendingDocs((current) => {
      const existing = current[type];
      if (existing?.preview) URL.revokeObjectURL(existing.preview);
      return {
        ...current,
        [type]: { file, preview: URL.createObjectURL(file), mime: file.type || null },
      };
    });
  }

  function clearPendingProfileFiles() {
    if (pendingPhoto?.preview) URL.revokeObjectURL(pendingPhoto.preview);
    Object.values(pendingDocs).forEach((pending) => {
      if (pending?.preview) URL.revokeObjectURL(pending.preview);
    });
    setPendingPhoto(null);
    setPendingDocs({});
  }

  useEffect(() => {
    pendingPhotoRef.current = pendingPhoto;
  }, [pendingPhoto]);

  useEffect(() => {
    pendingDocsRef.current = pendingDocs;
  }, [pendingDocs]);

  useEffect(() => {
    return () => {
      if (pendingPhotoRef.current?.preview) URL.revokeObjectURL(pendingPhotoRef.current.preview);
      Object.values(pendingDocsRef.current).forEach((pending) => {
        if (pending?.preview) URL.revokeObjectURL(pending.preview);
      });
    };
  }, []);

  async function handleDocUpload(file: File, type: DocType) {
    await uploadDoc.mutateAsync({ file, type });
  }

  async function handlePhotoUpload(file: File) {
    await uploadPhoto.mutateAsync(file);
  }

  // ── Derived state ──────────────────────────────────────────────────

  const licenseFilled = licenseNumber.length >= 4 && licenseExpiry.length > 0;

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Already approved — show read-only summary
  if (hasProfile && isApproved) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Setup"
          title="Driver onboarding"
          description="Your profile is verified and ready."
          actions={<OnboardingStatusBadge status="approved" />}
        />
        <OnboardingFlowBar status="approved" />
        <div className="flex flex-col gap-4 rounded-md border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-primary">
            <BadgeCheck className="mr-2 inline h-4 w-4" />
            You're approved — add vehicles and publish trips anytime.
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => navigate({ to: "/driver/vehicles" })}>
              Manage vehicles
            </Button>
            <Button onClick={() => navigate({ to: "/driver" })}>Go to Dashboard</Button>
          </div>
        </div>
        <div className="rounded-md border border-border bg-card p-5">
          <h3 className="label-eyebrow mb-3">Your submitted data</h3>
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">License number</dt>
              <dd className="font-medium">{profile.licenseNumber}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">License expiry</dt>
              <dd className="font-medium">
                {new Date(profile.licenseExpiry).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Documents</dt>
              <dd className="font-medium">ID (front & back) + License ✓</dd>
            </div>
            {(profile as any)?.vehicles?.length > 0 && (
              <div>
                <dt className="text-muted-foreground">Vehicles</dt>
                <dd className="font-medium">{(profile as any).vehicles.length} vehicle(s) registered</dd>
              </div>
            )}
          </dl>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Setup"
        title="Driver onboarding"
        description={
          status === "ready_to_submit"
            ? "Everything is complete. Submit your profile for admin review."
            : status === "under_review"
              ? "Your application is with our team for review."
              : "Fill in your license details and upload all required documents."
        }
        actions={<OnboardingStatusBadge status={status} />}
      />

      <OnboardingFlowBar status={status} />

      {status === "in_progress" && (
        <div className="rounded-md border border-border bg-surface-2 p-4 text-sm text-muted-foreground">
          Fill in your license details and upload all required documents. Once complete, submit for
          review. You can manage vehicles separately on the Vehicles page.
        </div>
      )}


      {status === "under_review" && (
        <div className="flex items-start gap-3 rounded-md border border-gold/30 bg-gold/5 p-4 text-sm text-gold">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Waiting for admin approval</p>
            <p className="mt-1 text-gold/90">
              Submitted{" "}
              {profile?.reviewRequestedAt ? formatDate(profile.reviewRequestedAt) : "recently"}.
              Your profile is locked while we review it. You'll be able to manage vehicles and
              publish trips once approved.
            </p>
          </div>
        </div>
      )}

      {/* License & Documents Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* License Info */}
        <div className="rounded-md border border-border bg-card p-4 sm:p-6">
          <h3 className="label-eyebrow mb-4">License Information <span className="text-destructive">*</span></h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="label-eyebrow">License number</Label>
              <Input
                required
                disabled={!canEdit}
                value={licenseNumber}
                onChange={(e) => setLicenseNumber(e.target.value)}
                placeholder="MW-DL-123456"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow" htmlFor="license-expiry">
                Expiry date
              </Label>
              <DatePickerField
                id="license-expiry"
                required
                disabled={!canEdit}
                value={licenseExpiry}
                onChange={setLicenseExpiry}
                placeholder="Select license expiry date"
                fromYear={new Date().getFullYear() - 5}
                toYear={new Date().getFullYear() + 15}
              />
              <p className="text-xs text-muted-foreground">
                Tap to open the calendar, then pick month, year, and day.
              </p>
              {licenseExpiry && isPastIsoDate(licenseExpiry) && (
                <p className="text-xs text-destructive">Your license has expired.</p>
              )}
            </div>
          </div>
        </div>

        {/* Profile Photo */}
        <div className="rounded-md border border-border bg-card p-4 sm:p-6">
          <h3 className="label-eyebrow mb-4">Profile Photo <span className="text-destructive">*</span></h3>
          <div className="max-w-sm">
            <FileUpload
              currentUrl={profile?.profilePhotoUrl}
              onUpload={handlePhotoUpload}
              onSelect={!hasProfile ? queueProfilePhoto : undefined}
              pendingFile={pendingPhoto}
              label="Profile picture"
              description={
                hasProfile
                  ? "Upload a clear photo of your face"
                  : "Choose a clear face photo. It will upload when you continue."
              }
              icon={<Camera className="h-5 w-5" />}
              accept="image/jpeg,image/png,image/webp"
              disabled={!canEdit}
            />
          </div>
        </div>

        {/* ID & License Documents */}
        <div className="rounded-md border border-border bg-card p-4 sm:p-6">
          <h3 className="label-eyebrow mb-4">Required Documents <span className="text-destructive">*</span></h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Choose clear images of your ID and driving license. If this is your first time here,
            files upload together when you click Save.
          </p>
          <div className="grid gap-4 sm:grid-cols-3">
            <FileUpload
              currentUrl={profile?.idFrontUrl}
              onUpload={(file) => handleDocUpload(file, "id_front")}
              onSelect={!hasProfile ? (file) => queueDocument("id_front", file) : undefined}
              pendingFile={pendingDocs.id_front}
              {...docLabels.id_front}
              icon={<IdCard className="h-5 w-5" />}
              disabled={!canEdit}
            />
            <FileUpload
              currentUrl={profile?.idBackUrl}
              onUpload={(file) => handleDocUpload(file, "id_back")}
              onSelect={!hasProfile ? (file) => queueDocument("id_back", file) : undefined}
              pendingFile={pendingDocs.id_back}
              {...docLabels.id_back}
              icon={<IdCard className="h-5 w-5" />}
              disabled={!canEdit}
            />
            <FileUpload
              currentUrl={profile?.licenseDocUrl}
              onUpload={(file) => handleDocUpload(file, "license_doc")}
              onSelect={!hasProfile ? (file) => queueDocument("license_doc", file) : undefined}
              pendingFile={pendingDocs.license_doc}
              {...docLabels.license_doc}
              icon={<FileText className="h-5 w-5" />}
              disabled={!canEdit}
            />
          </div>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-end">
          {canEdit && (
            <Button type="submit" disabled={!licenseFilled || submitLicense.isPending} className="w-full sm:w-auto">
              {submitLicense.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              {submitLicense.isPending ? "Saving..." : hasProfile ? "Save changes" : "Save & continue"}
            </Button>
          )}
          {canEdit && isReady && (
            <Button type="button" onClick={() => setReviewMode(true)} className="w-full sm:w-auto">
              <Send className="mr-2 h-4 w-4" />
              Review & submit
            </Button>
          )}
          {isReady && reviewMode && (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button type="button" variant="outline" onClick={() => setReviewMode(false)} className="w-full sm:w-auto">
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back to edit
              </Button>
              <Button type="button" disabled={requestReview.isPending} onClick={handleSubmitForReview} className="w-full sm:w-auto">
                {requestReview.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Send className="mr-2 h-4 w-4" />
                Submit for review
              </Button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}