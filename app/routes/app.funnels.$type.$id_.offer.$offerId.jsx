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
import { Slider } from "@/components/ui/slider";
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
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { ShopifyProductPicker } from "@/components/ShopifyProductPicker";
import { OfferPreview, DEVICES } from "@/components/offer-preview";
import { PostPurchasePreview } from "@/components/post-purchase-preview";
import {
  ArrowLeft, Save, Package, Search, Monitor, Tablet, Smartphone,
  Heading1, TextCursorInput, Clock, ListChecks, DollarSign, MousePointerClick, Eye, Paintbrush,
  Video, LayoutList, Plus, Trash2, ArrowUp, ArrowDown,
  HelpCircle, Type, Image as ImageIcon, Minus, PanelLeft, PanelRight, AlignCenter,
  ShoppingCart, MoreVertical, GripVertical, Images, Sparkles, Megaphone,
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

// OCU editor cosmetics (preview-authoritative). Deep-defaulted so every control
// is stable and a save persists concrete values.
function withEditorDefaults(es) {
  const s = es && typeof es === "object" && !Array.isArray(es) ? es : {};
  const g = (k) => (s[k] && typeof s[k] === "object" ? s[k] : {});
  const d = g("displayOffer"), h = g("heading"), c = g("countdown"), p = g("product"), t = g("textVideo");
  const mb = g("messageBanner"), pb = g("promoBanner");
  return {
    previewType: s.previewType ?? "one_time_and_sub",
    productLayout: s.productLayout ?? "image_left", // image_left | image_top | banner
    messageBanner: {
      enabled: mb.enabled ?? false,
      text: mb.text ?? "It's not too late to add this to your order at a special discount!",
      bg: mb.bg ?? "#22C55E",
      textColor: mb.textColor ?? "#FFFFFF",
      showIcon: mb.showIcon ?? true,
      showTimer: mb.showTimer ?? true,
    },
    promoBanner: {
      enabled: pb.enabled ?? false,
      title: pb.title ?? "",
      description: pb.description ?? "",
      buttonText: pb.buttonText ?? "Learn More",
      buttonUrl: pb.buttonUrl ?? "",
      imageUrl: pb.imageUrl ?? "",
    },
    displayOffer: {
      hideIfSubscription: d.hideIfSubscription ?? false,
      allowSubscription: d.allowSubscription ?? true,
      subscriptionOnlyIfOneTime: d.subscriptionOnlyIfOneTime ?? false,
    },
    heading: { bg: h.bg ?? "", top: h.top ?? 40, bottom: h.bottom ?? 20 },
    countdown: { bg: c.bg ?? "", fullWidth: c.fullWidth ?? false, top: c.top ?? 50, bottom: c.bottom ?? 30 },
    product: {
      offerDescription: p.offerDescription ?? true,
      offerProduct: p.offerProduct ?? "same_variant",
      displayFor: p.displayFor ?? "random_in_cart",
      predefinedQtyEnabled: p.predefinedQtyEnabled ?? false,
      useIcon: p.useIcon ?? true,
      badgeColor: p.badgeColor ?? "#F4A460",
      badgePosition: p.badgePosition ?? "above_title",
      shipping: p.shipping ?? "free",
      hideShippingLine: p.hideShippingLine ?? true,
      hideSubtotalLine: p.hideSubtotalLine ?? false,
      hideTotalLine: p.hideTotalLine ?? false,
      paymentDisclaimer: p.paymentDisclaimer ?? false,
      top: p.top ?? 50, bottom: p.bottom ?? 40,
    },
    textVideo: {
      layout: t.layout ?? "center",
      playButtonLabel: t.playButtonLabel ?? "",
      hidePlayIcon: t.hidePlayIcon ?? false,
      headline: t.headline ?? true,
      backButtonLabel: t.backButtonLabel ?? "Back to Offer",
      autoplay: t.autoplay ?? true,
      bg: t.bg ?? "#000000",
      top: t.top ?? 50, bottom: t.bottom ?? 30,
    },
  };
}

// Apply the old popup editor's defaults where an Offer column is null, so the
// controls + preview are stable and a save persists concrete values.
function normalizeOffer(o, type) {
  const isPP = type === "post-purchase";
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
    buttonText: o.buttonText ?? (isPP ? "Complete Purchase • {{total}}" : "Add to my order"),
    buttonColor: o.buttonColor ?? "#EF6E7B",
    acceptButtonHoverColor: o.acceptButtonHoverColor ?? "#C85A66",
    declineText: o.declineText ?? (isPP ? "Decline this offer" : "No thanks"),
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
    showMoneySummary: o.showMoneySummary ?? (isPP ? true : false),
    videoEnabled: o.videoEnabled ?? false,
    videoThumbnailUrl: o.videoThumbnailUrl ?? "",
    videoLinkUrl: o.videoLinkUrl ?? "",
    contentBlocks: Array.isArray(o.contentBlocks) ? o.contentBlocks : [],
    editorSettings: withEditorDefaults(o.editorSettings),
  };
}

