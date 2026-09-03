// Local presentational helpers take plain props; this project doesn't use the
// prop-types runtime checker, so disable that rule for this file.
/* eslint-disable react/prop-types */
import { useState, useEffect } from "react";
import { useLoaderData, useNavigate, useFetcher } from "react-router";
import { toast } from "sonner";
import { authenticate } from "../shopify.server";
import { getOffer, updateOffer } from "../models/funnel-offer.server";
import { getFunnel } from "../models/funnel.server";
import { FONT_OPTIONS } from "../lib/popup-options";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import { ShopifyProductPicker } from "@/components/ShopifyProductPicker";
import { OfferPreview, DEVICES } from "@/components/offer-preview";
import { PostPurchasePreview } from "@/components/post-purchase-preview";
import {
  ArrowLeft, Save, Package, Search, Monitor, Tablet, Smartphone,
  Heading1, TextCursorInput, Clock, ListChecks, DollarSign, MousePointerClick, Eye, Paintbrush,
  Award, Sparkles, ShieldCheck, Video, LayoutList, Receipt, Plus, Trash2, ArrowUp, ArrowDown,
} from "lucide-react";

const VALID_TYPES = ["pre-purchase", "post-purchase", "thank-you"];
const DEVICE_ICONS = { desktop: Monitor, tablet: Tablet, mobile: Smartphone };

// Prisma Decimal → plain numbers for the loader boundary + controlled inputs.
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

// Apply the old popup editor's defaults where an Offer column is null, so the
// controls + preview are stable and a save persists concrete values.
function normalizeOffer(o) {
  return {
    ...o,
    headline: o.headline ?? "",
    headlineEnabled: o.headlineEnabled ?? true,
    subheadlineEnabled: o.subheadlineEnabled ?? true,
    subheadlineText: o.subheadlineText ?? "A special one-time offer, just for you.",
    descriptionEnabled: o.descriptionEnabled ?? true,
    description: o.description ?? "",
    timerEnabled: o.timerEnabled ?? false,
    timerDuration: o.timerDuration ?? 10,
    timerBackgroundColor: o.timerBackgroundColor ?? "#F8C9C9",
    imageSize: o.imageSize ?? "medium",
    imageFit: o.imageFit ?? "cover",
    imageBorder: o.imageBorder ?? true,
    autoselectVariant: o.autoselectVariant ?? true,
    hideQuantitySelector: o.hideQuantitySelector ?? true,
    predefinedQuantity: o.predefinedQuantity ?? 1,
    discountType: o.discountType ?? "none",
    discountValue: o.discountValue ?? "",
    showCompareAt: o.showCompareAt ?? true,
    showSavings: o.showSavings ?? true,
    buttonText: o.buttonText ?? "Add to my order",
    buttonColor: o.buttonColor ?? "#EF6E7B",
    acceptButtonHoverColor: o.acceptButtonHoverColor ?? "#C85A66",
    declineText: o.declineText ?? "No thanks",
    declineButtonColor: o.declineButtonColor ?? "#6D7175",
    declineButtonHoverColor: o.declineButtonHoverColor ?? "#55585B",
    closeButtonBehavior: o.closeButtonBehavior ?? "decline",
    hideIfInCart: o.hideIfInCart ?? true,
    allowSubscription: o.allowSubscription ?? false,
    hideIfCartHasSubscription: o.hideIfCartHasSubscription ?? false,
    inheritStoreFont: o.inheritStoreFont ?? false,
    fontFamily: o.fontFamily ?? "system",
    textColor: o.textColor ?? "#1A1A2E",
    backgroundColor: o.backgroundColor ?? "#FFFFFF",
    selectorsColor: o.selectorsColor ?? "#1A1A1A",
    elementsColor: o.elementsColor ?? "#E1E1E1",
    themeVariant: o.themeVariant ?? "classic",
    layout: o.layout ?? "media-left",
    cornerRadius: o.cornerRadius ?? 14,
    // --- OCU post-purchase fields ---
    badgeEnabled: o.badgeEnabled ?? false,
    badgeText: o.badgeText ?? "Bestseller",
    buttonsPosition: o.buttonsPosition ?? "stacked",
    uspEnabled: o.uspEnabled ?? false,
    uspItems: Array.isArray(o.uspItems) ? o.uspItems : [],
    trustBadgesEnabled: o.trustBadgesEnabled ?? false,
    trustBadgeImages: Array.isArray(o.trustBadgeImages) ? o.trustBadgeImages : [],
    showMoneySummary: o.showMoneySummary ?? false,
    videoEnabled: o.videoEnabled ?? false,
    videoThumbnailUrl: o.videoThumbnailUrl ?? "",
    videoLinkUrl: o.videoLinkUrl ?? "",
    contentBlocks: Array.isArray(o.contentBlocks) ? o.contentBlocks : [],
  };
}

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const { type, id, offerId } = params;
  if (!VALID_TYPES.includes(type)) throw new Response("Not Found", { status: 404 });

  let offer = null;
  let funnel = null;
  let dbError = false;
  try {
    offer = await getOffer(shop, offerId);
    if (offer) offer = serializeOffer(offer);
    const f = await getFunnel(shop, id);
    if (f) funnel = { id: f.id, name: f.name, type: f.type };
  } catch {
    dbError = true;
  }
  if (!dbError && (!offer || !funnel || offer.funnelId !== funnel.id)) {
    throw new Response("Not Found", { status: 404 });
  }
  return { offer, funnel, type, dbError };
};

