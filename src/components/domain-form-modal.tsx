"use client";

import { useEffect, useState } from "react";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { Input, Label, FieldError, Select, Textarea } from "./ui/input";
import { domainSchema } from "@/lib/validations";
import { DOMAIN_CATEGORIES } from "@/lib/domain-utils";
import type { Domain, Customer } from "@/lib/schema";
import { toast } from "sonner";
import { useData } from "./data-provider";
import { CustomerPicker } from "./customer-picker";

const emptyForm = {
  name: "",
  registrar: "",
  purchaseDate: "",
  expiryDate: "",
  renewalPrice: "",
  category: "Other" as (typeof DOMAIN_CATEGORIES)[number],
  notes: "",
  autoRenew: false,
};

export function DomainFormModal({
  open,
  onClose,
  domain,
}: {
  open: boolean;
  onClose: () => void;
  domain?: Domain | null;
}) {
  const { refreshDomains, refreshNotifications } = useData();
  const [form, setForm] = useState(emptyForm);
  const [customer, setCustomer] = useState<Customer | null>(null);
  // Guards against submitting before the edit form's customer lookup has
  // resolved - without this, a fast submit right after opening the modal
  // could send customerId="" and wipe out a real existing association.
  const [customerLoaded, setCustomerLoaded] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const isEdit = !!domain;

  useEffect(() => {
    if (open) {
      if (domain) {
        setForm({
          name: domain.name,
          registrar: domain.registrar,
          purchaseDate: domain.purchaseDate,
          expiryDate: domain.expiryDate,
          renewalPrice: String(domain.renewalPrice),
          category: domain.category as (typeof DOMAIN_CATEGORIES)[number],
          notes: domain.notes,
          autoRenew: domain.autoRenew,
        });
        // The domain's owning customer isn't part of the shared DataProvider
        // list (kept lean for the dashboard/calendar/renew-modal consumers),
        // so it's fetched on demand only when the edit form actually opens.
        setCustomer(null);
        setCustomerLoaded(false);
        fetch(`/api/domains/${domain.id}`)
          .then((r) => (r.ok ? r.json() : null))
          .then((data) => data?.customer && setCustomer(data.customer))
          .finally(() => setCustomerLoaded(true));
      } else {
        setForm(emptyForm);
        setCustomer(null);
        setCustomerLoaded(true);
      }
      setErrors({});
    }
  }, [open, domain]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors({});

    if (isEdit && !customerLoaded) {
      toast.error("Still loading this domain's customer info - try again in a moment.");
      return;
    }

    const parsed = domainSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) fieldErrors[issue.path[0] as string] = issue.message;
      setErrors(fieldErrors);
      return;
    }

    const payload = {
      ...parsed.data,
      customerId: customer?.id,
      clearCustomer: isEdit && !customer,
    };

    setLoading(true);
    try {
      const url = isEdit ? `/api/domains/${domain!.id}` : "/api/domains";
      const res = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Something went wrong.");
        setLoading(false);
        return;
      }

      toast.success(isEdit ? "Domain updated." : "Domain added.");
      await refreshDomains();
      await refreshNotifications();
      onClose();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={isEdit ? "Edit Domain" : "Add Domain"} className="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Label htmlFor="name">Domain name</Label>
            <Input
              id="name"
              placeholder="example.com"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <FieldError message={errors.name} />
          </div>
          <div>
            <Label htmlFor="registrar">Registrar</Label>
            <Input
              id="registrar"
              placeholder="GoDaddy"
              value={form.registrar}
              onChange={(e) => setForm({ ...form, registrar: e.target.value })}
            />
            <FieldError message={errors.registrar} />
          </div>
          <div>
            <Label htmlFor="category">Category</Label>
            <Select
              id="category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as (typeof DOMAIN_CATEGORIES)[number] })}
            >
              {DOMAIN_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="purchaseDate">Purchase date</Label>
            <Input
              id="purchaseDate"
              type="date"
              value={form.purchaseDate}
              onChange={(e) => setForm({ ...form, purchaseDate: e.target.value })}
            />
            <FieldError message={errors.purchaseDate} />
          </div>
          <div>
            <Label htmlFor="expiryDate">Expiry date</Label>
            <Input
              id="expiryDate"
              type="date"
              value={form.expiryDate}
              onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
            />
            <FieldError message={errors.expiryDate} />
          </div>
          <div className="col-span-2">
            <Label htmlFor="renewalPrice">Renewal price (per year)</Label>
            <Input
              id="renewalPrice"
              type="number"
              step="0.01"
              placeholder="999"
              value={form.renewalPrice}
              onChange={(e) => setForm({ ...form, renewalPrice: e.target.value })}
            />
            <FieldError message={errors.renewalPrice} />
          </div>
          <div className="col-span-2">
            <CustomerPicker value={customer} onChange={setCustomer} />
          </div>
          <div className="col-span-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              rows={3}
              placeholder="Optional notes about this domain..."
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
            {isEdit ? "Save changes" : "Add domain"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
