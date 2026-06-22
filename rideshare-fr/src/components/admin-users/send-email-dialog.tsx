import { useEffect, useState, type FormEvent } from "react";
import type { AdminUser } from "@/lib/api";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";

interface SendEmailDialogProps {
  user: AdminUser | null;
  open: boolean;
  isSending?: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (userId: string, payload: { subject: string; message: string }) => void;
}

export function SendEmailDialog({
  user,
  open,
  isSending,
  onOpenChange,
  onSend,
}: SendEmailDialogProps) {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (open) {
      setSubject("");
      setMessage("");
    }
  }, [open]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    onSend(user.id, { subject: subject.trim(), message: message.trim() });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Email user</DialogTitle>
          <DialogDescription>
            {user?.email
              ? `Send a message to ${user.fullName} at ${user.email}.`
              : "This user does not have an email address."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Subject</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label className="label-eyebrow">Message</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={7}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSending || !user?.email || !subject.trim() || !message.trim()}>
              {isSending ? "Sending..." : "Send email"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
