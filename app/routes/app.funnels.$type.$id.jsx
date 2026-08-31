// Local presentational helpers take plain props; this project doesn't use the
// prop-types runtime checker, so disable that rule for this file.
/* eslint-disable react/prop-types */
// Ported RevLift pattern: clickable card/list rows that also contain real
// buttons. Keyboard/role a11y is a tracked follow-up.
/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
import { useEffect, useState } from "react";
import { useLoaderData, useNavigate, useFetcher } from "react-router";
import { toast } from "sonner";
import { authenticate } from "../shopify.server";
import { getFunnel, updateFunnel } from "../models/funnel.server";
import { getStore, updateStore } from "../models/store.server";
import { createOffer, updateOffer, deleteOffer } from "../models/funnel-offer.server";
import {
  DEFAULT_PRE_PURCHASE_SETTINGS,
  DEFAULT_POST_PURCHASE_SETTINGS,
  DEFAULT_THANK_YOU_SETTINGS,
} from "../lib/default-settings";
import { ThankYouEditor } from "@/components/thank-you/ThankYouEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ShopifyProductPicker,
  SelectedProductsDisplay,
} from "@/components/ShopifyProductPicker";
import { PostPurchaseEditor } from "@/components/post-purchase/PostPurchaseEditor";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Filter,
  ShoppingBag,
  ShoppingCart,
  CreditCard,
  Pencil,
  Info,
} from "lucide-react";

const VALID_TYPES = ["pre-purchase", "post-purchase", "thank-you"];

function validateType(type) {
  if (!VALID_TYPES.includes(type)) throw new Response("Not Found", { status: 404 });
  return type;
}

// Prisma Decimal fields aren't serializable across the loader boundary — convert
// the money fields on each offer to plain numbers (or null).
function serializeOffer(o) {
  const num = (v) => (v == null ? null : Number(v));
  return {
    ...o,
    price: num(o.price),
    compareAtPrice: num(o.compareAtPrice),
    discountValue: num(o.discountValue),
    revenue: Number(o.revenue ?? 0),
    variantBRevenue: Number(o.variantBRevenue ?? 0),
  };
}

// Pre-purchase flow sections (from RevLift's getFlowSections).
const PRE_PURCHASE_SECTIONS = [
  { key: "product-page", icon: ShoppingBag, title: "Product Page Upsell", description: "Customer on Product Page." },
  { key: "pre-purchase", icon: ShoppingCart, title: "Pre-Purchase Upsell", description: "Customer on Cart or Page with Product Buy Box." },
  { key: "cart-drawer", icon: CreditCard, title: "Cart Drawer Upsell", description: "The offer can be placed on the slide Cart Drawer." },
];

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const type = validateType(params.type);

  // TEMPORARY: Phase 2 tables may not exist on the dev DB yet — degrade to a
  // friendly error state instead of crashing. Remove once the migration ships.
  // Pick the settings blob + Store column that matches this funnel type.
  const SETTINGS_BY_TYPE = {
    "pre-purchase": { key: "prePurchaseSettings", defaults: DEFAULT_PRE_PURCHASE_SETTINGS },
    "post-purchase": { key: "postPurchaseSettings", defaults: DEFAULT_POST_PURCHASE_SETTINGS },
    "thank-you": { key: "thankYouSettings", defaults: DEFAULT_THANK_YOU_SETTINGS },
  };
  const cfg = SETTINGS_BY_TYPE[type];

  let funnel = null;
  let settings = cfg.defaults;
  let dbError = false;
  try {
    funnel = await getFunnel(shop, params.id);
    if (funnel) funnel = { ...funnel, offers: funnel.offers.map(serializeOffer) };
    const store = await getStore(shop);
    settings = { ...cfg.defaults, ...(store?.[cfg.key] || {}) };
  } catch {
    dbError = true;
  }

  if (!dbError && !funnel) throw new Response("Not Found", { status: 404 });

  return { funnel, type, settings, dbError };
};

const FUNNEL_FIELDS = [
  "name", "status", "triggerType", "triggerValue",
  "priority", "rolloutPercentage", "abTestEnabled", "variantBSplit",
];

