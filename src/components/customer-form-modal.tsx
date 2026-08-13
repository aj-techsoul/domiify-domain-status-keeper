"use client";

import { useEffect, useState } from "react";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input, Label, FieldError, Textarea } from "./ui/input";
import { customerSchema } from "@/lib/validations";
import type { Customer } from "@/lib/schema";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";

const emptyForm = {
  fullName: "",
  username: "",
  email: "",
  phone: "",
  company: "",
  website: "",
  notes: "",
};

export function CustomerFormModal({
  open,
  onClose,
  customer,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  customer?: Customer | null;
  onSaved?: (customer: Customer) => void;
}) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  // When a create collides with an existing customer of the same name (and
  // no email/username to disambiguate), the API returns 409 with the
  // candidate so the user can explicitly choose instead of silently
  // creating a duplicate or silently merging (spec: customer dedup rules).
  const [ambiguous, setAmbiguous] = useState<Customer | null>(null);
  const isEdit = !!customer;

  useEffect(() => {
    if (open) {
      if (customer) {
        setForm({
          fullName: customer.fullName,
          username: customer.username,
          email: customer.email,
          phone: customer.phone,
          company: customer.company,
          website: customer.website,
          notes: customer.notes,
        });
      } else {
        setForm(emptyForm);
      }
      setErrors({});
      setAmbiguous(null);
    }
  }, [open, customer]);

  async function submit(force = false) {
    setErrors({});
    const parsed = customerSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as string] = issue.message;
      setErrors(fieldErrors);
      return;
    }

    setLoading(true);
    try {
      const url = isEdit ? `/api/customers/${customer!.id}` : "/api/customers";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...parsed.data, force }),
      });
      const data = await res.json();

      if (res.status === 409 && data.ambiguous) {
        setAmbiguous(data.candidates?.[0] ?? null);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        toast.error(data.error || "Something went wrong.");
        setLoading(false);
        return;
      }

      toast.success(isEdit ? "Customer updated." : data.created === false ? "Matched an existing customer." : "Customer added.");
      onSaved?.(data.customer);
      onClose();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    submit(false);
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Edit Customer" : "Add Customer"} className="max-w-xl">
      {ambiguous ? (
        <div className="space-y-4">
          <div className="flex gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-500/10">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 pt-1.5">
              A customer named <span className="font-semibold text-foreground">&ldquo;{ambiguous.fullName}&rdquo;</span> already
              exists. Is this the same person, or a different one?
            </p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setAmbiguous(null)}>
              Cancel
            </Button>
            <Button variant="secondary" className="flex-1" onClick={() => submit(false)} loading={loading}>
              Same person
            </Button>
            <Button className="flex-1" onClick={() => submit(true)} loading={loading}>
              Different person
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="fullName">Full name</Label>
              <Input
                id="fullName"
                placeholder="Priya Sharma"
                value={form.fullName}
                onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              />
              <FieldError message={errors.fullName} />
            </div>
            <div>
              <Label htmlFor="username">Username / handle</Label>
              <Input
                id="username"
                placeholder="priyasharma"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
              />
              <FieldError message={errors.username} />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="priya@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <FieldError message={errors.email} />
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" placeholder="+91 98765 43210" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <FieldError message={errors.phone} />
            </div>
            <div>
              <Label htmlFor="company">Company</Label>
              <Input id="company" placeholder="Acme Inc." value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              <FieldError message={errors.company} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="website">Website</Label>
              <Input
                id="website"
                placeholder="https://example.com"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
              />
              <FieldError message={errors.website} />
            </div>
            <div className="col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                rows={3}
                placeholder="Optional notes about this customer..."
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" className="flex-1" loading={loading}>
              {isEdit ? "Save changes" : "Add customer"}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