export const loader = async ({ request, params }) => {
  const { admin, session } = await authenticate.admin(request);
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

  // Real shop display name for the preview chrome (falls back to the domain slug).
  let storeName = shop.replace(/\.myshopify\.com$/, "");
  try {
    const res = await admin.graphql("{ shop { name } }");
    const j = await res.json();
    if (j?.data?.shop?.name) storeName = j.data.shop.name;
  } catch {
    // non-fatal — keep the slug fallback
  }

  return { offer, funnel, type, dbError, shop, storeName };
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
// Prisma Json columns — arrays pass through as-is, else null.
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
  // editorSettings: a plain object (OCU cosmetics)
  if ("editorSettings" in raw) {
    const es = raw.editorSettings;
    data.editorSettings = es && typeof es === "object" && !Array.isArray(es) ? es : null;
  }
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

function NewBadge() {
  return (
    <span className="ml-1.5 inline-flex items-center rounded-full bg-blue-500 px-2 py-0.5 text-[10px] font-semibold leading-none text-white">
      New
    </span>
  );
}

function Help({ text }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button type="button" className="text-muted-foreground/70 hover:text-muted-foreground" aria-label="Help">
            <HelpCircle className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-[220px] text-xs">{text}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function SwitchRow({ label, checked, onChange, details, isNew, help }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <Label className="text-sm">{label}</Label>
          {isNew ? <NewBadge /> : null}
          {help ? <Help text={help} /> : null}
        </div>
        {details ? <p className="text-xs text-muted-foreground mt-0.5">{details}</p> : null}
      </div>
      <Switch checked={!!checked} onCheckedChange={onChange} />
    </div>
  );
}

// 0–100 slider row (padding).
function Pad({ label, value, onChange }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Slider value={[Number(value) || 0]} min={0} max={100} step={1} onValueChange={([v]) => onChange(v)} className="mt-2" />
    </div>
  );
}

// Color swatch button (checkerboard when transparent) → popover picker.
function ColorSwatchRow({ label, value, onChange, help }) {
  const empty = !value;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-1">
        <Label className="text-xs">{label}</Label>
        {help ? <Help text={help} /> : null}
      </div>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={label}
            className="h-6 w-6 shrink-0 rounded border"
            style={
              empty
                ? {
                    backgroundImage:
                      "linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%)",
                    backgroundSize: "8px 8px",
                    backgroundPosition: "0 0,0 4px,4px -4px,-4px 0",
                  }
                : { background: value }
            }
          />
        </PopoverTrigger>
        <PopoverContent className="w-auto space-y-2 p-2">
          <input type="color" value={value || "#ffffff"} onChange={(e) => onChange(e.target.value)} className="h-8 w-40 cursor-pointer" />
          <Button variant="outline" size="sm" className="h-7 w-full text-xs" onClick={() => onChange("")}>Transparent</Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// Small segmented button group (S/M/L, Fit/Fill, layout icons).
function Seg({ label, options, value, onChange }) {
  return (
    <div>
      {label ? <Label className="text-xs">{label}</Label> : null}
      <div className={`${label ? "mt-1 " : ""}inline-flex rounded-md border p-0.5`}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`min-w-9 rounded px-3 py-1 text-xs font-medium transition-colors ${
              value === o.value ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
            }`}
            aria-pressed={value === o.value}
          >
            {o.icon ? <o.icon className="mx-auto h-4 w-4" /> : o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// Text input with a live "x/max" character counter.
function CountedInput({ label, value, onChange, max, placeholder, help }) {
  const v = value ?? "";
  return (
    <div>
      <div className="flex items-center gap-1">
        <Label className="text-xs">{label}</Label>
        {help ? <Help text={help} /> : null}
      </div>
      <div className="relative mt-1">
        <Input value={v} maxLength={max} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="h-9 pr-12 text-xs" />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{v.length}/{max}</span>
      </div>
    </div>
  );
}

function SectionItem({ value, icon: Icon, title, children, actions }) {
  return (
    <AccordionItem value={value} className="group border rounded-lg px-3">
      <AccordionTrigger className="text-sm font-medium">
        <span className="flex flex-1 items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" /> {title}
          {actions ? (
            // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
            <span className="ml-auto mr-2 flex items-center gap-2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
              {actions}
            </span>
          ) : null}
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
  { value: "text_image", label: "Text and image", icon: Images },
  { value: "text_video", label: "Text and video", icon: Images },
  { value: "heading", label: "Heading", icon: Heading1 },
  { value: "text", label: "Text", icon: Type },
  { value: "image", label: "Image", icon: ImageIcon },
  { value: "video", label: "Video", icon: Video, isNew: true },
  { value: "divider", label: "Divider", icon: Minus },
  { value: "countdown", label: "Countdown timer", icon: Clock },
  { value: "buybox", label: "Buy box", icon: ShoppingCart },
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
          {(b.type === "video" || b.type === "text_video") && (
            <>
              {b.type === "text_video" && (
                <Input value={b.text ?? ""} onChange={(e) => setAt(i, { text: e.target.value })} placeholder="Text" className="h-8 text-xs" />
              )}
              <Input value={b.thumbnailUrl ?? ""} onChange={(e) => setAt(i, { thumbnailUrl: e.target.value })} placeholder="Thumbnail image URL" className="h-8 text-xs" />
              <Input value={b.linkUrl ?? ""} onChange={(e) => setAt(i, { linkUrl: e.target.value })} placeholder="Video link (opens external)" className="h-8 text-xs" />
            </>
          )}
          {b.type === "text_image" && (
            <>
              <Input value={b.text ?? ""} onChange={(e) => setAt(i, { text: e.target.value })} placeholder="Text" className="h-8 text-xs" />
              <Input value={b.imageUrl ?? ""} onChange={(e) => setAt(i, { imageUrl: e.target.value })} placeholder="Image URL" className="h-8 text-xs" />
            </>
          )}
          {b.type === "countdown" && (
            <Input type="number" min="1" value={b.minutes ?? 10} onChange={(e) => setAt(i, { minutes: e.target.value })} placeholder="Minutes" className="h-8 text-xs" />
          )}
          {b.type === "buybox" && (
            <p className="text-[11px] text-muted-foreground">Repeats the accept button with the offer price.</p>
          )}
        </div>
      ))}
    </div>
  );
}