const STR_FIELDS = [
  "headline", "subheadlineText", "description", "buttonText", "declineText",
  "productId", "variantId", "productTitle", "imageUrl", "discountType", "layout",
  "timerMessage", "timerBackgroundColor", "buttonColor", "buttonTextColor",
  "textColor", "backgroundColor", "acceptButtonHoverColor", "declineButtonColor",
  "declineButtonHoverColor", "closeButtonBehavior", "fontFamily", "selectorsColor",
  "elementsColor", "themeVariant", "imageFit", "imageSize", "badgeText", "badgeColor",
  "variantBHeadline", "variantBDescription", "variantBButtonText",
  // OCU post-purchase
  "buttonsPosition", "videoThumbnailUrl", "videoLinkUrl",
];
const NUM_FIELDS = ["price", "compareAtPrice", "discountValue"];
const INT_FIELDS = ["timerDuration", "cornerRadius", "predefinedQuantity", "trafficSplit"];
const BOOL_FIELDS = [
  "timerEnabled", "headlineEnabled", "subheadlineEnabled", "descriptionEnabled",
  "imageBorder", "autoselectVariant", "hideQuantitySelector", "showCompareAt",
  "showSavings", "hideIfInCart", "allowSubscription", "hideIfCartHasSubscription",
  "inheritStoreFont", "badgeEnabled",
  // OCU post-purchase
  "uspEnabled", "trustBadgesEnabled", "showMoneySummary", "videoEnabled",
];
// Prisma Json columns — pass arrays through as-is, else null.
const JSON_FIELDS = ["uspItems", "trustBadgeImages", "contentBlocks"];

function coerceOffer(raw) {
  const data = {};
  for (const k of STR_FIELDS) if (k in raw) data[k] = raw[k] == null ? null : String(raw[k]);
  for (const k of NUM_FIELDS) {
    if (!(k in raw)) continue;
    if (raw[k] === null || raw[k] === "") data[k] = null;
    else {
      const n = Number(raw[k]);
      if (Number.isFinite(n)) data[k] = n;
    }
  }
  for (const k of INT_FIELDS) {
    if (!(k in raw)) continue;
    if (raw[k] === null || raw[k] === "") data[k] = null;
    else {
      const n = parseInt(raw[k], 10);
      if (Number.isFinite(n)) data[k] = n;
    }
  }
  for (const k of BOOL_FIELDS) if (k in raw) data[k] = Boolean(raw[k]);
  for (const k of JSON_FIELDS) if (k in raw) data[k] = Array.isArray(raw[k]) ? raw[k] : null;
  return data;
}

