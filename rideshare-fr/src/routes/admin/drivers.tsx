import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { adminService } from "@/lib/api";
import { DriverApprovalDialog } from "@/components/admin-users/driver-approval-dialog";
import { PageHeader } from "@/components/page-header";
import { LoadingState } from "@/components/loading-state";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Check, Eye, ShieldCheck, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/drivers")({
  component: AdminDrivers,
});

function AdminDrivers() {
  const [filter, setFilter] = useState<"all" | "pending" | "approved">("all");
  const [approvalTarget, setApprovalTarget] = useState<{
    id: string;
    name: string;
    approve: boolean;
  } | null>(null);
  const qc = useQueryClient();
  const approvedParam = filter === "all" ? undefined : filter === "approved";

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "drivers", { approved: approvedParam }],
    queryFn: () => adminService.listDrivers({ limit: 100, approved: approvedParam }),
  });

  const setApproval = useMutation({
    mutationFn: ({
      id,
      isApproved,
      approvalReason,
      notificationMessage,
    }: {
      id: string;
      isApproved: boolean;
      approvalReason: string;
      notificationMessage: string;
    }) => adminService.updateDriverProfile(id, { isApproved, approvalReason, notificationMessage }),
    onSuccess: (_profile: unknown, vars: { id: string; isApproved: boolean }) => {
      setApprovalTarget(null);
      qc.invalidateQueries({ queryKey: ["admin", "drivers"] });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
      toast.success(vars.isApproved ? "Driver approved" : "Driver disapproved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin"
        title="Drivers"
        description="Review and approve registered drivers."
      />

      <div className="flex gap-2">
        {(["all", "pending", "approved"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-xs font-mono uppercase tracking-wider transition-colors",
              filter === f
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {f}
          </button>
        ))}
      </div>

      {isLoading ? (
        <LoadingState />
      ) : !data || data.length === 0 ? (
        <EmptyState title="No drivers" description="Nothing matches this filter." />
      ) : (
        <ul className="space-y-2">
          {data.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between gap-4 rounded-md border border-border bg-card p-4"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-display text-base font-semibold">
                    {d.user?.fullName ?? "Unknown"}
                  </span>
                  {d.isApproved ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-primary">
                      <ShieldCheck className="h-3 w-3" /> Approved
                    </span>
                  ) : d.reviewRequestedAt ? (
                    <span className="rounded-full border border-violet/30 bg-violet/10 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-violet">
                      Awaiting review
                    </span>
                  ) : (
                    <span className="rounded-full border border-border bg-surface-2 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Not submitted
                    </span>
                  )}
                </div>
                <div className="mt-1 font-mono text-xs text-muted-foreground">
                  {d.user?.phone} · Licence {d.licenseNumber} · Exp{" "}
                  <span className={isExpired(d.licenseExpiry) ? "text-destructive" : ""}>
                    {formatDate(d.licenseExpiry)}
                    {isExpired(d.licenseExpiry) ? " - expired" : ""}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {d.totalTrips} trips · Joined {formatDate(d.createdAt)}
                  {d.reviewRequestedAt ? ` · Submitted ${formatDate(d.reviewRequestedAt)}` : ""}
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                {d.user?.id && (
                  <Button asChild size="sm" variant="outline" className="gap-2">
                    <Link to="/admin/users/$id" params={{ id: d.user.id }}>
                      <Eye className="h-4 w-4" />
                      View
                    </Link>
                  </Button>
                )}
                {d.isApproved ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setApprovalTarget({
                        id: d.id,
                        name: d.user?.fullName ?? "Driver",
                        approve: false,
                      })
                    }
                    disabled={setApproval.isPending}
                    className="gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
                  >
                    <XCircle className="h-4 w-4" />
                    Disapprove
                  </Button>
                ) : d.reviewRequestedAt ? (
                  <Button
                    size="sm"
                    onClick={() =>
                      setApprovalTarget({
                        id: d.id,
                        name: d.user?.fullName ?? "Driver",
                        approve: true,
                      })
                    }
                    disabled={setApproval.isPending}
                    className="gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Approve
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <DriverApprovalDialog
        open={!!approvalTarget}
        driverName={approvalTarget?.name ?? "Driver"}
        approve={approvalTarget?.approve ?? true}
        isSaving={setApproval.isPending}
        onOpenChange={(open) => {
          if (!open) setApprovalTarget(null);
        }}
        onConfirm={(payload) => {
          if (!approvalTarget) return;
          setApproval.mutate({
            id: approvalTarget.id,
            isApproved: approvalTarget.approve,
            ...payload,
          });
        }}
      />
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
