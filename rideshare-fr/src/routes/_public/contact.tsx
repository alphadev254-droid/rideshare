import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";
import { contactService } from "@/lib/api";
import { extractApiError } from "@/lib/api/client";

export const Route = createFileRoute("/_public/contact")({
  head: () => ({
    meta: [
      { title: "Contact ChepetsaRide — Support, Help & Enquiries" },
      { name: "description", content: "Need help with a booking, driver application or have a question? Contact the ChepetsaRide team. Based in Lilongwe, serving passengers and drivers across Malawi." },
      { name: "keywords", content: "contact ChepetsaRide, rideshare booking help Malawi, passenger support Malawi, driver application help, shared travel enquiry Malawi, Lilongwe rideshare contact, customer service Malawi rideshare" },
      { property: "og:title", content: "Contact ChepetsaRide" },
      { property: "og:description", content: "Reach our team for support, partnerships or press. We respond within 24 hours." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Contact,
});

function Contact() {
  const [sent, setSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    if (sent) setSent(false);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setIsSending(true);
    try {
      await contactService.send({
        name: form.name.trim(),
        email: form.email.trim(),
        subject: form.subject.trim(),
        message: form.message.trim(),
      });
      setSent(true);
      setForm({ name: "", email: "", subject: "", message: "" });
      toast.success("Thanks - we'll respond within 24 hours.");
    } catch (error) {
      toast.error(extractApiError(error, "Could not send your message"));
    } finally {
      setIsSending(false);
    }
  }
  return (
    <div className="mx-auto max-w-7xl px-6 py-16">
      <PageHeader eyebrow="Contact" title="We're here when you need us" />
      <div className="mt-10 grid gap-10 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-1">
          {[
            { icon: Mail, label: "Email", value: "info@chepetsaride.com" },
            { icon: Phone, label: "Phone", value: "+265 99 000 0000" },
            { icon: MapPin, label: "Address", value: "Area 13, Lilongwe" },
          ].map((c) => (
            <div key={c.label} className="rounded-md border border-border bg-card p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <c.icon className="h-4 w-4" />
                </span>
                <div>
                  <div className="label-eyebrow">{c.label}</div>
                  <div className="text-sm">{c.value}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <form
          onSubmit={submit}
          className="space-y-4 rounded-md border border-border bg-card p-6 lg:col-span-2"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="label-eyebrow" htmlFor="n">
                Name
              </Label>
              <Input id="n" required value={form.name} onChange={(e) => update("name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow" htmlFor="e">
                Email
              </Label>
              <Input id="e" required type="email" value={form.email} onChange={(e) => update("email", e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="label-eyebrow" htmlFor="s">
              Subject
            </Label>
            <Input id="s" required value={form.subject} onChange={(e) => update("subject", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="label-eyebrow" htmlFor="m">
              Message
            </Label>
            <Textarea id="m" required rows={6} value={form.message} onChange={(e) => update("message", e.target.value)} />
          </div>
          <Button type="submit" disabled={isSending}>
            {isSending ? "Sending..." : sent ? "Sent" : "Send message"}
          </Button>
        </form>
      </div>
    </div>
  );
}



