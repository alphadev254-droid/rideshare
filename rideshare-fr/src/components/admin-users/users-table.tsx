import { Link } from "@tanstack/react-router";
import { Car, CheckCircle2, Mail, Pencil, Power, Trash2, XCircle } from "lucide-react";
import type { AdminUser } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface UsersTableProps {
  users: AdminUser[];
  busyUserId?: string | null;
  onEdit: (user: AdminUser) => void;
  onEmail: (user: AdminUser) => void;
  onToggleActive: (user: AdminUser) => void;
  onDelete: (user: AdminUser) => void;
}

export function UsersTable({
  users,
  busyUserId,
  onEdit,
  onEmail,
  onToggleActive,
  onDelete,
}: UsersTableProps) {
  return (
    <div className="rounded-md border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Driver profile</TableHead>
            <TableHead>Joined</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => {
            const driver = user.driverProfile;
            const isBusy = busyUserId === user.id;
            return (
              <TableRow key={user.id}>
                <TableCell className="min-w-56">
                  <div className="font-medium">{user.fullName}</div>
                  <div className="mt-1 font-mono text-[11px] text-muted-foreground">{user.id}</div>
                </TableCell>
                <TableCell className="min-w-44">
                  <div className="font-mono text-xs">{user.phone}</div>
                  <div className="mt-1 text-xs text-muted-foreground">{user.email ?? "No email"}</div>
                </TableCell>
                <TableCell>
                  <span className="rounded-md border border-border bg-surface-2 px-2 py-1 font-mono text-[11px] uppercase">
                    {user.role}
                  </span>
                </TableCell>
                <TableCell>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium ${
                      user.isActive
                        ? "bg-primary/10 text-primary"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    {user.isActive ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" />
                    )}
                    {user.isActive ? "Active" : "Inactive"}
                  </span>
                </TableCell>
                <TableCell className="min-w-44">
                  {user.role === "driver" ? (
                    driver ? (
                      <Link
                        to="/admin/users/$id"
                        params={{ id: user.id }}
                        className="block text-left text-xs text-primary hover:underline"
                      >
                        {driver.isApproved
                          ? "Approved"
                          : driver.reviewRequestedAt
                            ? "Awaiting approval"
                            : "Not submitted"}
                        <span className="block text-muted-foreground">
                          Licence {driver.licenseNumber}
                        </span>
                      </Link>
                    ) : (
                      <span className="text-xs text-muted-foreground">No profile</span>
                    )
                  ) : (
                    <span className="text-xs text-muted-foreground">Not driver</span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-xs">{formatDate(user.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => onEdit(user)} title="Edit user">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {user.role === "driver" && driver && (
                      <Button
                        asChild
                        size="icon"
                        variant="ghost"
                        title="View driver profile"
                      >
                        <Link to="/admin/users/$id" params={{ id: user.id }}>
                          <Car className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" onClick={() => onEmail(user)} title="Email user">
                      <Mail className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => onToggleActive(user)}
                      disabled={isBusy}
                      title={user.isActive ? "Deactivate user" : "Reactivate user"}
                    >
                      <Power className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="text-destructive" title="Delete user">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete user?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This permanently removes {user.fullName} and related account data that cascades from the user.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => onDelete(user)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