export const action = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const form = await request.formData();
  if (form.get("intent") !== "update-offer") return { ok: false, error: "Unknown action" };
  try {
    const raw = JSON.parse(form.get("data") || "{}");
    const updated = await updateOffer(shop, params.offerId, coerceOffer(raw));
    return updated ? { ok: true, message: "Offer saved" } : { ok: false, error: "Offer not found" };
  } catch (error) {
    return { ok: false, error: error?.message || "Save failed" };
  }
};

/* ─── shared little controls ─── */
function ColorField({ label, value, onChange }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2 mt-1">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 rounded border cursor-pointer"
          aria-label={label}
        />
        <Input value={value || ""} onChange={(e) => onChange(e.target.value)} className="h-9 flex-1 text-xs" />
      </div>
    </div>
  );
}

function SwitchRow({ label, checked, onChange, details }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <Label className="text-sm">{label}</Label>
        {details ? <p className="text-xs text-muted-foreground mt-0.5">{details}</p> : null}
      </div>
      <Switch checked={!!checked} onCheckedChange={onChange} />
    </div>
  );
}

function SectionItem({ value, icon: Icon, title, children }) {
  return (
    <AccordionItem value={value} className="border rounded-lg px-3">
      <AccordionTrigger className="text-sm font-medium">
        <span className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" /> {title}
        </span>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-3">{children}</div>
      </AccordionContent>
    </AccordionItem>
  );
}