// "+ Add Content Block" popover menu (OCU parity).
function AddContentBlock({ blocks, onChange }) {
  const list = Array.isArray(blocks) ? blocks : [];
  const add = (type) => onChange([...list, { type, position: list.length }].map((b, i) => ({ ...b, position: i })));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full">
          <Plus className="mr-2 h-4 w-4" /> Add Content Block
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {BLOCK_TYPES.map((t) => (
          <DropdownMenuItem key={t.value} onSelect={() => add(t.value)} className="gap-2">
            <t.icon className="h-4 w-4 text-muted-foreground" />
            {t.label}
            {t.isNew ? <NewBadge /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ─── OCU post-purchase left panel ─── */
function OcuPanel({ draft, set, setES, setESRoot, hasProduct, openPicker }) {
  const es = draft.editorSettings;
  const imgSizeSeg = [
    { value: "small", label: "S" },
    { value: "medium", label: "M" },
    { value: "large", label: "L" },
  ];
  const fitVal = draft.imageFit === "cover" ? "fill" : "fit";
  return (
    <Accordion type="multiple" defaultValue={["pp-display", "pp-product"]} className="space-y-2">
      {/* 1. Display Offer */}
      <SectionItem value="pp-display" icon={Eye} title="Display Offer">
        <SwitchRow label="Hide offer if order has subscription products" checked={es.displayOffer.hideIfSubscription} onChange={(v) => setES("displayOffer", "hideIfSubscription", v)} help="Skip this offer when the original order already contains a subscription item." />
        <SwitchRow label="Allow subscription option" checked={es.displayOffer.allowSubscription} onChange={(v) => setES("displayOffer", "allowSubscription", v)} help="Offer a Subscribe & save choice alongside one-time purchase." />
        <SwitchRow label="Offer subscription only, if product initially purchased as a one-time" checked={es.displayOffer.subscriptionOnlyIfOneTime} onChange={(v) => setES("displayOffer", "subscriptionOnlyIfOneTime", v)} help="Show the subscription variant only when the initial purchase was one-time." />
        <div className="rounded-md bg-muted/60 p-2 text-xs text-muted-foreground">
          Your live post-purchase offers automatically inherit your Shopify checkout styles.{" "}
          <span className="text-blue-600">Configure preview settings</span> to better match this preview.
        </div>
      </SectionItem>

      {/* 1b. Message Banner (Kaching-style) */}
      <SectionItem value="pp-message" icon={Sparkles} title="Message Banner">
        <SwitchRow label="Enable Message Banner" checked={es.messageBanner.enabled} onChange={(v) => setES("messageBanner", "enabled", v)} />
        <CountedInput label="Banner Text" value={es.messageBanner.text} onChange={(v) => setES("messageBanner", "text", v)} max={120} placeholder="It's not too late to add this to your order…" />
        <ColorSwatchRow label="Background Color" value={es.messageBanner.bg} onChange={(v) => setES("messageBanner", "bg", v)} />
        <ColorSwatchRow label="Text Color" value={es.messageBanner.textColor} onChange={(v) => setES("messageBanner", "textColor", v)} />
        <SwitchRow label="Show Icon" checked={es.messageBanner.showIcon} onChange={(v) => setES("messageBanner", "showIcon", v)} help="Shows a 🔥 before the message text." />
        <SwitchRow label="Show Timer in Banner" checked={es.messageBanner.showTimer} onChange={(v) => setES("messageBanner", "showTimer", v)} help="Shows the countdown inline in the banner (uses the Countdown Timer duration)." />
      </SectionItem>

      {/* 2. Heading */}
      <SectionItem value="pp-heading" icon={Heading1} title="Heading">
        <SwitchRow label="Show heading" checked={draft.headlineEnabled} onChange={(v) => set("headlineEnabled", v)} />
        <div>
          <Label className="text-xs">Heading text</Label>
          <Input value={draft.headline} onChange={(e) => set("headline", e.target.value)} placeholder="Add {product} to your order" className="mt-1 h-9" />
        </div>
        <ColorSwatchRow label="Background Color" value={es.heading.bg} onChange={(v) => setES("heading", "bg", v)} />
        <Pad label="Top padding" value={es.heading.top} onChange={(v) => setES("heading", "top", v)} />
        <Pad label="Bottom padding" value={es.heading.bottom} onChange={(v) => setES("heading", "bottom", v)} />
      </SectionItem>

      {/* 3. Countdown Timer */}
      <SectionItem
        value="pp-timer"
        icon={Clock}
        title="Countdown Timer"
        actions={
          <>
            <Trash2 className="h-3.5 w-3.5 cursor-not-allowed opacity-50" />
            <Eye
              className={`h-3.5 w-3.5 cursor-pointer ${draft.timerEnabled ? "" : "opacity-40"}`}
              onClick={() => set("timerEnabled", !draft.timerEnabled)}
              role="button"
              aria-label="Toggle countdown timer"
            />
            <GripVertical className="h-3.5 w-3.5 cursor-grab" />
          </>
        }
      >
        <SwitchRow label="Show countdown timer" checked={draft.timerEnabled} onChange={(v) => set("timerEnabled", v)} />
        <ColorSwatchRow label="Background Color" value={es.countdown.bg} onChange={(v) => setES("countdown", "bg", v)} />
        <SwitchRow label="Full width" checked={es.countdown.fullWidth} onChange={(v) => setES("countdown", "fullWidth", v)} />
        <div>
          <Label className="text-xs">Time Limit</Label>
          <Select value={String(draft.timerDuration)} onValueChange={(v) => set("timerDuration", v)}>
            <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[5, 10, 15, 20, 30].map((m) => <SelectItem key={m} value={String(m)}>{m} minutes</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Pad label="Top padding" value={es.countdown.top} onChange={(v) => setES("countdown", "top", v)} />
        <Pad label="Bottom padding" value={es.countdown.bottom} onChange={(v) => setES("countdown", "bottom", v)} />
      </SectionItem>

      {/* 4. Upsell Product */}
      <SectionItem value="pp-product" icon={Package} title="Upsell Product">
        {/* Offer settings */}
        {hasProduct ? (
          <div className="rounded-lg border p-3 flex items-center gap-3">
            <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
              {draft.imageUrl ? <img src={draft.imageUrl} alt="" className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{draft.productTitle || "Selected product"}</p>
              {draft.price != null && draft.price !== "" && <p className="text-xs text-muted-foreground">${Number(draft.price).toFixed(2)}</p>}
            </div>
            <Button variant="outline" size="sm" onClick={openPicker}>Change</Button>
          </div>
        ) : (
          <Button variant="outline" className="w-full justify-start h-12 text-muted-foreground" onClick={openPicker}>
            <Search className="h-4 w-4 mr-2" /> Select a product...
          </Button>
        )}

        <SwitchRow label="Offer Description" checked={draft.descriptionEnabled} onChange={(v) => set("descriptionEnabled", v)} isNew />
        {draft.descriptionEnabled ? (
          <Textarea value={draft.description} onChange={(e) => set("description", e.target.value)} placeholder="Product description" className="min-h-[60px] resize-none text-xs" />
        ) : null}
        <div>
          <Label className="text-xs">Offer Product</Label>
          <Select value={es.product.offerProduct} onValueChange={(v) => setES("product", "offerProduct", v)}>
            <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="same_variant">Same Variant</SelectItem>
              <SelectItem value="specific_product">Specific product</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <div className="flex items-center gap-1">
            <Label className="text-xs">Display offer</Label>
            <Help text="Which cart product this upsell targets when it runs." />
          </div>
          <Select value={es.product.displayFor} onValueChange={(v) => setES("product", "displayFor", v)}>
            <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="random_in_cart">for random product in the cart</SelectItem>
              <SelectItem value="most_expensive">for most expensive product in the cart</SelectItem>
              <SelectItem value="cheapest">for cheapest product in the cart</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Image */}
        <div className="border-t pt-3 space-y-3">
          <Seg
            label="Product Layout"
            options={[
              { value: "image_left", icon: PanelLeft },
              { value: "image_top", icon: LayoutList },
              { value: "banner", icon: ImageIcon },
            ]}
            value={es.productLayout}
            onChange={(v) => setESRoot("productLayout", v)}
          />
          <Seg label="Image Size" options={imgSizeSeg} value={draft.imageSize} onChange={(v) => set("imageSize", v)} />
          <Seg label="Image Resizing" options={[{ value: "fit", label: "Fit" }, { value: "fill", label: "Fill" }]} value={fitVal} onChange={(v) => set("imageFit", v === "fill" ? "cover" : "contain")} />
          <SwitchRow label="Image Border" checked={draft.imageBorder} onChange={(v) => set("imageBorder", v)} />
        </div>

        {/* Badge */}
        <div className="border-t pt-3 space-y-3">
          <SwitchRow label="Badge" checked={draft.badgeEnabled} onChange={(v) => set("badgeEnabled", v)} />
          <div>
            <Label className="text-xs">Badge Label</Label>
            <Select value={draft.badgeText} onValueChange={(v) => set("badgeText", v)}>
              <SelectTrigger className="mt-1 h-9"><SelectValue placeholder="Bestseller" /></SelectTrigger>
              <SelectContent>
                {["Bestseller", "Best Value", "Most Popular", "Limited Offer"].map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SwitchRow label="Use Icon" checked={es.product.useIcon} onChange={(v) => setES("product", "useIcon", v)} help="Show a trophy icon before the badge text." />
          <ColorSwatchRow label="Badge Color" value={es.product.badgeColor} onChange={(v) => setES("product", "badgeColor", v)} />
          <div>
            <Label className="text-xs">Badge Position</Label>
            <Select value={es.product.badgePosition} onValueChange={(v) => setES("product", "badgePosition", v)}>
              <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="above_title">Above Product Title</SelectItem>
                <SelectItem value="under_title">Under Product Title</SelectItem>
                <SelectItem value="next_to_price">Next to Price</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Pricing & discount */}
        <div className="border-t pt-3 space-y-3">
          <div>
            <Label className="text-xs">Discount</Label>
            <Select value={draft.discountType === "fixed" ? "percentage" : draft.discountType} onValueChange={(v) => set("discountType", v)}>
              <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="percentage">Percentage</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {draft.discountType !== "none" && (
            <div>
              <Label className="text-xs">{draft.discountType === "percentage" ? "Discount percentage" : "Override price"}</Label>
              <Input type="number" min="0" {...(draft.discountType === "percentage" ? { max: "100" } : {})} value={draft.discountValue ?? ""} onChange={(e) => set("discountValue", e.target.value)} className="mt-1 h-9" />
            </div>
          )}
          <SwitchRow label="Compare-at Price" checked={draft.showCompareAt} onChange={(v) => set("showCompareAt", v)} isNew help="Show the original price struck through next to the offer price." />
        </div>

        {/* Shipping & money lines */}
        <div className="border-t pt-3 space-y-3">
          <div>
            <Label className="text-xs">Shipping</Label>
            <Select value={es.product.shipping} onValueChange={(v) => setES("product", "shipping", v)}>
              <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="free">Free Shipping</SelectItem>
                <SelectItem value="charge">Charge for Shipping</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {es.product.shipping === "free" ? (
            <SwitchRow label="Hide Shipping line for Free Shipping" checked={es.product.hideShippingLine} onChange={(v) => setES("product", "hideShippingLine", v)} />
          ) : null}
          <SwitchRow label="Hide Subtotal line" checked={es.product.hideSubtotalLine} onChange={(v) => setES("product", "hideSubtotalLine", v)} isNew />
          <SwitchRow label="Hide Total line" checked={es.product.hideTotalLine} onChange={(v) => setES("product", "hideTotalLine", v)} isNew />
        </div>

        {/* Quantity */}
        <div className="border-t pt-3 space-y-3">
          <SwitchRow label="Hide Quantity Selector" checked={draft.hideQuantitySelector} onChange={(v) => set("hideQuantitySelector", v)} />
          <SwitchRow label="Predefined Quantity" checked={es.product.predefinedQtyEnabled} onChange={(v) => setES("product", "predefinedQtyEnabled", v)} help="Add a fixed quantity of the upsell item instead of 1." />
          <Input type="number" min="1" value={draft.predefinedQuantity} onChange={(e) => set("predefinedQuantity", e.target.value)} disabled={!es.product.predefinedQtyEnabled} className="h-9" />
        </div>

        {/* Buttons */}
        <div className="border-t pt-3 space-y-3">
          <div>
            <Label className="text-xs">Buttons Position</Label>
            <Select value={draft.buttonsPosition} onValueChange={(v) => set("buttonsPosition", v)}>
              <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="stacked">Accept above decline</SelectItem>
                <SelectItem value="side-by-side">Accept beside decline</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <CountedInput label="CTA Text" value={draft.buttonText} onChange={(v) => set("buttonText", v)} max={40} placeholder="Complete Purchase • {{total}}" help="Use {{total}} to insert the offer price. Leave it out to show plain text." />
          <CountedInput label="Decline Text" value={draft.declineText} onChange={(v) => set("declineText", v)} max={40} placeholder="Decline this offer" />
          <SwitchRow label="Payment Disclaimer" checked={es.product.paymentDisclaimer} onChange={(v) => setES("product", "paymentDisclaimer", v)} />
        </div>

        {/* USP */}
        <div className="border-t pt-3 space-y-3">
          <SwitchRow label="USP Text" checked={draft.uspEnabled} onChange={(v) => set("uspEnabled", v)} />
          {draft.uspEnabled ? <UspEditor items={draft.uspItems} onChange={(v) => set("uspItems", v)} /> : null}
          <SwitchRow label="USP Image (trust badges)" checked={draft.trustBadgesEnabled} onChange={(v) => set("trustBadgesEnabled", v)} />
          {draft.trustBadgesEnabled ? <StringListEditor items={draft.trustBadgeImages} onChange={(v) => set("trustBadgeImages", v)} placeholder="Badge image URL" addLabel="Add image" /> : null}
        </div>

        <div className="border-t pt-3 space-y-3">
          <Pad label="Top padding" value={es.product.top} onChange={(v) => setES("product", "top", v)} />
          <Pad label="Bottom padding" value={es.product.bottom} onChange={(v) => setES("product", "bottom", v)} />
        </div>
      </SectionItem>

      {/* 5. Text And Video */}
      <SectionItem value="pp-textvideo" icon={Video} title="Text And Video">
        <Seg
          label="Layout"
          options={[
            { value: "left", icon: PanelLeft },
            { value: "center", icon: AlignCenter },
            { value: "right", icon: PanelRight },
          ]}
          value={es.textVideo.layout}
          onChange={(v) => setES("textVideo", "layout", v)}
        />
        <SwitchRow label="Show video block" checked={draft.videoEnabled} onChange={(v) => set("videoEnabled", v)} details="A thumbnail linking to the video (no inline player in post-purchase)." />
        <div>
          <div className="flex items-center gap-1">
            <Label className="text-xs">Video Source</Label>
            <Help text="Paste a YouTube/Vimeo link. On the live page it opens externally (no inline player in post-purchase)." />
          </div>
          <Input value={draft.videoLinkUrl} onChange={(e) => set("videoLinkUrl", e.target.value)} placeholder="https://youtube.com/watch?..." className="mt-1 h-9 text-xs" />
        </div>
        <div>
          <Label className="text-xs">Thumbnail</Label>
          <div className="mt-1 flex items-center gap-2">
            <div className="h-9 w-12 shrink-0 overflow-hidden rounded border bg-muted">
              {draft.videoThumbnailUrl ? <img src={draft.videoThumbnailUrl} alt="" className="h-full w-full object-cover" /> : null}
            </div>
            <Input value={draft.videoThumbnailUrl} onChange={(e) => set("videoThumbnailUrl", e.target.value)} placeholder="Thumbnail image URL" className="h-9 text-xs" />
          </div>
        </div>
        <CountedInput label="Play Button label" value={es.textVideo.playButtonLabel} onChange={(v) => setES("textVideo", "playButtonLabel", v)} max={25} placeholder="Watch video" help="Text shown under the play button on the thumbnail." />
        <SwitchRow label="Hide Play icon" checked={es.textVideo.hidePlayIcon} onChange={(v) => setES("textVideo", "hidePlayIcon", v)} />
        <SwitchRow label="Headline" checked={es.textVideo.headline} onChange={(v) => setES("textVideo", "headline", v)} />
        <CountedInput label="Back Button label" value={es.textVideo.backButtonLabel} onChange={(v) => setES("textVideo", "backButtonLabel", v)} max={25} placeholder="Back to Offer" help="Label of the button that returns from the video view to the offer." />
        <SwitchRow label="Autoplay" checked={es.textVideo.autoplay} onChange={(v) => setES("textVideo", "autoplay", v)} />
        <ColorSwatchRow label="Background Color" value={es.textVideo.bg} onChange={(v) => setES("textVideo", "bg", v)} help="Background of the text & video section (preview only; live inherits the checkout theme)." />
        <Pad label="Top padding" value={es.textVideo.top} onChange={(v) => setES("textVideo", "top", v)} />
        <Pad label="Bottom padding" value={es.textVideo.bottom} onChange={(v) => setES("textVideo", "bottom", v)} />
      </SectionItem>

      {/* Content blocks */}
      <SectionItem value="pp-blocks" icon={LayoutList} title="Content Blocks">
        <p className="text-xs text-muted-foreground">Ordered blocks shown below the offer.</p>
        <ContentBlocksEditor blocks={draft.contentBlocks} onChange={(v) => set("contentBlocks", v)} />
        <AddContentBlock blocks={draft.contentBlocks} onChange={(v) => set("contentBlocks", v)} />
      </SectionItem>

      {/* Promotional Banner (Kaching-style) */}
      <SectionItem value="pp-promo" icon={Megaphone} title="Promotional Banner">
        <SwitchRow label="Enable Promotional Banner" checked={es.promoBanner.enabled} onChange={(v) => setES("promoBanner", "enabled", v)} />
        <div>
          <Label className="text-xs">Banner Title</Label>
          <Input value={es.promoBanner.title} onChange={(e) => setES("promoBanner", "title", e.target.value)} placeholder="Check out our partner!" className="mt-1 h-9" />
        </div>
        <div>
          <Label className="text-xs">Banner Description</Label>
          <Textarea value={es.promoBanner.description} onChange={(e) => setES("promoBanner", "description", e.target.value)} placeholder="Promotional text…" className="mt-1 min-h-[56px] resize-none text-xs" />
        </div>
        <div>
          <Label className="text-xs">Button Text</Label>
          <Input value={es.promoBanner.buttonText} onChange={(e) => setES("promoBanner", "buttonText", e.target.value)} placeholder="Learn More" className="mt-1 h-9" />
        </div>
        <div>
          <Label className="text-xs">Button Link URL</Label>
          <Input value={es.promoBanner.buttonUrl} onChange={(e) => setES("promoBanner", "buttonUrl", e.target.value)} placeholder="https://…" className="mt-1 h-9 text-xs" />
        </div>
        <div>
          <Label className="text-xs">Banner Image URL</Label>
          <Input value={es.promoBanner.imageUrl} onChange={(e) => setES("promoBanner", "imageUrl", e.target.value)} placeholder="https://… (optional)" className="mt-1 h-9 text-xs" />
        </div>
      </SectionItem>
    </Accordion>
  );
}

export default function OfferEditor() {
  const { offer, funnel, type, dbError, storeName } = useLoaderData();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const initial = () => normalizeOffer(offer || {}, type);
  const [saved, setSaved] = useState(initial); // last-saved snapshot (for Discard)
  const [draft, setDraft] = useState(initial);
  const [device, setDevice] = useState("desktop");
  const [pickerOpen, setPickerOpen] = useState(false);

  const busy = fetcher.state !== "idle";
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const setES = (group, key, value) =>
    setDraft((d) => ({ ...d, editorSettings: { ...d.editorSettings, [group]: { ...d.editorSettings[group], [key]: value } } }));
  const setESRoot = (key, value) =>
    setDraft((d) => ({ ...d, editorSettings: { ...d.editorSettings, [key]: value } }));

  const save = () =>
    fetcher.submit({ intent: "update-offer", data: JSON.stringify(draft) }, { method: "post" });
  const discard = () => setDraft(saved);

  useEffect(() => {
    if (!fetcher.data) return;
    if (fetcher.data.ok) {
      toast.success(fetcher.data.message || "Saved");
      setSaved(draft); // adopt the just-saved draft as the new baseline
    } else if (fetcher.data.error) {
      toast.error(fetcher.data.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const isPP = type === "post-purchase";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate(backHref)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-foreground truncate">
              {isPP ? "Post-Purchase Upsell Editor" : "Edit Offer"}
            </h1>
            <p className="text-xs text-muted-foreground capitalize">{draft.type} offer · {funnel.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {dirty ? <span className="text-xs text-amber-600 mr-1">Unsaved changes</span> : null}
          <Button variant="outline" onClick={discard} disabled={busy || !dirty}>Discard</Button>
          <Button onClick={save} disabled={busy || !dirty}>
            <Save className="h-4 w-4 mr-2" />
            {busy ? "Saving..." : "Save"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="More actions"><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => navigate(backHref)}>Back to funnel</DropdownMenuItem>
              <DropdownMenuItem onSelect={discard} disabled={!dirty}>Discard changes</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Split panel */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* LEFT */}
        <div className="lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto lg:pr-1">
          {isPP ? (
            <OcuPanel draft={draft} set={set} setES={setES} setESRoot={setESRoot} hasProduct={hasProduct} openPicker={() => setPickerOpen(true)} />
          ) : (
            <Accordion type="multiple" defaultValue={["headline", "product"]} className="space-y-2">
              {/* 1. Headline */}
              <SectionItem value="headline" icon={Heading1} title="Headline">
                <SwitchRow label="Show headline" checked={draft.headlineEnabled} onChange={(v) => set("headlineEnabled", v)} />
                <div>
                  <Label className="text-xs">Headline</Label>
                  <Input value={draft.headline} onChange={(e) => set("headline", e.target.value)} className="mt-1 h-9" />
                </div>
              </SectionItem>

              <SectionItem value="subheadline" icon={TextCursorInput} title="Sub-headline">
                <SwitchRow label="Show subheadline" checked={draft.subheadlineEnabled} onChange={(v) => set("subheadlineEnabled", v)} />
                <div>
                  <Label className="text-xs">Subheadline</Label>
                  <Input value={draft.subheadlineText} onChange={(e) => set("subheadlineText", e.target.value)} className="mt-1 h-9" />
                </div>
              </SectionItem>

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
                      {draft.imageUrl ? <img src={draft.imageUrl} alt="" className="h-full w-full object-cover" /> : <Package className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{draft.productTitle || "Selected product"}</p>
                      {draft.price != null && draft.price !== "" && <p className="text-xs text-muted-foreground">${Number(draft.price).toFixed(2)}</p>}
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
                    <Input type="number" min="0" {...(draft.discountType === "percentage" ? { max: "100" } : {})} value={draft.discountValue ?? ""} onChange={(e) => set("discountValue", e.target.value)} className="mt-1 h-9" />
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

              {/* 8. Display Offer */}
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

              {/* 9. General */}
              <SectionItem value="general" icon={Paintbrush} title="General">
                <SwitchRow label="Inherit store font" checked={draft.inheritStoreFont} onChange={(v) => set("inheritStoreFont", v)} details="Use the theme's font instead of the one below." />
                <div>
                  <Label className="text-xs">Font family</Label>
                  <Select value={draft.fontFamily} onValueChange={(v) => set("fontFamily", v)}>
                    <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
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
            </Accordion>
          )}
        </div>

        {/* RIGHT: sticky live preview + device toggle */}
        <div className="lg:sticky lg:top-4 self-start space-y-3">
          <div className="flex items-center justify-between gap-2">
            {isPP ? (
              <Select value={draft.editorSettings.previewType} onValueChange={(v) => setDraft((d) => ({ ...d, editorSettings: { ...d.editorSettings, previewType: v } }))}>
                <SelectTrigger className="h-8 w-[220px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time_and_sub">One-time purchase &amp; Subscription</SelectItem>
                  <SelectItem value="subscription_only">Subscription only</SelectItem>
                  <SelectItem value="prepaid_sub">Pre-paid subscription</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <p className="text-sm font-semibold">{DEVICES.find((d) => d.id === device)?.label} preview</p>
            )}
            <div className="flex items-center gap-1">
              {DEVICES.map((d) => {
                const Icon = DEVICE_ICONS[d.id];
                return (
                  <Button key={d.id} variant={device === d.id ? "secondary" : "ghost"} size="icon" className="h-8 w-8" onClick={() => setDevice(d.id)} aria-label={`${d.label} preview`}>
                    <Icon className="h-4 w-4" />
                  </Button>
                );
              })}
            </div>
          </div>
          {isPP ? (
            <>
              <div className="rounded-md border bg-amber-50 px-3 py-2 text-xs text-amber-800">
                This preview uses a product placeholder. To see how your product appears on the live offer page,{" "}
                <button type="button" className="underline" onClick={() => setPickerOpen(true)}>select a product to preview</button>.
              </div>
              <PostPurchasePreview offer={draft} device={device} storeName={storeName} />
            </>
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
