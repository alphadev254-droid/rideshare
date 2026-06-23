import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Phone, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_public/contact")({
  head: () => ({
    meta: [
      { title: "Contact — RideShare Malawi" },
      {
        name: "description",
        content: "Get in touch with the RideShare Malawi team — support, partnerships, press.",
      },
    ],
  }),
  component: Contact,
});

function Contact() {
  const [sent, setSent] = useState(false);
  function submit(e: FormEvent) {
    e.preventDefault();
    setSent(true);
    toast.success("Thanks — we'll respond within 24 hours.");
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
              <Input id="n" required />
            </div>
            <div className="space-y-1.5">
              <Label className="label-eyebrow" htmlFor="e">
                Email
              </Label>
              <Input id="e" required type="email" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="label-eyebrow" htmlFor="s">
              Subject
            </Label>
            <Input id="s" required />
          </div>
          <div className="space-y-1.5">
            <Label className="label-eyebrow" htmlFor="m">
              Message
            </Label>
            <Textarea id="m" required rows={6} />
          </div>
          <Button type="submit" disabled={sent}>
            {sent ? "Sent" : "Send message"}
          </Button>
        </form>
      </div>
    </div>
  );
}
