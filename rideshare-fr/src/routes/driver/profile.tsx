import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState, useEffect, useRef, type FormEvent, type ChangeEvent } from "react";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { userService, extractApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { SecureImage } from "@/components/secure-image";
import { Camera, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/driver/profile")({
  component: DriverProfile,
});

function DriverProfile() {
  const { user, setUser, refreshUser } = useAuth();
  const [fullName, setFullName] = useState("");
  const [ecName, setEcName] = useState("");
  const [ecPhone, setEcPhone] = useState("");
  const [pendingPhoto, setPendingPhoto] = useState<{ file: File; preview: string } | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName ?? "");
    setEcName(user.emergencyContactName ?? "");
    setEcPhone(user.emergencyContactPhone ?? "");
  }, [user]);

  useEffect(() => {
    return () => {
      if (pendingPhoto?.preview) URL.revokeObjectURL(pendingPhoto.preview);
    };
  }, [pendingPhoto]);

  const save = useMutation({
    mutationFn: () =>
      userService.updateMe({
        fullName,
        emergencyContactName: ecName || undefined,
        emergencyContactPhone: ecPhone || undefined,
      }),
    onSuccess: (u) => {
      setUser(u);
      toast.success("Profile updated");
    },
    onError: (err: unknown) => toast.error(extractApiError(err, "Save failed")),
  });

  const uploadPhoto = useMutation({
    mutationFn: (file: File) => userService.uploadUserAvatar(file),
    onSuccess: async (res) => {
      toast.success("Profile photo updated");
      setPendingPhoto(null);
      if (user) {
        setUser({ ...user, profilePhotoUrl: res.profilePhotoUrl });
      }
      await refreshUser();
    },
    onError: (err: unknown) => toast.error(extractApiError(err, "Could not upload photo")),
  });

  function handlePhotoSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setPendingPhoto((current) => {
      if (current?.preview) URL.revokeObjectURL(current.preview);
      return { file, preview: URL.createObjectURL(file) };
    });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    save.mutate();
  }
  if (!user) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Account"
        title="Driver profile"
        description="Personal details, profile photo and emergency contact."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Photo Column */}
        <div className="rounded-md border border-border bg-card p-6 lg:col-span-1">
          <h3 className="label-eyebrow mb-4">Profile photo</h3>
          <div className="flex flex-col items-center gap-4">
            {pendingPhoto ? (
              <img
                src={pendingPhoto.preview}
                alt="New profile"
                className="aspect-square w-40 rounded-lg border border-border object-cover"
              />
            ) : user.profilePhotoUrl ? (
              <SecureImage
                src={user.profilePhotoUrl}
                alt={user.fullName}
                className="aspect-square w-40 rounded-lg border border-border object-cover"
              />
            ) : (
              <div className="flex aspect-square w-40 items-center justify-center rounded-lg border border-dashed border-border bg-surface-2 text-sm text-muted-foreground">
                <Camera className="h-8 w-8" />
              </div>
            )}

            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handlePhotoSelect}
            />

            {pendingPhoto ? (
              <div className="flex gap-2">
                <Button size="sm" onClick={() => uploadPhoto.mutate(pendingPhoto.file)} disabled={uploadPhoto.isPending}>
                  {uploadPhoto.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  <Upload className="mr-1 h-3 w-3" />
                  Upload
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPendingPhoto(null)}>
                  Cancel
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => photoInputRef.current?.click()}>
                <Camera className="mr-1 h-3 w-3" />
                {user.profilePhotoUrl ? "Change photo" : "Upload photo"}
              </Button>
            )}
          </div>
        </div>

        {/* Details Form */}
        <form onSubmit={submit} className="space-y-6 lg:col-span-2">
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
            <Button type="submit" disabled={save.isPending} className="w-full sm:w-auto">
              {save.isPending && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
              Save changes
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}