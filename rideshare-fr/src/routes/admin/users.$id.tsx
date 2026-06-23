import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Check, FileText, ShieldCheck, XCircle } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import { SecureFileLink, SecureImage } from "@/components/secure-image";
import { DriverApprovalDialog } from "@/components/admin-users/driver-approval-dialog";
import {
  DriverProfileEditForm,
  type DriverProfileUpdate,
} from "@/components/admin-users/driver-profile-edit-form";
import { AdminVehiclesManager } from "@/components/admin-users/admin-vehicles-manager";
import { Button } from "@/components/ui/button";
import { adminService, extractApiError } from "@/lib/api";
import { formatDate, formatMwk } from "@/lib/format";

export const Route = createFileRoute("/admin/users/$id")({
  component: AdminUserDriverProfile,
});

function AdminUserDriverProfile() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [approvalTarget, setApprovalTarget] = useState<boolean | null>(null);

  const userQuery = useQuery({
    queryKey: ["admin", "user", id],
    queryFn: () => adminService.getUser(id),
  });

  const setApproval = useMutation({
    mutationFn: ({
      driverProfileId,
      isApproved,
      approvalReason,
      notificationMessage,
    }: {
      driverProfileId: string;
      isApproved: boolean;
      approvalReason: string;
      notificationMessage: string;
    }) =>
      adminService.updateDriverProfile(driverProfileId, {
        isApproved,
        approvalReason,
        notificationMessage,
      }),
    onSuccess: (_profile: unknown, vars: { driverProfileId: string; isApproved: boolean }) => {
      toast.success(vars.isApproved ? "Driver approved" : "Driver disapproved");
      setApprovalTarget(null);
      qc.invalidateQueries({ queryKey: ["admin", "user", id] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "drivers"] });
    },
    onError: (error: unknown) =>
      toast.error(extractApiError(error, "Could not update approval")),
  });

  const updateProfile = useMutation({
    mutationFn: ({
      driverProfileId,
      payload,
    }: {
      driverProfileId: string;
      payload: DriverProfileUpdate;
    }) => adminService.updateDriverProfile(driverProfileId, payload),
    onSuccess: () => {
      toast.success("Driver profile updated");
      qc.invalidateQueries({ queryKey: ["admin", "user", id] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "drivers"] });
    },
    onError: (error: unknown) =>
      toast.error(extractApiError(error, "Could not update driver profile")),
  });

  const uploadPhoto = useMutation({
    mutationFn: ({ driverProfileId, file }: { driverProfileId: string; file: File }) =>
      adminService.uploadDriverProfilePhoto(driverProfileId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "user", id] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "drivers"] });
    },
    onError: (error: unknown) =>
      toast.error(extractApiError(error, "Could not replace profile photo")),
  });

  const uploadDocument = useMutation({
    mutationFn: ({
      driverProfileId,
      file,
      type,
    }: {
      driverProfileId: string;
      file: File;
      type: "id_front" | "id_back" | "license_doc";
    }) => adminService.uploadDriverDocument(driverProfileId, file, type),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "user", id] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "drivers"] });
    },
    onError: (error: unknown) =>
      toast.error(extractApiError(error, "Could not replace document")),
  });

  const removeFile = useMutation({
    mutationFn: ({
      driverProfileId,
      field,
    }: {
      driverProfileId: string;
      field: "profilePhotoUrl" | "idFrontUrl" | "idBackUrl" | "licenseDocUrl";
    }) => adminService.removeDriverProfileFile(driverProfileId, field),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "user", id] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      qc.invalidateQueries({ queryKey: ["admin", "drivers"] });
    },
    onError: (error: unknown) => toast.error(extractApiError(error, "Could not remove file")),
  });

  function invalidateProfile() {
    qc.invalidateQueries({ queryKey: ["admin", "user", id] });
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
    qc.invalidateQueries({ queryKey: ["admin", "drivers"] });
  }

  const addVehicle = useMutation({
    mutationFn: (payload: Parameters<typeof adminService.addDriverVehicle>[1]) =>
      adminService.addDriverVehicle(profile!.id, payload),
    onSuccess: () => {
      toast.success("Vehicle added");
      invalidateProfile();
    },
    onError: (error: unknown) => toast.error(extractApiError(error, "Could not add vehicle")),
  });

  const updateVehicle = useMutation({
    mutationFn: ({
      vehicleId,
      payload,
    }: {
      vehicleId: string;
      payload: Parameters<typeof adminService.updateDriverVehicle>[2];
    }) => adminService.updateDriverVehicle(profile!.id, vehicleId, payload),
    onSuccess: () => {
      toast.success("Vehicle updated");
      invalidateProfile();
    },
    onError: (error: unknown) => toast.error(extractApiError(error, "Could not update vehicle")),
  });

  const deleteVehicle = useMutation({
    mutationFn: (vehicleId: string) => adminService.deleteDriverVehicle(profile!.id, vehicleId),
    onSuccess: () => {
      toast.success("Vehicle deleted");
      invalidateProfile();
    },
    onError: (error: unknown) => toast.error(extractApiError(error, "Could not delete vehicle")),
  });

  const uploadVehicleImage = useMutation({
    mutationFn: ({ vehicleId, file }: { vehicleId: string; file: File }) =>
      adminService.uploadDriverVehicleImage(profile!.id, vehicleId, file),
    onSuccess: () => {
      toast.success("Vehicle image uploaded");
      invalidateProfile();
    },
    onError: (error: unknown) => toast.error(extractApiError(error, "Could not upload image")),
  });

  const removeVehicleImage = useMutation({
    mutationFn: ({ vehicleId, url }: { vehicleId: string; url: string }) =>
      adminService.removeDriverVehicleImage(profile!.id, vehicleId, url),
    onSuccess: () => {
      toast.success("Vehicle image removed");
      invalidateProfile();
    },
    onError: (error: unknown) => toast.error(extractApiError(error, "Could not remove image")),
  });

  const reviewVehicle = useMutation({
    mutationFn: ({ vehicleId, approved }: { vehicleId: string; approved: boolean }) =>
      adminService.reviewDriverVehicle(profile!.id, vehicleId, approved ? "approved" : "rejected"),
    onSuccess: (_vehicle, vars) => {
      toast.success(vars.approved ? "Vehicle approved" : "Vehicle marked not allowed yet");
      invalidateProfile();
    },
    onError: (error: unknown) => toast.error(extractApiError(error, "Could not update vehicle approval")),
  });

  const user = userQuery.data;
  const profile = user?.driverProfile;

  if (userQuery.isLoading) return <LoadingState />;

  if (!user) {
    return (
      <EmptyState
        title="User not found"
        description="The account may have been deleted or the ID is invalid."
      />
    );
  }

  if (user.role !== "driver" || !profile) {
    return (
      <div className="space-y-6">
        <BackLink />
        <EmptyState
          title="No driver profile"
          description="This user is not a driver or has not created a driver profile yet."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <BackLink />
      <PageHeader
        eyebrow="Driver profile"
        title={user.fullName}
        description={`${user.phone}${user.email ? ` · ${user.email}` : ""}`}
        actions={
          <Button
            onClick={() => setApprovalTarget(!profile.isApproved)}
            disabled={setApproval.isPending}
            variant={profile.isApproved ? "outline" : "default"}
            className={
              profile.isApproved
                ? "gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
                : "gap-2"
            }
          >
            {profile.isApproved ? <XCircle className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {setApproval.isPending
              ? "Saving..."
              : profile.isApproved
                ? "Disapprove profile"
                : "Approve profile"}
          </Button>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-md border border-border bg-card">
            {profile.profilePhotoUrl ? (
              <SecureImage
                src={profile.profilePhotoUrl}
                alt={`${user.fullName} profile photo`}
                className="aspect-square w-full object-cover"
              />
            ) : (
              <div className="flex aspect-square items-center justify-center bg-surface-2 text-sm text-muted-foreground">
                No photo
              </div>
            )}
            <div className="border-t border-border p-4">
              <ApprovalBadge approved={profile.isApproved} submitted={profile.reviewRequestedAt} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <dl className="grid gap-4 rounded-md border border-border bg-card p-4 text-sm sm:grid-cols-3">
            <Field label="Profile ID" value={profile.id} mono />
            <Field label="Licence number" value={profile.licenseNumber} />
            <Field
              label="Licence expiry"
              value={`${formatDate(profile.licenseExpiry)}${isExpired(profile.licenseExpiry) ? " - expired" : ""}`}
              danger={isExpired(profile.licenseExpiry)}
            />
            <Field label="Submitted" value={formatDate(profile.reviewRequestedAt)} />
            <Field label="Trips" value={String(profile.totalTrips ?? 0)} />
            <Field label="Earnings" value={formatMwk(profile.totalEarningsMwk)} />
          </dl>

          <AdminVehiclesManager
            vehicles={profile.vehicles ?? []}
            onAdd={(payload) => addVehicle.mutateAsync(payload).then(() => undefined)}
            onUpdate={(vehicleId, payload) =>
              updateVehicle.mutateAsync({ vehicleId, payload }).then(() => undefined)
            }
            onDelete={(vehicleId) => deleteVehicle.mutateAsync(vehicleId).then(() => undefined)}
            onUploadImage={(vehicleId, file) =>
              uploadVehicleImage.mutateAsync({ vehicleId, file }).then(() => undefined)
            }
            onRemoveImage={(vehicleId, url) =>
              removeVehicleImage.mutateAsync({ vehicleId, url }).then(() => undefined)
            }
            onReview={(vehicleId, approved) =>
              reviewVehicle.mutateAsync({ vehicleId, approved }).then(() => undefined)
            }
          />

          <div className="rounded-md border border-border bg-card p-4">
            <div className="label-eyebrow">Documents</div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <DocLink label="Profile photo" url={profile.profilePhotoUrl} />
              <DocLink label="Licence document" url={profile.licenseDocUrl} />
              <DocLink label="ID front" url={profile.idFrontUrl} />
              <DocLink label="ID back" url={profile.idBackUrl} />
            </div>
          </div>

          <div className="hidden rounded-md border border-border bg-card p-4">
            <div className="label-eyebrow">Vehicles</div>
            {(profile.vehicles ?? []).length === 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">No active vehicles.</p>
            ) : (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {profile.vehicles!.map((vehicle) => (
                  <div key={vehicle.id} className="rounded-md border border-border bg-surface p-3">
                    <div className="font-medium">
                      {vehicle.make} {vehicle.model}
                    </div>
                    <div className="mt-1 font-mono text-xs text-muted-foreground">
                      {vehicle.plateNumber} · {vehicle.year}
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {vehicle.seatCapacity} seats · {vehicle.comfortClass}
                      {vehicle.color ? ` · ${vehicle.color}` : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DriverProfileEditForm
            user={user}
            isSaving={updateProfile.isPending}
            onSave={(driverProfileId, payload) =>
              updateProfile.mutate({ driverProfileId, payload })
            }
            onUploadPhoto={(driverProfileId, file) =>
              uploadPhoto.mutateAsync({ driverProfileId, file }).then(() => undefined)
            }
            onUploadDocument={(driverProfileId, file, type) =>
              uploadDocument.mutateAsync({ driverProfileId, file, type }).then(() => undefined)
            }
            onRemoveFile={(driverProfileId, field) =>
              removeFile.mutateAsync({ driverProfileId, field }).then(() => undefined)
            }
          />
        </div>
      </div>

      <DriverApprovalDialog
        open={approvalTarget !== null}
        driverName={user.fullName}
        approve={approvalTarget === true}
        isSaving={setApproval.isPending}
        onOpenChange={(open) => {
          if (!open) setApprovalTarget(null);
        }}
        onConfirm={(payload) => {
          if (approvalTarget === null) return;
          setApproval.mutate({
            driverProfileId: profile.id,
            isApproved: approvalTarget,
            ...payload,
          });
        }}
      />
    </div>
  );
}

function BackLink() {
  return (
    <Link
      to="/admin/users"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Users
    </Link>
  );
}

function ApprovalBadge({ approved, submitted }: { approved: boolean; submitted?: string | null }) {
  if (approved) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary">
        <ShieldCheck className="h-3.5 w-3.5" />
        Approved
      </span>
    );
  }
  if (submitted) {
    return (
      <span className="rounded-md bg-gold/10 px-2 py-1 text-xs font-medium text-gold">
        Awaiting approval
      </span>
    );
  }
  return (
    <span className="rounded-md bg-surface-2 px-2 py-1 text-xs font-medium text-muted-foreground">
      Not submitted
    </span>
  );
}

function Field({
  label,
  value,
  mono,
  danger,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
  danger?: boolean;
}) {
  return (
    <div>
      <dt className="label-eyebrow">{label}</dt>
      <dd className={`mt-1 ${mono ? "font-mono text-xs" : ""} ${danger ? "text-destructive" : ""}`}>
        {value || "-"}
      </dd>
    </div>
  );
}

function isExpired(value?: string | null): boolean {
  if (!value) return false;
  const expiry = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expiry.setHours(0, 0, 0, 0);
  return expiry < today;
}

function DocLink({ label, url }: { label: string; url?: string | null }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-2 text-sm">
      <span className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-muted-foreground" />
        {label}
      </span>
      {url ? (
        <SecureFileLink href={url} className="text-xs text-primary hover:underline">
          View
        </SecureFileLink>
      ) : (
        <span className="text-xs text-muted-foreground">Missing</span>
      )}
    </div>
  );
}
