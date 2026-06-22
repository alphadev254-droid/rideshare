import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { AdminUser, UserRole } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type AdminUserUpdate = Partial<
  Pick<
    AdminUser,
    | "fullName"
    | "phone"
    | "email"
    | "role"
    | "emergencyContactName"
    | "emergencyContactPhone"
    | "isActive"
  >
>;

interface EditUserDialogProps {
  user: AdminUser | null;
  open: boolean;
  isSaving?: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (userId: string, payload: AdminUserUpdate) => void;
}

export function EditUserDialog({
  user,
  open,
  isSaving,
  onOpenChange,
  onSave,
}: EditUserDialogProps) {
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    email: "",
    role: "passenger" as UserRole,
    emergencyContactName: "",
    emergencyContactPhone: "",
    isActive: true,
  });

  useEffect(() => {
    if (!user) return;
    setForm({
      fullName: user.fullName ?? "",
      phone: user.phone ?? "",
      email: user.email ?? "",
      role: user.role,
      emergencyContactName: user.emergencyContactName ?? "",
      emergencyContactPhone: user.emergencyContactPhone ?? "",
      isActive: user.isActive ?? true,
    });
  }, [user]);

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    onSave(user.id, {
      fullName: form.fullName,
      phone: form.phone,
      email: form.email.trim() ? form.email.trim() : null,
      role: form.role,
      emergencyContactName: form.emergencyContactName.trim()
        ? form.emergencyContactName.trim()
        : null,
      emergencyContactPhone: form.emergencyContactPhone.trim()
        ? form.emergencyContactPhone.trim()
        : null,
      isActive: form.isActive,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>Update account, role, contact details and active status.</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <Input value={form.fullName} onChange={(e) => update("fullName", e.target.value)} required />
            </Field>
            <Field label="Phone">
              <Input value={form.phone} onChange={(e) => update("phone", e.target.value)} required />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                placeholder="No email"
              />
            </Field>
            <Field label="Role">
              <Select value={form.role} onValueChange={(value) => update("role", value as UserRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="passenger">Passenger</SelectItem>
                  <SelectItem value="driver">Driver</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Emergency contact">
              <Input
                value={form.emergencyContactName}
                onChange={(e) => update("emergencyContactName", e.target.value)}
                placeholder="Name"
              />
            </Field>
            <Field label="Emergency phone">
              <Input
                value={form.emergencyContactPhone}
                onChange={(e) => update("emergencyContactPhone", e.target.value)}
                placeholder="Phone"
              />
            </Field>
          </div>

          <div className="rounded-md border border-border bg-surface p-4">
            <Toggle
              label="Active"
              checked={form.isActive}
              onCheckedChange={(checked) => update("isActive", checked)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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

function Toggle({
  label,
  checked,
  onCheckedChange,
}: {
  label: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Checkbox
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      {label}
    </label>
  );
}
