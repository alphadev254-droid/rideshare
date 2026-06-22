import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface DriverApprovalDialogProps {
  open: boolean;
  driverName: string;
  approve: boolean;
  isSaving?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (payload: { approvalReason: string; notificationMessage: string }) => void;
}

export function defaultDriverApprovalMessage(driverName: string, approve: boolean, reason: string) {
  if (approve) {
    return `Hi ${driverName},\n\nYour RideShare driver profile has been approved. You can now publish trips and access driver tools.\n\n${reason ? `Note from admin: ${reason}\n\n` : ""}Thank you,\nRideShare Admin`;
  }

  return `Hi ${driverName},\n\nYour RideShare driver profile is no longer approved and needs attention before you can publish trips.\n\nReason: ${reason || "Please review your submitted driver profile details and documents."}\n\nThank you,\nRideShare Admin`;
}

export function DriverApprovalDialog({
  open,
  driverName,
  approve,
  isSaving,
  onOpenChange,
  onConfirm,
}: DriverApprovalDialogProps) {
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!open) return;
    const defaultReason = approve
      ? "Your documents and licence details have been reviewed successfully."
      : "Your profile requires changes before it can remain approved.";
    setReason(defaultReason);
    setMessage(defaultDriverApprovalMessage(driverName, approve, defaultReason));
  }, [approve, driverName, open]);

  useEffect(() => {
    if (!open) return;
    setMessage(defaultDriverApprovalMessage(driverName, approve, reason));
  }, [approve, driverName, reason, open]);

  function submit(event: FormEvent) {
    event.preventDefault();
    onConfirm({ approvalReason: reason.trim(), notificationMessage: message.trim() });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{approve ? "Approve driver profile" : "Disapprove driver profile"}</DialogTitle>
          <DialogDescription>
            Set the reason and edit the email message before notifying the driver.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Reason</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Email message</Label>
            <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={9} required />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !message.trim()}>
              {isSaving ? "Sending..." : approve ? "Approve and send" : "Disapprove and send"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