function coerceFunnelData(raw) {
  const data = {};
  for (const key of FUNNEL_FIELDS) {
    if (!(key in raw)) continue;
    if (["priority", "rolloutPercentage", "variantBSplit"].includes(key)) {
      const n = parseInt(raw[key], 10);
      if (Number.isFinite(n)) data[key] = n;
    } else if (key === "abTestEnabled") {
      data[key] = Boolean(raw[key]);
    } else {
      data[key] = raw[key];
    }
  }
  return data;
}

export const action = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  validateType(params.type);
  const funnelId = params.id;
  const form = await request.formData();
  const intent = form.get("intent");

  try {
    if (intent === "update-funnel") {
      const raw = JSON.parse(form.get("data") || "{}");
      const updated = await updateFunnel(shop, funnelId, coerceFunnelData(raw));
      return updated ? { ok: true, message: "Funnel saved" } : { ok: false, error: "Funnel not found" };
    }
    if (intent === "update-settings") {
      const blob = JSON.parse(form.get("data") || "{}");
      // Which Store settings column to write. Defaults to prePurchaseSettings so
      // the pre-purchase Design tab (which sends no key) keeps working.
      const key = form.get("settingsKey")?.toString() || "prePurchaseSettings";
      const allowed = ["prePurchaseSettings", "postPurchaseSettings", "thankYouSettings"];
      if (!allowed.includes(key)) return { ok: false, error: "Invalid settings key" };
      await updateStore(shop, { [key]: blob });
      return { ok: true, message: "Settings saved" };
    }
    if (intent === "create-offer") {
      // Base fields + optional product details (post-purchase tree passes a
      // picked product's headline/image/price/traffic split straight in).
      const data = {
        type: form.get("offerType")?.toString() || "upsell",
        section: form.get("section")?.toString() || "product-page",
      };
      const headline = form.get("headline");
      if (headline) data.headline = headline.toString();
      const imageUrl = form.get("imageUrl");
      if (imageUrl) data.imageUrl = imageUrl.toString();
      const productId = form.get("productId");
      if (productId) data.productId = productId.toString();
      const price = form.get("price");
      if (price != null && price !== "") data.price = Number(price);
      const compareAtPrice = form.get("compareAtPrice");
      if (compareAtPrice != null && compareAtPrice !== "") data.compareAtPrice = Number(compareAtPrice);
      const trafficSplit = form.get("trafficSplit");
      if (trafficSplit != null && trafficSplit !== "") {
        const n = parseInt(trafficSplit, 10);
        if (Number.isFinite(n)) data.trafficSplit = n;
      }
      const offer = await createOffer(shop, funnelId, data);
      return offer ? { ok: true, message: "Offer created" } : { ok: false, error: "Funnel not found" };
    }
    if (intent === "create-offers") {
      // Bulk-create offers from picked products (thank-you product-recs add).
      const products = JSON.parse(form.get("products") || "[]");
      const section = form.get("section")?.toString() || "thank-you-upsell";
      let created = 0;
      for (const p of products) {
        const data = { type: "upsell", section };
        if (p.title) data.headline = p.title;
        if (p.image) data.imageUrl = p.image;
        if (p.id) data.productId = p.id;
        if (p.price != null) data.price = Number(p.price);
        if (p.compareAtPrice != null) data.compareAtPrice = Number(p.compareAtPrice);
        const offer = await createOffer(shop, funnelId, data);
        if (offer) created += 1;
      }
      return created > 0
        ? { ok: true, message: `${created} product${created > 1 ? "s" : ""} added` }
        : { ok: false, error: "Funnel not found" };
    }
    if (intent === "update-offer") {
      const offerId = form.get("offerId")?.toString();
      const patch = JSON.parse(form.get("data") || "{}");
      const updated = await updateOffer(shop, offerId, patch);
      return updated ? { ok: true, message: "Offer saved" } : { ok: false, error: "Offer not found" };
    }
    if (intent === "delete-offer") {
      const offerId = form.get("offerId")?.toString();
      const ok = await deleteOffer(shop, offerId);
      return ok ? { ok: true, message: "Offer deleted" } : { ok: false, error: "Offer not found" };
    }
    return { ok: false, error: "Unknown action" };
  } catch (error) {
    return { ok: false, error: error?.message || "Operation failed" };
  }
};

