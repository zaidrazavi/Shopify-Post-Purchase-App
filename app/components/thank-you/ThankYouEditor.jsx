// Ported RevLift pattern includes clickable list rows that also contain
// buttons; keyboard/role a11y is a tracked follow-up.
/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
import { useEffect, useState } from "react";
import { useNavigate, useFetcher } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShopifyProductPicker,
  SelectedProductsDisplay,
} from "@/components/ShopifyProductPicker";
import {
  ArrowLeft,
  Save,
  Filter,
  Info,
  ShoppingCart,
  HelpCircle,
  Type,
  Image as ImageIcon,
  Code,
  Trash2,
  Pencil,
  ShoppingBag,
  Eye,
  EyeOff,
} from "lucide-react";

// widget id (UI) → settings.widgets.<key>
const WIDGETS = [
  { id: "product-recommendation", key: "product_recommendations", label: "Product recommendation", icon: ShoppingCart },
  { id: "faqs", key: "faq", label: "FAQs", icon: HelpCircle },
  { id: "text", key: "custom_text", label: "Text", icon: Type },
  { id: "image", key: "custom_image", label: "Image", icon: ImageIcon },
  { id: "custom-code", key: "custom_code", label: "Custom code", icon: Code },
];

function WidgetSidebar({ widgets, activeId, onSelect, onToggle }) {
  return (
    <Card className="w-64 shrink-0">
      <CardContent className="p-4 space-y-1">
        <h3 className="text-sm font-semibold text-foreground mb-3">Thank You Page Editor</h3>
        {widgets.map((w) => (
          <button
            key={w.id}
            onClick={() => onSelect(w.id)}
            className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors ${
              activeId === w.id ? "bg-accent text-accent-foreground font-medium" : "hover:bg-muted text-foreground"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <w.icon className="h-4 w-4" />
              <span>{w.label}</span>
            </div>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onToggle(w.key);
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              {w.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </span>
          </button>
        ))}
      </CardContent>
    </Card>
  );
}

function ProductRecommendationPanel({
  offers,
  recSettings,
  onChangeRec,
  onAddProducts,
  onEditOffer,
  onDeleteOffer,
  onToggleEnabled,
}) {
  const enabled = !!recSettings.enabled;
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${enabled ? "bg-green-500" : "bg-destructive"}`} />
          <h3 className="text-base font-semibold text-foreground">
            Product recommendation widget {enabled ? "active" : "inactive"}
          </h3>
        </div>
        <Button variant="outline" size="sm" onClick={onToggleEnabled}>
          {enabled ? "Disable" : "Enable"}
        </Button>
      </div>

      {/* Upsell products */}
      <div>
        <h4 className="text-sm font-semibold text-foreground mb-3">Upsell products</h4>
        <div className="rounded-lg border border-dashed bg-muted/50 p-4 space-y-3">
          {offers.length > 0 && (
            <div className="space-y-2">
              {offers.map((offer) => (
                <div
                  key={offer.id}
                  className="rounded-lg border bg-card p-3 flex items-center gap-3 hover:shadow-sm transition-shadow cursor-pointer"
                  onClick={() => onEditOffer(offer.id)}
                >
                  <div className="h-10 w-10 rounded-md bg-muted flex items-center justify-center shrink-0">
                    {offer.imageUrl ? (
                      <img src={offer.imageUrl} alt="" className="h-full w-full object-cover rounded-md" />
                    ) : (
                      <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{offer.headline || "Untitled offer"}</p>
                    <p className="text-xs text-muted-foreground">{offer.type}</p>
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
          <Button variant="default" size="sm" onClick={onAddProducts} className="w-full">
            Add upsell products
          </Button>
        </div>
      </div>

      <Separator />

      {/* Persisted display settings */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm">Heading</Label>
          <Input value={recSettings.heading ?? ""} onChange={(e) => onChangeRec("heading", e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label className="text-sm">Max products to show</Label>
          <Select
            value={String(recSettings.max_products ?? 3)}
            onValueChange={(v) => onChangeRec("max_products", Number(v))}
          >
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>{n}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function PlaceholderPanel({ title, description }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 gap-3">
      <div className="rounded-full bg-muted p-3">
        <Info className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-md">{description}</p>
    </div>
  );
}

export function ThankYouEditor({ funnel, settings }) {
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [draft, setDraft] = useState({
    name: funnel.name,
    triggerType: funnel.triggerType,
    triggerValue: funnel.triggerValue ?? "",
  });
  const [status, setStatus] = useState(funnel.status);
  const [design, setDesign] = useState(settings);
  const [activeId, setActiveId] = useState("product-recommendation");
  // Selected trigger items as {id,title}. Pre-saved ids load with the id as a
  // placeholder title until re-selected (no catalog lookup on load).
  const [triggerItems, setTriggerItems] = useState(
    funnel.triggerValue
      ? funnel.triggerValue.split(",").filter(Boolean).map((id) => ({ id, title: id }))
      : [],
  );
  const [triggerPickerOpen, setTriggerPickerOpen] = useState(false);
  const [productPickerOpen, setProductPickerOpen] = useState(false);

  const busy = fetcher.state !== "idle";

  useEffect(() => {
    if (!fetcher.data) return;
    if (fetcher.data.ok) toast.success(fetcher.data.message || "Saved");
    else if (fetcher.data.error) toast.error(fetcher.data.error);
  }, [fetcher.data]);

  const submit = (fields) => fetcher.submit(fields, { method: "post" });

  const widgets = WIDGETS.map((w) => ({ ...w, enabled: !!design.widgets?.[w.key]?.enabled }));
  const offers = (funnel.offers || []).filter((o) => o.section === "thank-you-upsell");
  const rec = design.widgets?.product_recommendations ?? {};

  const toggleWidget = (key) =>
    setDesign((d) => ({
      ...d,
      widgets: { ...d.widgets, [key]: { ...d.widgets[key], enabled: !d.widgets[key]?.enabled } },
    }));

  const changeRec = (k, v) =>
    setDesign((d) => ({
      ...d,
      widgets: { ...d.widgets, product_recommendations: { ...d.widgets.product_recommendations, [k]: v } },
    }));

  const saveFunnel = () => submit({ intent: "update-funnel", data: JSON.stringify(draft) });
  const saveWidgets = () =>
    submit({ intent: "update-settings", settingsKey: "thankYouSettings", data: JSON.stringify(design) });

  const togglePublish = () => {
    const next = status === "active" ? "draft" : "active";
    setStatus(next);
    submit({ intent: "update-funnel", data: JSON.stringify({ status: next }) });
  };

  const addProducts = (items) => {
    // Picker returns full product objects.
    const products = items.map((p) => ({
      id: p.id,
      // First variant's GID — required for the resolver to serve the offer
      // (was dropped, leaving variantId null). productTitle is set from title
      // in the create-offers action.
      variantId: p.variants?.[0]?.id ?? null,
      title: p.title,
      image: p.image,
      price: p.price,
      compareAtPrice: p.compareAtPrice ?? null,
    }));
    if (products.length) {
      submit({ intent: "create-offers", section: "thank-you-upsell", products: JSON.stringify(products) });
    }
  };

  const editOffer = (offerId) => navigate(`/app/funnels/thank-you/${funnel.id}/offer/${offerId}`);
  const deleteOfferNode = (offerId) => submit({ intent: "delete-offer", offerId });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/app/funnels/thank-you")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Input
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
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
          <Button onClick={saveFunnel} disabled={busy}>
            <Save className="h-4 w-4 mr-2" />
            {busy ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Triggers */}
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
                <Select value={draft.triggerType} onValueChange={(v) => setDraft((d) => ({ ...d, triggerType: v }))}>
                  <SelectTrigger className="w-[180px] h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-products">Any product</SelectItem>
                    <SelectItem value="specific-products">Specific products</SelectItem>
                    <SelectItem value="specific-collections">Specific collections</SelectItem>
                    <SelectItem value="total-value">Total value</SelectItem>
                    <SelectItem value="customer-tag">Customer tag</SelectItem>
                  </SelectContent>
                </Select>

                {(draft.triggerType === "specific-products" || draft.triggerType === "specific-collections") && (
                  <>
                    <SelectedProductsDisplay
                      selected={triggerItems}
                      onRemove={(rid) => {
                        const next = triggerItems.filter((i) => i.id !== rid);
                        setTriggerItems(next);
                        setDraft((d) => ({ ...d, triggerValue: next.map((i) => i.id).join(",") }));
                      }}
                      onBrowse={() => setTriggerPickerOpen(true)}
                      placeholder={draft.triggerType === "specific-products" ? "Browse products..." : "Browse collections..."}
                    />
                    <ShopifyProductPicker
                      open={triggerPickerOpen}
                      onOpenChange={setTriggerPickerOpen}
                      mode={draft.triggerType === "specific-products" ? "product" : "collection"}
                      selected={triggerItems.map((i) => i.id)}
                      onSelect={(items) => {
                        const picked = items.map((i) => ({ id: i.id, title: i.title }));
                        setTriggerItems(picked);
                        setDraft((d) => ({ ...d, triggerValue: picked.map((i) => i.id).join(",") }));
                      }}
                    />
                  </>
                )}

                {draft.triggerType !== "all-products" &&
                  draft.triggerType !== "specific-products" &&
                  draft.triggerType !== "specific-collections" && (
                    <Input
                      placeholder="Enter value..."
                      className="h-9 max-w-[200px]"
                      value={draft.triggerValue || ""}
                      onChange={(e) => setDraft((d) => ({ ...d, triggerValue: e.target.value }))}
                    />
                  )}
              </div>
            </div>
            <Info className="h-4 w-4 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      {/* Widget editor */}
      <div className="flex gap-6 items-start">
        <WidgetSidebar widgets={widgets} activeId={activeId} onSelect={setActiveId} onToggle={toggleWidget} />
        <Card className="flex-1">
          <CardContent className="p-6">
            {activeId === "product-recommendation" && (
              <ProductRecommendationPanel
                offers={offers}
                recSettings={rec}
                onChangeRec={changeRec}
                onAddProducts={() => setProductPickerOpen(true)}
                onEditOffer={editOffer}
                onDeleteOffer={deleteOfferNode}
                onToggleEnabled={() => toggleWidget("product_recommendations")}
              />
            )}
            {activeId === "faqs" && (
              <PlaceholderPanel
                title="FAQs Widget"
                description="Add frequently asked questions to help customers post-purchase. Configure questions, answers, and display settings."
              />
            )}
            {activeId === "text" && (
              <PlaceholderPanel
                title="Text Widget"
                description="Add custom text blocks to your Thank You page. Include thank you messages, shipping info, or promotional content."
              />
            )}
            {activeId === "image" && (
              <PlaceholderPanel
                title="Image Widget"
                description="Add custom images or banners to your Thank You page. Upload images or link to external URLs."
              />
            )}
            {activeId === "custom-code" && (
              <PlaceholderPanel
                title="Custom Code Widget"
                description="Add custom HTML, CSS, or JavaScript to your Thank You page for advanced customizations."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={saveWidgets} disabled={busy}>
          <Save className="h-4 w-4 mr-2" />
          {busy ? "Saving..." : "Save widget settings"}
        </Button>
      </div>

      {/* Add products picker */}
      <ShopifyProductPicker
        open={productPickerOpen}
        onOpenChange={setProductPickerOpen}
        mode="product"
        multiple
        selected={offers.map((o) => o.productId).filter(Boolean)}
        onSelect={addProducts}
      />
    </div>
  );
}
