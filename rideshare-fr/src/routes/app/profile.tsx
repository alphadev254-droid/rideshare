import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ApiError, userService, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Camera, Check, Loader2, Pencil, X } from "lucide-react";
import { SecureImage } from "@/components/secure-image";

export const Route = createFileRoute("/app/profile")({
  component: Profile,
});

type EditableField = "fullName" | "ecName" | "ecPhone";

function Profile() {
  const { user, setUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const [values, setValues] = useState({ fullName: "", ecName: "", ecPhone: "" });
  const [saved, setSaved] = useState({ fullName: "", ecName: "", ecPhone: "" });
  const [editing, setEditing] = useState<EditableField | null>(null);

  useEffect(() => {
    if (!user) return;
    const initial = {
      fullName: user.fullName ?? "",
      ecName: user.emergencyContactName ?? "",
      ecPhone: user.emergencyContactPhone ?? "",
    };
    setValues(initial);
    setSaved(initial);
  }, [user]);

  useEffect(() => {
    return () => { if (photoPreview) URL.revokeObjectURL(photoPreview); };
  }, [photoPreview]);

  const isDirty =
    values.fullName !== saved.fullName ||
    values.ecName !== saved.ecName ||
    values.ecPhone !== saved.ecPhone;

  const uploadPhoto = useMutation({
    mutationFn: (file: File) => userService.uploadUserAvatar(file),
    onSuccess: (res: { url: string; profilePhotoUrl?: string }) => {
      toast.success("Photo updated");
      setUser({ ...user!, profilePhotoUrl: res.profilePhotoUrl ?? res.url });
      setPhotoPreview(null);
    },
    onError: (e: Error) => toast.error(e instanceof ApiError ? e.message : "Upload failed"),
  });

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoPreview(URL.createObjectURL(file));
    uploadPhoto.mutate(file);
  }

  const save = useMutation({
    mutationFn: () =>
      userService.updateMe({
        fullName: values.fullName,
        emergencyContactName: values.ecName || undefined,
        emergencyContactPhone: values.ecPhone || undefined,
      }),
    onSuccess: (u: User) => {
      setUser(u);
      setSaved({ fullName: values.fullName, ecName: values.ecName, ecPhone: values.ecPhone });
      setEditing(null);
      toast.success("Profile updated");
    },
    onError: (e: Error) => toast.error(e instanceof ApiError ? e.message : "Save failed"),
  });

  function cancelField(field: EditableField) {
    setValues((v) => ({ ...v, [field]: saved[field] }));
    setEditing(null);
  }

  if (!user) return null;

  return (
    <div className="space-y-6 pb-24">
      <PageHeader
        eyebrow="Account"
        title="Profile"
        description="Tap the pencil next to any field to edit it."
      />

      {/* Photo */}
      <div className="flex items-center gap-4">
        <div className="relative">
          {photoPreview ? (
            <img src={photoPreview} alt="Preview" className="h-20 w-20 rounded-full object-cover border-2 border-primary" />
          ) : user.profilePhotoUrl ? (
            <SecureImage src={user.profilePhotoUrl} alt={user.fullName} className="h-20 w-20 rounded-full object-cover border-2 border-border" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-surface-2 border-2 border-dashed border-border text-muted-foreground">
              <Camera className="h-6 w-6" />
            </div>
          )}
          <button
            type="button"
            className="absolute bottom-0 right-0 rounded-full bg-primary p-1.5 text-white shadow hover:bg-primary/90"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadPhoto.isPending}
          >
            {uploadPhoto.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
          </button>
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileSelect} />
        </div>
        <div>
          <p className="font-medium">{user.fullName || "—"}</p>
          <p className="text-sm text-muted-foreground">{user.phone}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Identity */}
        <div className="space-y-1 rounded-md border border-border bg-card p-6">
          <h3 className="label-eyebrow mb-3">Identity</h3>
          <EditableRow
            label="Full name"
            value={values.fullName}
            isEditing={editing === "fullName"}
            onEdit={() => setEditing("fullName")}
            onConfirm={() => setEditing(null)}
            onCancel={() => cancelField("fullName")}
            onChange={(v) => setValues((s) => ({ ...s, fullName: v }))}
          />
          <StaticRow label="Phone" value={user.phone} mono />
          <StaticRow label="Role" value={user.role} capitalize />
        </div>

        {/* Emergency contact */}
        <div className="space-y-1 rounded-md border border-border bg-card p-6">
          <h3 className="label-eyebrow mb-3">Emergency contact</h3>
          <EditableRow
            label="Contact name"
            value={values.ecName}
            placeholder="Add a name"
            isEditing={editing === "ecName"}
            onEdit={() => setEditing("ecName")}
            onConfirm={() => setEditing(null)}
            onCancel={() => cancelField("ecName")}
            onChange={(v) => setValues((s) => ({ ...s, ecName: v }))}
          />
          <EditableRow
            label="Contact phone"
            value={values.ecPhone}
            placeholder="Add a phone number"
            isEditing={editing === "ecPhone"}
            onEdit={() => setEditing("ecPhone")}
            onConfirm={() => setEditing(null)}
            onCancel={() => cancelField("ecPhone")}
            onChange={(v) => setValues((s) => ({ ...s, ecPhone: v }))}
          />
        </div>
      </div>

      {/* Floating save bar */}
      {isDirty && (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-card px-5 py-3 shadow-xl">
          <span className="text-sm text-muted-foreground">Unsaved changes</span>
          <Button size="sm" variant="outline" onClick={() => { setValues(saved); setEditing(null); }}>
            Discard
          </Button>
          <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
            Save
          </Button>
        </div>
      )}
    </div>
  );
}

function EditableRow({
  label,
  value,
  placeholder = "—",
  isEditing,
  onEdit,
  onConfirm,
  onCancel,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  isEditing: boolean;
  onEdit: () => void;
  onConfirm: () => void;
  onCancel: () => void;
  onChange: (v: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (isEditing) inputRef.current?.focus(); }, [isEditing]);

  return (
    <div className="flex items-center gap-2 rounded-md px-1 py-2 hover:bg-surface-2 transition-colors">
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        {isEditing ? (
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onConfirm(); if (e.key === "Escape") onCancel(); }}
            className="mt-1 h-8 text-sm"
          />
        ) : (
          <p className="text-sm font-medium truncate">{value || <span className="text-muted-foreground italic">{placeholder}</span>}</p>
        )}
      </div>
      {isEditing ? (
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={onConfirm} className="rounded p-1 text-green-500 hover:bg-green-500/10" aria-label="Confirm">
            <Check className="h-4 w-4" />
          </button>
          <button type="button" onClick={onCancel} className="rounded p-1 text-muted-foreground hover:bg-surface-2" aria-label="Cancel">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button type="button" onClick={onEdit} className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground hover:bg-surface-2" aria-label={`Edit ${label}`}>
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function StaticRow({ label, value, mono, capitalize }: { label: string; value: string; mono?: boolean; capitalize?: boolean }) {
  return (
    <div className="rounded-md px-1 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-medium ${mono ? "font-mono" : ""} ${capitalize ? "capitalize" : ""}`}>{value || "—"}</p>
    </div>
  );
}
