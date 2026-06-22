import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/empty-state";
import { LoadingState } from "@/components/loading-state";
import { PageHeader } from "@/components/page-header";
import {
  UserFilters,
  type ActiveFilter,
  type DriverProfileFilter,
  type RoleFilter,
} from "@/components/admin-users/user-filters";
import { UsersTable } from "@/components/admin-users/users-table";
import {
  EditUserDialog,
  type AdminUserUpdate,
} from "@/components/admin-users/edit-user-dialog";
import { SendEmailDialog } from "@/components/admin-users/send-email-dialog";
import { Button } from "@/components/ui/button";
import { adminService, extractApiError, type AdminUser } from "@/lib/api";

export const Route = createFileRoute("/admin/users")({
  component: AdminUsers,
});

function AdminUsers() {
  const path = useRouterState({ select: (state) => state.location.pathname });
  const qc = useQueryClient();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<RoleFilter>("all");
  const [active, setActive] = useState<ActiveFilter>("all");
  const [driverProfileStatus, setDriverProfileStatus] = useState<DriverProfileFilter>("all");
  const [page, setPage] = useState(1);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [emailUser, setEmailUser] = useState<AdminUser | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const users = useQuery({
    queryKey: ["admin", "users", { search, role, active, driverProfileStatus, page }],
    queryFn: () =>
      adminService.listUsers({
        page,
        limit: 70,
        search: search || undefined,
        role: role === "all" ? undefined : role,
        active: active === "all" ? undefined : active === "active",
        driverProfileStatus:
          driverProfileStatus === "all" ? undefined : driverProfileStatus,
      }),
  });

  const invalidateUsers = () => {
    qc.invalidateQueries({ queryKey: ["admin", "users"] });
    qc.invalidateQueries({ queryKey: ["admin", "drivers"] });
  };

  const updateUser = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AdminUserUpdate }) =>
      adminService.updateUser(id, payload),
    onSuccess: () => {
      toast.success("User updated");
      setEditingUser(null);
      invalidateUsers();
    },
    onError: (error: unknown) => toast.error(extractApiError(error, "Could not update user")),
  });

  const toggleActive = useMutation({
    mutationFn: (user: AdminUser) => {
      setBusyUserId(user.id);
      return adminService.setUserStatus(user.id, !(user.isActive ?? true));
    },
    onSuccess: (user: AdminUser) => {
      toast.success(`User ${user.isActive ? "activated" : "deactivated"}`);
      invalidateUsers();
    },
    onError: (error: unknown) => toast.error(extractApiError(error, "Could not update status")),
    onSettled: () => setBusyUserId(null),
  });

  const deleteUser = useMutation({
    mutationFn: (user: AdminUser) => {
      setBusyUserId(user.id);
      return adminService.deleteUser(user.id);
    },
    onSuccess: () => {
      toast.success("User deleted");
      invalidateUsers();
    },
    onError: (error: unknown) => toast.error(extractApiError(error, "Could not delete user")),
    onSettled: () => setBusyUserId(null),
  });

  const sendEmail = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { subject: string; message: string };
    }) => adminService.sendUserEmail(id, payload),
    onSuccess: () => {
      toast.success("Email sent");
      setEmailUser(null);
    },
    onError: (error: unknown) => toast.error(extractApiError(error, "Could not send email")),
  });

  const rows = users.data?.items ?? [];
  const total = users.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 70));

  if (path !== "/admin/users") {
    return <Outlet />;
  }

  function applySearch() {
    setPage(1);
    setSearch(searchInput.trim());
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Admin"
        title="Users"
        description="Manage accounts, roles, driver profiles, status and email outreach."
      />

      <UserFilters
        search={searchInput}
        role={role}
        active={active}
        driverProfileStatus={driverProfileStatus}
        isLoading={users.isFetching}
        onSearchChange={setSearchInput}
        onRoleChange={(value) => {
          setPage(1);
          setRole(value);
          if (value !== "driver") setDriverProfileStatus("all");
        }}
        onActiveChange={(value) => {
          setPage(1);
          setActive(value);
        }}
        onDriverProfileStatusChange={(value) => {
          setPage(1);
          setDriverProfileStatus(value);
          if (value !== "all") setRole("driver");
        }}
        onSubmit={applySearch}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>
          Showing {rows.length} of {total} users · Page {page} of {totalPages}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page <= 1 || users.isFetching}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
            disabled={page >= totalPages || users.isFetching}
          >
            Next
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => users.refetch()}
            disabled={users.isFetching}
          >
            Refresh
          </Button>
        </div>
      </div>

      {users.isLoading ? (
        <LoadingState />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<Users className="h-5 w-5" />}
          title="No users found"
          description="Adjust the search or filters to find matching accounts."
        />
      ) : (
        <UsersTable
          users={rows}
          busyUserId={busyUserId}
          onEdit={setEditingUser}
          onEmail={setEmailUser}
          onToggleActive={(user) => toggleActive.mutate(user)}
          onDelete={(user) => deleteUser.mutate(user)}
        />
      )}

      <EditUserDialog
        user={editingUser}
        open={!!editingUser}
        isSaving={updateUser.isPending}
        onOpenChange={(open) => {
          if (!open) setEditingUser(null);
        }}
        onSave={(id, payload) => updateUser.mutate({ id, payload })}
      />

      <SendEmailDialog
        user={emailUser}
        open={!!emailUser}
        isSending={sendEmail.isPending}
        onOpenChange={(open) => {
          if (!open) setEmailUser(null);
        }}
        onSend={(id, payload) => sendEmail.mutate({ id, payload })}
      />
    </div>
  );
}
