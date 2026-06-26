import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent, useEffect, useRef } from "react";
import { useMutation } from "@tanstack/react-query";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ApiError, userService, type User } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { toast } from "sonner";
import { Camera, Loader2, Pencil } from "lucide-react";
import { SecureImage } from "@/components/secure-image";

export const Route = createFileRoute("/app/profile")({
  component: Profile,
});

function Profile() {
  const { user, setUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState("");
  const [ecName, setEcName] = useState("");
  const [ecPhone, setEcPhone] = useState("");
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName ?? "");
    setEcName(user.emergencyContactName ?? "");
    setEcPhone(user.emergencyContactPhone ?? "");
  }, [user]);

  useEffect(() => {
    return () => { if (photoPreview) URL.revokeObjectURL(photoPreview); };
  }, [photoPreview]);

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
    const preview = URL.createObjectURL(file);
    setPhotoPreview(preview);
    uploadPhoto.mutate(file);
  }

  const save = useMutation({
    mutationFn: () =>
      userService.updateMe({
        fullName,
        emergencyContactName: ecName || undefined,
        emergencyContactPhone: ecPhone || undefined,
      }),
    onSuccess: (u: User) => {
      setUser(u);
      toast.success("Profile updated");
    },
    onError: (e: Error) => toast.error(e instanceof ApiError ? e.message : "Save failed"),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }
  if (!user) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Profile"
        description="Personal details and emergency contact."
      />

      {/* Edit hint for non-digitally-literate users */}
      <div className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-4 py-2.5 text-sm text-muted-foreground">
        <Pencil className="h-3.5 w-3.5 shrink-0" />
        <span>You can edit your details below. When done, press <strong className="text-foreground">Save changes</strong>.</span>
      </div>

      {/* Photo Upload */}
      <div className="flex items-start gap-4">
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
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
        <div>
          <p className="text-sm font-medium">Profile photo</p>
          <p className="text-xs text-muted-foreground">Click the camera icon to upload. Supports JPEG, PNG, WebP.</p>
        </div>
      </div>

      <form onSubmit={submit} className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4 rounded-md border border-border bg-card p-6">
          <h3 className="label-eyebrow">Identity</h3>
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Phone</Label>
            <Input value={user.phone} disabled className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Role</Label>
            <Input value={user.role} disabled className="capitalize" />
          </div>
        </div>

        <div className="space-y-4 rounded-md border border-border bg-card p-6">
          <h3 className="label-eyebrow">Emergency contact</h3>
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Contact name</Label>
            <Input value={ecName} onChange={(e) => setEcName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Contact phone</Label>
            <Input value={ecPhone} onChange={(e) => setEcPhone(e.target.value)} />
          </div>
          <Button type="submit" disabled={save.isPending} className="mt-2">
            Save changes
          </Button>
        </div>
      </form>
    </div>
  );
}