// General settings (new admin design). Repurposed from the old Polaris
// post-purchase overview — post-purchase is now handled by the funnel system,
// so /app/settings is the store's General settings page the new nav points to.
// The old Polaris offer editor still lives at /app/settings/edit (untouched).
/* eslint-disable react/prop-types */
import { useEffect, useState } from "react";
import { useLoaderData, useNavigate, useFetcher } from "react-router";
import { toast } from "sonner";
import { authenticate } from "../shopify.server";
import { getStore, updateStore } from "../models/store.server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Save, CreditCard } from "lucide-react";

const CURRENCIES = ["USD", "EUR", "GBP", "CAD", "AUD", "INR", "JPY", "BRL"];

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  let store = null;
  try {
    store = await getStore(shop);
  } catch {
    // Store table may not exist yet (pre-migration) — render defaults.
  }

  return {
    shop,
    store: store
      ? {
          storeName: store.storeName ?? "",
          storeEmail: store.storeEmail ?? "",
          currency: store.currency ?? "USD",
          currentPlan: store.currentPlan ?? "FREE",
          isInternal: Boolean(store.isInternal),
        }
      : { storeName: "", storeEmail: "", currency: "USD", currentPlan: "FREE", isInternal: false },
  };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const form = await request.formData();
  try {
    const currencyRaw = form.get("currency")?.toString();
    const data = {
      storeName: form.get("storeName")?.toString().trim() || null,
      storeEmail: form.get("storeEmail")?.toString().trim() || null,
      currency: CURRENCIES.includes(currencyRaw) ? currencyRaw : "USD",
    };
    await updateStore(session.shop, data);
    return { ok: true, message: "Settings saved" };
  } catch (error) {
    return { ok: false, error: error?.message || "Save failed" };
  }
};

function ReadonlyRow({ label, value, children }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <p className="text-sm text-muted-foreground">{label}</p>
      {children ?? <p className="font-medium text-foreground">{value || "—"}</p>}
    </div>
  );
}

export default function GeneralSettings() {
  const { shop, store } = useLoaderData();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [storeName, setStoreName] = useState(store.storeName);
  const [storeEmail, setStoreEmail] = useState(store.storeEmail);
  const [currency, setCurrency] = useState(store.currency);

  const busy = fetcher.state !== "idle";

  useEffect(() => {
    if (!fetcher.data) return;
    if (fetcher.data.ok) toast.success(fetcher.data.message || "Saved");
    else if (fetcher.data.error) toast.error(fetcher.data.error);
  }, [fetcher.data]);

  const save = () =>
    fetcher.submit({ storeName, storeEmail, currency }, { method: "post" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">General Settings</h1>
        <p className="text-muted-foreground">Manage your store configuration</p>
      </div>

      {/* Store info (read-only) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Store</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <ReadonlyRow label="Store Domain" value={shop} />
          <ReadonlyRow label="Current Plan">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{store.currentPlan}</Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => navigate("/app/settings/billing")}
              >
                <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                Manage
              </Button>
            </div>
          </ReadonlyRow>
          <ReadonlyRow label="Internal Store">
            <Badge variant={store.isInternal ? "default" : "outline"}>
              {store.isInternal ? "Yes (free forever)" : "No"}
            </Badge>
          </ReadonlyRow>
        </CardContent>
      </Card>

      {/* Editable preferences */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Store name</Label>
              <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Contact email</Label>
              <Input
                type="email"
                value={storeEmail}
                onChange={(e) => setStoreEmail(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Currency</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Used to format revenue across the app.</p>
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={save} disabled={busy}>
              <Save className="h-4 w-4 mr-2" />
              {busy ? "Saving..." : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