/* ─── OCU list editors (post-purchase) ─── */
function StringListEditor({ items, onChange, placeholder, addLabel }) {
  const list = Array.isArray(items) ? items : [];
  const setAt = (i, v) => onChange(list.map((x, j) => (j === i ? v : x)));
  const remove = (i) => onChange(list.filter((_, j) => j !== i));
  return (
    <div className="space-y-2">
      {list.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input value={v} onChange={(e) => setAt(i, e.target.value)} placeholder={placeholder} className="h-9 text-xs" />
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => remove(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onChange([...list, ""])}>
        <Plus className="h-3.5 w-3.5 mr-1" />{addLabel}
      </Button>
    </div>
  );
}

function UspEditor({ items, onChange }) {
  const list = Array.isArray(items) ? items : [];
  const setAt = (i, patch) => onChange(list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const remove = (i) => onChange(list.filter((_, j) => j !== i));
  return (
    <div className="space-y-2">
      {list.map((it, i) => (
        <div key={i} className="rounded-md border p-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <Input value={it.text ?? ""} onChange={(e) => setAt(i, { text: e.target.value })} placeholder="Benefit text" className="h-9 text-xs" />
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => remove(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
          </div>
          <Input value={it.iconUrl ?? ""} onChange={(e) => setAt(i, { iconUrl: e.target.value || undefined })} placeholder="Icon image URL (optional)" className="h-8 text-xs" />
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => onChange([...list, { text: "" }])}>
        <Plus className="h-3.5 w-3.5 mr-1" />Add bullet
      </Button>
    </div>
  );
}

const BLOCK_TYPES = [
  { value: "heading", label: "Heading" },
  { value: "text", label: "Text" },
  { value: "divider", label: "Divider" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
];

function ContentBlocksEditor({ blocks, onChange }) {
  const list = Array.isArray(blocks) ? blocks : [];
  const commit = (next) => onChange(next.map((b, i) => ({ ...b, position: i })));
  const setAt = (i, patch) => commit(list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const remove = (i) => commit(list.filter((_, j) => j !== i));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };
  return (
    <div className="space-y-2">
      {list.map((b, i) => (
        <div key={i} className="rounded-md border p-2 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium capitalize">{b.type}</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => move(i, 1)} disabled={i === list.length - 1}><ArrowDown className="h-3.5 w-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => remove(i)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
          {(b.type === "heading" || b.type === "text") && (
            <Input value={b.text ?? ""} onChange={(e) => setAt(i, { text: e.target.value })} placeholder={b.type === "heading" ? "Heading text" : "Paragraph text"} className="h-8 text-xs" />
          )}
          {b.type === "image" && (
            <Input value={b.imageUrl ?? ""} onChange={(e) => setAt(i, { imageUrl: e.target.value })} placeholder="Image URL" className="h-8 text-xs" />
          )}
          {b.type === "video" && (
            <>
              <Input value={b.thumbnailUrl ?? ""} onChange={(e) => setAt(i, { thumbnailUrl: e.target.value })} placeholder="Thumbnail image URL" className="h-8 text-xs" />
              <Input value={b.linkUrl ?? ""} onChange={(e) => setAt(i, { linkUrl: e.target.value })} placeholder="Video link (opens external)" className="h-8 text-xs" />
            </>
          )}
        </div>
      ))}
      <div className="flex flex-wrap gap-1.5">
        {BLOCK_TYPES.map((t) => (
          <Button key={t.value} variant="outline" size="sm" className="h-8 text-xs" onClick={() => commit([...list, { type: t.value, position: list.length }])}>
            <Plus className="h-3 w-3 mr-1" />{t.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export default function OfferEditor() {
  const { offer, funnel, type, dbError } = useLoaderData();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [draft, setDraft] = useState(() => normalizeOffer(offer || {}));
  const [device, setDevice] = useState("desktop");
  const [pickerOpen, setPickerOpen] = useState(false);

  const busy = fetcher.state !== "idle";
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

  const save = () =>
    fetcher.submit({ intent: "update-offer", data: JSON.stringify(draft) }, { method: "post" });

  useEffect(() => {
    if (!fetcher.data) return;
    if (fetcher.data.ok) toast.success(fetcher.data.message || "Saved");
    else if (fetcher.data.error) toast.error(fetcher.data.error);
  }, [fetcher.data]);

  if (dbError) {
    return (
      <div className="max-w-3xl mx-auto">
        <Card>
          <CardContent className="py-16 text-center space-y-1">
            <p className="font-semibold text-foreground">Offer editor unavailable</p>
            <p className="text-sm text-muted-foreground">
              The funnel tables aren’t available yet (pending database migration).
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const backHref = `/app/funnels/${type}/${funnel.id}`;
  const hasProduct = !!draft.productId;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate(backHref)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-foreground truncate">Edit Offer</h1>
            <p className="text-xs text-muted-foreground capitalize">{draft.type} offer · {funnel.name}</p>
          </div>
        </div>
        <Button onClick={save} disabled={busy}>
          <Save className="h-4 w-4 mr-2" />
          {busy ? "Saving..." : "Save"}
        </Button>
      </div>

      {/* Split panel */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
        {/* LEFT: 9 sections in the old order */}
        <Accordion type="multiple" defaultValue={["headline", "product"]} className="space-y-2">
          {/* 1. Headline */}
          <SectionItem value="headline" icon={Heading1} title="Headline">
            <SwitchRow label="Show headline" checked={draft.headlineEnabled} onChange={(v) => set("headlineEnabled", v)} />
            <div>
              <Label className="text-xs">Headline</Label>
              <Input value={draft.headline} onChange={(e) => set("headline", e.target.value)} className="mt-1 h-9" />
            </div>
          </SectionItem>

          {/* 2. Sub-headline (popup only) */}
          {type !== "post-purchase" && (
            <SectionItem value="subheadline" icon={TextCursorInput} title="Sub-headline">
              <SwitchRow label="Show subheadline" checked={draft.subheadlineEnabled} onChange={(v) => set("subheadlineEnabled", v)} />
              <div>
                <Label className="text-xs">Subheadline</Label>
                <Input value={draft.subheadlineText} onChange={(e) => set("subheadlineText", e.target.value)} className="mt-1 h-9" />
              </div>
            </SectionItem>
          )}

          {/* 3. Timer Bar */}
          <SectionItem value="timer" icon={Clock} title="Timer Bar">
            <SwitchRow label="Show countdown timer" checked={draft.timerEnabled} onChange={(v) => set("timerEnabled", v)} />
            <div>
              <Label className="text-xs">Countdown length (minutes)</Label>
              <Input type="number" min="1" value={draft.timerDuration} onChange={(e) => set("timerDuration", e.target.value)} className="mt-1 h-9" />
            </div>
            <ColorField label="Timer background color" value={draft.timerBackgroundColor} onChange={(v) => set("timerBackgroundColor", v)} />
          </SectionItem>

          {/* 4. Product & Image */}
          <SectionItem value="product" icon={Package} title="Product & Image">
            {hasProduct ? (
              <div className="rounded-lg border p-3 flex items-center gap-3">
                <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                  {draft.imageUrl ? (
                    <img src={draft.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Package className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{draft.productTitle || "Selected product"}</p>
                  {draft.price != null && draft.price !== "" && (
                    <p className="text-xs text-muted-foreground">${Number(draft.price).toFixed(2)}</p>
                  )}
                </div>
                <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>Change</Button>
              </div>
            ) : (
              <Button variant="outline" className="w-full justify-start h-12 text-muted-foreground" onClick={() => setPickerOpen(true)}>
                <Search className="h-4 w-4 mr-2" /> Select a product...
              </Button>
            )}
            <div>
              <Label className="text-xs">Image size</Label>
              <Select value={draft.imageSize} onValueChange={(v) => set("imageSize", v)}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Image resizing</Label>
              <Select value={draft.imageFit} onValueChange={(v) => set("imageFit", v)}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cover">Fill (cover &amp; crop)</SelectItem>
                  <SelectItem value="contain">Fit (whole image)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <SwitchRow label="Image border" checked={draft.imageBorder} onChange={(v) => set("imageBorder", v)} />
            <SwitchRow label="Autoselect variant" checked={draft.autoselectVariant} onChange={(v) => set("autoselectVariant", v)} />
            <SwitchRow label="Hide quantity selector" checked={draft.hideQuantitySelector} onChange={(v) => set("hideQuantitySelector", v)} />
            <div>
              <Label className="text-xs">Predefined quantity</Label>
              <Input type="number" min="1" value={draft.predefinedQuantity} onChange={(e) => set("predefinedQuantity", e.target.value)} className="mt-1 h-9" />
            </div>
          </SectionItem>

          {/* 5. Product Details */}
          <SectionItem value="details" icon={ListChecks} title="Product Details">
            <SwitchRow label="Show description" checked={draft.descriptionEnabled} onChange={(v) => set("descriptionEnabled", v)} />
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea value={draft.description} onChange={(e) => set("description", e.target.value)} className="mt-1 min-h-[72px] resize-none" />
            </div>
          </SectionItem>

          {/* 6. Pricing */}
          <SectionItem value="pricing" icon={DollarSign} title="Pricing">
            <div>
              <Label className="text-xs">Discount</Label>
              <Select value={draft.discountType} onValueChange={(v) => set("discountType", v)}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No discount (use product price)</SelectItem>
                  <SelectItem value="percentage">Percentage off</SelectItem>
                  <SelectItem value="fixed">Fixed override price</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {draft.discountType !== "none" && (
              <div>
                <Label className="text-xs">{draft.discountType === "percentage" ? "Discount percentage" : "Override price"}</Label>
                <Input
                  type="number" min="0" {...(draft.discountType === "percentage" ? { max: "100" } : {})}
                  value={draft.discountValue ?? ""}
                  onChange={(e) => set("discountValue", e.target.value)}
                  className="mt-1 h-9"
                />
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              The discounted price is shown in the offer. The item is still added at its real price at checkout unless a matching Shopify discount is configured.
            </p>
            <SwitchRow label="Show compare-at (was) price" checked={draft.showCompareAt} onChange={(v) => set("showCompareAt", v)} />
            <SwitchRow label="Show savings amount" checked={draft.showSavings} onChange={(v) => set("showSavings", v)} />
          </SectionItem>

          {/* 7. Buttons */}
          <SectionItem value="buttons" icon={MousePointerClick} title="Buttons">
            <div>
              <Label className="text-xs">Accept button text</Label>
              <Input value={draft.buttonText} onChange={(e) => set("buttonText", e.target.value)} className="mt-1 h-9" />
            </div>
            <ColorField label="Accept button color" value={draft.buttonColor} onChange={(v) => set("buttonColor", v)} />
            <ColorField label="Accept button hover state" value={draft.acceptButtonHoverColor} onChange={(v) => set("acceptButtonHoverColor", v)} />
            <div className="border-t pt-3">
              <Label className="text-xs">Decline button text</Label>
              <Input value={draft.declineText} onChange={(e) => set("declineText", e.target.value)} className="mt-1 h-9" />
            </div>
            <ColorField label="Decline button color" value={draft.declineButtonColor} onChange={(v) => set("declineButtonColor", v)} />
            <ColorField label="Decline button hover state" value={draft.declineButtonHoverColor} onChange={(v) => set("declineButtonHoverColor", v)} />
            <div className="border-t pt-3">
              <Label className="text-xs">Close (X) button behavior</Label>
              <Select value={draft.closeButtonBehavior} onValueChange={(v) => set("closeButtonBehavior", v)}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="decline">Same as Decline (dismiss offer)</SelectItem>
                  <SelectItem value="close">Just close the popup</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </SectionItem>

          {/* ── Post-purchase (OCU) sections — only for post-purchase offers ── */}
          {type === "post-purchase" && (
            <>
              <SectionItem value="pp-badge" icon={Award} title="Badge">
                <SwitchRow label="Show badge" checked={draft.badgeEnabled} onChange={(v) => set("badgeEnabled", v)} />
                <div>
                  <Label className="text-xs">Badge text</Label>
                  <Input value={draft.badgeText} onChange={(e) => set("badgeText", e.target.value)} className="mt-1 h-9" />
                  <p className="text-xs text-muted-foreground mt-1">Renders as bold text (post-purchase color is theme-controlled).</p>
                </div>
              </SectionItem>

              <SectionItem value="pp-buttons" icon={MousePointerClick} title="Buttons layout">
                <div>
                  <Label className="text-xs">Buttons position</Label>
                  <Select value={draft.buttonsPosition} onValueChange={(v) => set("buttonsPosition", v)}>
                    <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stacked">Accept above decline (stacked)</SelectItem>
                      <SelectItem value="side-by-side">Accept beside decline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </SectionItem>

              <SectionItem value="pp-money" icon={Receipt} title="Money summary">
                <SwitchRow label="Show subtotal / total lines" checked={draft.showMoneySummary} onChange={(v) => set("showMoneySummary", v)} details="Shows the calculated subtotal and total on the offer." />
              </SectionItem>

              <SectionItem value="pp-usp" icon={Sparkles} title="USP / benefit bullets">
                <SwitchRow label="Show USP bullets" checked={draft.uspEnabled} onChange={(v) => set("uspEnabled", v)} />
                <UspEditor items={draft.uspItems} onChange={(v) => set("uspItems", v)} />
              </SectionItem>

              <SectionItem value="pp-trust" icon={ShieldCheck} title="Trust badges">
                <SwitchRow label="Show trust badges" checked={draft.trustBadgesEnabled} onChange={(v) => set("trustBadgesEnabled", v)} />
                <StringListEditor items={draft.trustBadgeImages} onChange={(v) => set("trustBadgeImages", v)} placeholder="Badge image URL" addLabel="Add image" />
              </SectionItem>

              <SectionItem value="pp-video" icon={Video} title="Video (thumbnail)">
                <SwitchRow label="Show video block" checked={draft.videoEnabled} onChange={(v) => set("videoEnabled", v)} details="A thumbnail image linking to the video (no inline player in post-purchase)." />
                <div>
                  <Label className="text-xs">Thumbnail image URL</Label>
                  <Input value={draft.videoThumbnailUrl} onChange={(e) => set("videoThumbnailUrl", e.target.value)} className="mt-1 h-9 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Video link URL</Label>
                  <Input value={draft.videoLinkUrl} onChange={(e) => set("videoLinkUrl", e.target.value)} className="mt-1 h-9 text-xs" />
                </div>
              </SectionItem>

              <SectionItem value="pp-blocks" icon={LayoutList} title="Content blocks">
                <p className="text-xs text-muted-foreground">Ordered blocks shown below the offer (heading, text, divider, image, video thumbnail).</p>
                <ContentBlocksEditor blocks={draft.contentBlocks} onChange={(v) => set("contentBlocks", v)} />
              </SectionItem>
            </>
          )}

          {/* 8. Display Offer (popup only) */}
          {type !== "post-purchase" && (
            <SectionItem value="display" icon={Eye} title="Display Offer">
              <SwitchRow label="Hide offer if the cart already contains the upsell product" checked={draft.hideIfInCart} onChange={(v) => set("hideIfInCart", v)} />
              <SwitchRow label="Allow subscription option" checked={draft.allowSubscription} onChange={(v) => set("allowSubscription", v)} details="Stored for a future subscription purchase flow." />
              <SwitchRow label="Hide offer if the cart has subscription products" checked={draft.hideIfCartHasSubscription} onChange={(v) => set("hideIfCartHasSubscription", v)} />
              <div className="border-t pt-3">
                <p className="text-sm font-semibold">Trigger</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Shown when the buyer clicks Checkout in the cart. (Product-page triggers are out of scope for now.)
                </p>
              </div>
            </SectionItem>
          )}

          {/* 9. General (popup only) */}
          {type !== "post-purchase" && (
          <SectionItem value="general" icon={Paintbrush} title="General">
            <SwitchRow label="Inherit store font" checked={draft.inheritStoreFont} onChange={(v) => set("inheritStoreFont", v)} details="Use the theme's font instead of the one below." />
            <div>
              <Label className="text-xs">Font family</Label>
              <Select value={draft.fontFamily} onValueChange={(v) => set("fontFamily", v)}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <ColorField label="Font color" value={draft.textColor} onChange={(v) => set("textColor", v)} />
            <ColorField label="Background color" value={draft.backgroundColor} onChange={(v) => set("backgroundColor", v)} />
            <ColorField label="Selectors color" value={draft.selectorsColor} onChange={(v) => set("selectorsColor", v)} />
            <ColorField label="Elements color" value={draft.elementsColor} onChange={(v) => set("elementsColor", v)} />
            <div>
              <Label className="text-xs">Theme</Label>
              <Select value={draft.themeVariant} onValueChange={(v) => set("themeVariant", v)}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="classic">Classic (left-aligned)</SelectItem>
                  <SelectItem value="bold">Modern (centered)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Layout</Label>
              <Select value={draft.layout} onValueChange={(v) => set("layout", v)}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="media-left">Image left</SelectItem>
                  <SelectItem value="media-right">Image right</SelectItem>
                  <SelectItem value="media-top">Image on top</SelectItem>
                  <SelectItem value="text-only">Text only (no image)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Corner radius (px)</Label>
              <Input type="number" min="0" max="40" value={draft.cornerRadius} onChange={(e) => set("cornerRadius", e.target.value)} className="mt-1 h-9" />
            </div>
          </SectionItem>
          )}
        </Accordion>

        {/* RIGHT: sticky live preview + device toggle */}
        <div className="lg:sticky lg:top-4 self-start space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">{DEVICES.find((d) => d.id === device)?.label} preview</p>
            <div className="flex items-center gap-1">
              {DEVICES.map((d) => {
                const Icon = DEVICE_ICONS[d.id];
                return (
                  <Button
                    key={d.id}
                    variant={device === d.id ? "secondary" : "ghost"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setDevice(d.id)}
                    aria-label={`${d.label} preview`}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                );
              })}
            </div>
          </div>
          {type === "post-purchase" ? (
            <PostPurchasePreview offer={draft} device={device} />
          ) : (
            <OfferPreview offer={draft} device={device} />
          )}
        </div>
      </div>

      {/* Product picker (real products) */}
      <ShopifyProductPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        mode="product"
        multiple={false}
        selected={draft.productId ? [draft.productId] : []}
        onSelect={(items) => {
          const p = items[0];
          if (p) {
            setDraft((d) => ({
              ...d,
              productId: p.id,
              variantId: p.variants?.[0]?.id ?? null,
              productTitle: p.title,
              imageUrl: p.image,
              price: p.price,
              compareAtPrice: p.compareAtPrice ?? null,
            }));
          }
        }}
      />
    </div>
  );
}