/* ─── Offer card + flow section ─────────────────────────────── */
function FlowSection({ section, offers, onAddOffer, onEditOffer, onDeleteOffer }) {
  const Icon = section.icon;
  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-muted p-2 mt-0.5">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-sm">{section.title}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
            </div>
          </div>
          <Info className="h-4 w-4 text-muted-foreground" />
        </div>

        {offers.length > 0 && (
          <div className="space-y-2">
            {offers.map((offer) => (
              <div
                key={offer.id}
                className="rounded-lg border bg-card p-3 flex items-center gap-3 hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => onEditOffer(offer.id)}
              >
                <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center shrink-0">
                  {offer.imageUrl ? (
                    <img src={offer.imageUrl} alt="" className="h-full w-full object-cover rounded-md" />
                  ) : (
                    <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{offer.headline}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <Badge variant="outline" className="text-[10px] capitalize px-1.5 py-0">
                      {offer.type}
                    </Badge>
                    {offer.discountValue ? (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {offer.discountType === "percentage"
                          ? `${offer.discountValue}% off`
                          : `$${offer.discountValue} off`}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-4 text-[11px] text-muted-foreground">
                  <div className="text-center">
                    <p className="font-medium text-foreground">{offer.impressions.toLocaleString()}</p>
                    <p>Views</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-foreground">
                      {offer.impressions > 0 ? ((offer.conversions / offer.impressions) * 100).toFixed(1) : "0"}%
                    </p>
                    <p>Conv.</p>
                  </div>
                  <div className="text-center">
                    <p className="font-medium text-foreground">${offer.revenue.toFixed(2)}</p>
                    <p>Revenue</p>
                  </div>
                </div>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditOffer(offer.id)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => onDeleteOffer(offer.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button variant="outline" size="sm" onClick={() => onAddOffer(section.key)}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Add Upsell Offer
        </Button>
      </CardContent>
    </Card>
  );
}

/* ─── "Coming soon" for non pre-purchase types (built in 3D-2 / 3D-3) ─── */
function ComingSoon({ type, onBack }) {
  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Back
      </Button>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20 gap-2 text-center">
          <p className="font-semibold text-foreground capitalize">{type.replace("-", " ")} editor</p>
          <p className="text-sm text-muted-foreground">Coming soon.</p>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Main editor ──────────────────────────────────────────── */
export default function FunnelEditor() {
  const { funnel, type, settings, dbError } = useLoaderData();
  const navigate = useNavigate();
  const saveFetcher = useFetcher();
  const offerFetcher = useFetcher();

  const [name, setName] = useState(funnel?.name ?? "");
  const [triggerType, setTriggerType] = useState(funnel?.triggerType ?? "all-products");
  const [triggerValue, setTriggerValue] = useState(funnel?.triggerValue ?? "");
  // Selected trigger items as {id,title}. Pre-saved ids load with the id as a
  // placeholder title until re-selected (no catalog lookup on load).
  const [triggerItems, setTriggerItems] = useState(
    funnel?.triggerValue
      ? funnel.triggerValue.split(",").filter(Boolean).map((id) => ({ id, title: id }))
      : [],
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [status, setStatus] = useState(funnel?.status ?? "draft");
  const [design, setDesign] = useState(settings);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSection, setCreateSection] = useState("product-page");
  const [createType, setCreateType] = useState("upsell");

  useEffect(() => {
    const data = saveFetcher.data || offerFetcher.data;
    if (!data) return;
    if (data.ok) toast.success(data.message || "Saved");
    else if (data.error) toast.error(data.error);
  }, [saveFetcher.data, offerFetcher.data]);

  if (dbError) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardContent className="py-16 text-center space-y-1">
            <p className="font-semibold text-foreground">Editor unavailable</p>
            <p className="text-sm text-muted-foreground">
              The funnel tables aren’t available yet (pending database migration).
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (type === "post-purchase") {
    return <PostPurchaseEditor funnel={funnel} />;
  }

  if (type === "thank-you") {
    return <ThankYouEditor funnel={funnel} settings={settings} />;
  }

  if (type !== "pre-purchase") {
    return <ComingSoon type={type} onBack={() => navigate(`/app/funnels/${type}`)} />;
  }

  const busy = saveFetcher.state !== "idle";

  const saveTriggers = () => {
    saveFetcher.submit(
      {
        intent: "update-funnel",
        data: JSON.stringify({ name, triggerType, triggerValue }),
      },
      { method: "post" },
    );
  };

  const saveDesign = () => {
    saveFetcher.submit(
      { intent: "update-settings", data: JSON.stringify(design) },
      { method: "post" },
    );
  };

  const togglePublish = () => {
    const next = status === "active" ? "draft" : "active";
    setStatus(next);
    saveFetcher.submit(
      { intent: "update-funnel", data: JSON.stringify({ status: next }) },
      { method: "post" },
    );
  };

  const addOffer = () => {
    offerFetcher.submit(
      { intent: "create-offer", offerType: createType, section: createSection },
      { method: "post" },
    );
    setCreateOpen(false);
  };

  const editOffer = (offerId) => navigate(`/app/funnels/${type}/${funnel.id}/offer/${offerId}`);
  const removeOffer = (offerId) =>
    offerFetcher.submit({ intent: "delete-offer", offerId }, { method: "post" });

  const setPopup = (k, v) => setDesign((d) => ({ ...d, popup: { ...d.popup, [k]: v } }));
  const setTimer = (k, v) => setDesign((d) => ({ ...d, timer: { ...d.timer, [k]: v } }));
  const setTriggersCfg = (k, v) => setDesign((d) => ({ ...d, triggers: { ...d.triggers, [k]: v } }));

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/app/funnels/${type}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-lg font-bold border-none shadow-none px-0 h-auto focus-visible:ring-0 max-w-[260px]"
          />
          <Badge variant={status === "active" ? "default" : "secondary"} className="capitalize">
            {status === "active" ? "Published" : status}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={togglePublish} disabled={busy}>
            {status === "active" ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="triggers">
        <TabsList>
          <TabsTrigger value="triggers">Triggers</TabsTrigger>
          <TabsTrigger value="offers">Offers</TabsTrigger>
          <TabsTrigger value="design">Design</TabsTrigger>
        </TabsList>

        {/* ── Triggers ── */}
        <TabsContent value="triggers" className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-muted p-2 mt-0.5">
                  <Filter className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground text-sm">Triggers</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Offers from this funnel will show when the trigger condition below is met.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <Select value={triggerType} onValueChange={setTriggerType}>
                      <SelectTrigger className="w-[180px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all-products">Any product</SelectItem>
                        <SelectItem value="specific-products">Specific products</SelectItem>
                        <SelectItem value="specific-collections">Specific collections</SelectItem>
                        <SelectItem value="items-quantity">Items quantity</SelectItem>
                        <SelectItem value="total-value">Total value</SelectItem>
                        <SelectItem value="customer-tag">Customer tag</SelectItem>
                      </SelectContent>
                    </Select>

                    {(triggerType === "specific-products" || triggerType === "specific-collections") && (
                      <>
                        <SelectedProductsDisplay
                          selected={triggerItems}
                          onRemove={(id) => {
                            const next = triggerItems.filter((i) => i.id !== id);
                            setTriggerItems(next);
                            setTriggerValue(next.map((i) => i.id).join(","));
                          }}
                          onBrowse={() => setPickerOpen(true)}
                          placeholder={triggerType === "specific-products" ? "Browse products..." : "Browse collections..."}
                        />
                        <ShopifyProductPicker
                          open={pickerOpen}
                          onOpenChange={setPickerOpen}
                          mode={triggerType === "specific-products" ? "product" : "collection"}
                          selected={triggerItems.map((i) => i.id)}
                          onSelect={(items) => {
                            const picked = items.map((i) => ({ id: i.id, title: i.title }));
                            setTriggerItems(picked);
                            setTriggerValue(picked.map((i) => i.id).join(","));
                          }}
                        />
                      </>
                    )}

                    {triggerType !== "all-products" &&
                      triggerType !== "specific-products" &&
                      triggerType !== "specific-collections" && (
                        <Input
                          placeholder="Enter value..."
                          className="h-9 max-w-[200px]"
                          value={triggerValue || ""}
                          onChange={(e) => setTriggerValue(e.target.value)}
                        />
                      )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button onClick={saveTriggers} disabled={busy}>
              <Save className="h-4 w-4 mr-2" />
              {busy ? "Saving..." : "Save"}
            </Button>
          </div>
        </TabsContent>

        {/* ── Offers ── */}
        <TabsContent value="offers" className="space-y-4">
          {PRE_PURCHASE_SECTIONS.map((section) => (
            <FlowSection
              key={section.key}
              section={section}
              offers={(funnel.offers || []).filter((o) => o.section === section.key)}
              onAddOffer={(sectionKey) => {
                setCreateSection(sectionKey);
                setCreateType("upsell");
                setCreateOpen(true);
              }}
              onEditOffer={editOffer}
              onDeleteOffer={removeOffer}
            />
          ))}
        </TabsContent>

        {/* ── Design ── (saved into Store.prePurchaseSettings) */}
        <TabsContent value="design" className="space-y-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <h3 className="font-semibold text-sm">Popup</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Cart widget heading</Label>
                  <Input
                    value={design.cart_widget?.heading ?? ""}
                    onChange={(e) =>
                      setDesign((d) => ({ ...d, cart_widget: { ...d.cart_widget, heading: e.target.value } }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Position</Label>
                  <Select value={design.popup?.position} onValueChange={(v) => setPopup("position", v)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="center">Center</SelectItem>
                      <SelectItem value="top">Top</SelectItem>
                      <SelectItem value="bottom">Bottom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Background color</Label>
                  <Input value={design.popup?.bg_color ?? ""} onChange={(e) => setPopup("bg_color", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Text color</Label>
                  <Input value={design.popup?.text_color ?? ""} onChange={(e) => setPopup("text_color", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Corner radius</Label>
                  <Input
                    type="number"
                    value={design.popup?.border_radius ?? 0}
                    onChange={(e) => setPopup("border_radius", Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Max width (px)</Label>
                  <Input
                    type="number"
                    value={design.popup?.max_width ?? 0}
                    onChange={(e) => setPopup("max_width", Number(e.target.value))}
                  />
                </div>
              </div>

              <div className="border-t pt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-sm">Countdown timer</h3>
                    <p className="text-xs text-muted-foreground">Show an urgency timer in the popup.</p>
                  </div>
                  <Switch
                    checked={!!design.timer?.enabled}
                    onCheckedChange={(v) => setTimer("enabled", v)}
                  />
                </div>
                {design.timer?.enabled && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Duration (minutes)</Label>
                      <Input
                        type="number"
                        value={design.timer?.duration_minutes ?? 0}
                        onChange={(e) => setTimer("duration_minutes", Number(e.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Message</Label>
                      <Input value={design.timer?.message ?? ""} onChange={(e) => setTimer("message", e.target.value)} />
                    </div>
                  </div>
                )}
              </div>

              <div className="border-t pt-4 space-y-4">
                <h3 className="font-semibold text-sm">Frequency capping</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Show at most (times)</Label>
                    <Input
                      type="number"
                      value={design.triggers?.frequency_cap ?? 0}
                      onChange={(e) => setTriggersCfg("frequency_cap", Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Per window (hours)</Label>
                    <Input
                      type="number"
                      value={design.triggers?.frequency_window_hours ?? 0}
                      onChange={(e) => setTriggersCfg("frequency_window_hours", Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-end">
            <Button onClick={saveDesign} disabled={busy}>
              <Save className="h-4 w-4 mr-2" />
              {busy ? "Saving..." : "Save Design"}
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Offer dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Offer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {[
              { value: "upsell", label: "Upsell", desc: "Offer a higher-value product" },
              { value: "cross-sell", label: "Cross-sell", desc: "Suggest complementary products" },
              { value: "downsell", label: "Downsell", desc: "Offer a lower-price alternative" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setCreateType(opt.value)}
                className={`w-full text-left rounded-lg border p-3 transition-colors ${
                  createType === opt.value ? "border-primary bg-primary/5" : "hover:bg-muted"
                }`}
              >
                <p className="text-sm font-medium">{opt.label}</p>
                <p className="text-xs text-muted-foreground">{opt.desc}</p>
              </button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={addOffer}>Continue</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
