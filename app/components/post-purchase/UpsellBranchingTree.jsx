import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Eye, DollarSign, ShoppingCart, Percent, ShoppingBag, Copy } from "lucide-react";
import { ShopifyProductPicker } from "@/components/ShopifyProductPicker";

/* ─── Offer Card ─────────────────────────────────────── */
function OfferCard({ offer, onEdit, onDelete }) {
  const conversionRate =
    offer.impressions > 0 ? ((offer.conversions / offer.impressions) * 100).toFixed(2) : "0.00";
  const rpv = offer.impressions > 0 ? (offer.revenue / offer.impressions).toFixed(2) : "0.00";

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Product row */}
      <div className="p-3 flex items-start gap-3">
        <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
          {offer.imageUrl ? (
            <img src={offer.imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <ShoppingBag className="h-5 w-5 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">
            {offer.headline || "Untitled Offer"}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {offer.discountValue ? (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                <Percent className="h-2.5 w-2.5" />
                {offer.discountValue}%
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">None</Badge>
            )}
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
              <ShoppingCart className="h-2.5 w-2.5" />
              Free
            </Badge>
            {offer.timerEnabled && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                ⏱ {(offer.timerDuration / 60).toFixed(1)} min
              </Badge>
            )}
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
              <ShoppingCart className="h-2.5 w-2.5" />
              1+
            </Badge>
          </div>

          <div className="flex items-center gap-2 mt-2">
            <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={onEdit}>
              <Pencil className="h-3 w-3 mr-1" />
              Edit offer
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={onDelete}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>

      {/* Metrics row */}
      <div className="border-t bg-muted/30 px-3 py-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Eye className="h-3 w-3" /> {offer.impressions.toLocaleString()}
        </span>
        <span className="flex items-center gap-1">
          <DollarSign className="h-3 w-3" /> ${offer.revenue.toFixed(2)}
        </span>
        <span className="flex items-center gap-1">
          <ShoppingCart className="h-3 w-3" /> ${rpv}/visit
        </span>
        <span className="flex items-center gap-1">
          <Percent className="h-3 w-3" /> {conversionRate}%
        </span>
      </div>
    </div>
  );
}

/* ─── Empty Slot with Product Picker ──────────────────── */
function EmptySlot({ label, onSingleProduct, onMultiProduct, onCopyExisting }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-muted-foreground/20 bg-muted/20 min-h-[120px] flex items-center justify-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="text-xs">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center" className="w-48">
          <DropdownMenuLabel className="text-xs text-muted-foreground font-medium">
            Select product
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onSingleProduct}>
            <ShoppingBag className="h-3.5 w-3.5 mr-2" />
            Single product
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onMultiProduct}>
            <ShoppingCart className="h-3.5 w-3.5 mr-2" />
            Multi product
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onCopyExisting}>
            <Copy className="h-3.5 w-3.5 mr-2" />
            Copy existing offer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/* ─── Multi-product traffic split dialog ──────────────── */
function MultiProductSplitDialog({ open, onOpenChange, products, onConfirm }) {
  const evenSplit = Math.floor(100 / products.length);
  const remainder = 100 - evenSplit * products.length;
  const [splits, setSplits] = useState(
    products.map((p, i) => ({
      product: p,
      percentage: evenSplit + (i === 0 ? remainder : 0),
    })),
  );

  const updateSplit = (index, value) => {
    const next = [...splits];
    next[index] = { ...next[index], percentage: value };
    // Redistribute remaining evenly among others
    const remaining = 100 - value;
    const otherCount = next.length - 1;
    if (otherCount > 0) {
      const each = Math.floor(remaining / otherCount);
      const extra = remaining - each * otherCount;
      let extraIdx = 0;
      next.forEach((s, i) => {
        if (i !== index) {
          next[i] = { ...s, percentage: each + (extraIdx < extra ? 1 : 0) };
          extraIdx++;
        }
      });
    }
    setSplits(next);
  };

  const total = splits.reduce((sum, s) => sum + s.percentage, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Set Traffic Split</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Set the percentage of traffic each product variant will receive. Total must equal 100%.
        </p>

        <div className="space-y-4 py-2">
          {splits.map((split, idx) => (
            <div key={split.product.id} className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-md bg-muted overflow-hidden shrink-0">
                  {split.product.image ? (
                    <img src={split.product.image} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{split.product.title}</p>
                  <p className="text-xs text-muted-foreground">${split.product.price.toFixed(2)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge
                    variant={split.percentage > 0 ? "default" : "secondary"}
                    className="text-xs min-w-[48px] justify-center"
                  >
                    {split.percentage}%
                  </Badge>
                </div>
              </div>
              <Slider
                value={[split.percentage]}
                onValueChange={([val]) => updateSplit(idx, val)}
                max={100}
                min={0}
                step={1}
                className="w-full"
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Total traffic</span>
          <span className={`font-semibold ${total === 100 ? "text-foreground" : "text-destructive"}`}>
            {total}%
          </span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => onConfirm(splits)} disabled={total !== 100}>
            Create offers
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Branch connector ────────────────────────────────── */
function BranchConnector({ acceptLabel, declineLabel }) {
  return (
    <div className="relative flex items-start justify-center py-2">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-4 bg-muted-foreground/30" />
      <div className="absolute top-4 left-[25%] right-[25%] h-px bg-muted-foreground/30" />
      <div className="absolute top-4 left-[25%] w-px h-8 bg-muted-foreground/30" />
      <div className="absolute top-4 right-[25%] w-px h-8 bg-muted-foreground/30" />
      <div className="absolute top-10 left-[25%] -translate-x-1/2">
        <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-muted-foreground/40" />
      </div>
      <div className="absolute top-10 right-[25%] translate-x-1/2">
        <div className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[6px] border-l-transparent border-r-transparent border-t-muted-foreground/40" />
      </div>
      <div className="flex w-full justify-between px-[10%] pt-12 pb-2">
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0 text-[10px] font-medium">
          {acceptLabel}
        </Badge>
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-0 text-[10px] font-medium">
          {declineLabel}
        </Badge>
      </div>
    </div>
  );
}

/* ─── Main Tree ───────────────────────────────────────── */
export function UpsellBranchingTree({ offers, onCreateOffer, onEditOffer, onDeleteOffer }) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSection, setPickerSection] = useState("");
  const [pickerMultiple, setPickerMultiple] = useState(false);
  const [multiSplitOpen, setMultiSplitOpen] = useState(false);
  const [selectedMultiProducts, setSelectedMultiProducts] = useState([]);

  const getOffers = (section) => offers.filter((o) => o.section === section);

  const upsell1Offers = getOffers("post-purchase-1");
  const upsell2Offers = getOffers("post-purchase-2");
  const upsell3Offers = getOffers("post-purchase-3");
  const downsell1Offers = getOffers("downsell");
  const downsell2Offers = getOffers("downsell-2");

  const openSinglePicker = (section) => {
    setPickerSection(section);
    setPickerMultiple(false);
    setPickerOpen(true);
  };

  const openMultiPicker = (section) => {
    setPickerSection(section);
    setPickerMultiple(true);
    setPickerOpen(true);
  };

  const handlePickerSelect = (items) => {
    if (!pickerMultiple) {
      // Single product: create offer immediately (picker returns full objects)
      const product = items[0];
      if (product) {
        onCreateOffer(pickerSection, product);
      }
    } else {
      // Multi product: open split dialog
      const products = items.filter(Boolean);
      if (products.length > 0) {
        setSelectedMultiProducts(products);
        setMultiSplitOpen(true);
      }
    }
  };

  const handleMultiConfirm = (splits) => {
    splits.forEach((split) => {
      if (split.percentage > 0) {
        onCreateOffer(pickerSection, split.product, split.percentage);
      }
    });
    setMultiSplitOpen(false);
    setSelectedMultiProducts([]);
  };

  const renderSlot = (section, sectionOffers, label, isFirst = false) => {
    if (sectionOffers.length > 0) {
      return (
        <div className="space-y-2">
          {sectionOffers.map((offer) => (
            <div key={offer.id} className="relative">
              {sectionOffers.length > 1 && (
                <Badge className="absolute -top-2 -right-2 z-10 text-[10px] px-1.5 py-0">
                  {offer.trafficSplit}% traffic
                </Badge>
              )}
              <OfferCard
                offer={offer}
                onEdit={() => onEditOffer(offer.id)}
                onDelete={() => onDeleteOffer(offer.id)}
              />
            </div>
          ))}
        </div>
      );
    }
    return (
      <EmptySlot
        label={isFirst ? "Create your first offer" : "Create offer"}
        onSingleProduct={() => openSinglePicker(section)}
        onMultiProduct={() => openMultiPicker(section)}
        onCopyExisting={() => onCreateOffer(section)}
      />
    );
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-foreground">Upsells</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Create, edit and test your upsell offers.
        </p>
      </div>

      {/* Upsell 1 */}
      <div>
        <p className="text-sm font-semibold text-foreground mb-2">Upsell 1</p>
        <div className="max-w-[560px]">
          {renderSlot("post-purchase-1", upsell1Offers, "Create your first offer", true)}
        </div>
      </div>

      {/* Branch: Upsell 1 accepted / declined */}
      <BranchConnector acceptLabel="Upsell 1 accepted" declineLabel="Upsell 1 declined" />

      {/* Row: Upsell 2 | Downsell 1 */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-sm font-semibold text-foreground mb-2">Upsell 2</p>
          {renderSlot("post-purchase-2", upsell2Offers, "Create offer")}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground mb-2">Downsell 1</p>
          {renderSlot("downsell", downsell1Offers, "Create offer")}
        </div>
      </div>

      {/* Branch: Upsell 2 accepted / declined */}
      <BranchConnector acceptLabel="Upsell 2 accepted" declineLabel="Upsell 2 declined" />

      {/* Row: Upsell 3 | Downsell 2 */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-sm font-semibold text-foreground mb-2">Upsell 3</p>
          {renderSlot("post-purchase-3", upsell3Offers, "Create offer")}
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground mb-2">Downsell 2</p>
          {renderSlot("downsell-2", downsell2Offers, "Create offer")}
        </div>
      </div>

      {/* Product Picker */}
      <ShopifyProductPicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        mode="product"
        multiple={pickerMultiple}
        onSelect={handlePickerSelect}
      />

      {/* Multi-product split dialog */}
      {selectedMultiProducts.length > 0 && (
        <MultiProductSplitDialog
          open={multiSplitOpen}
          onOpenChange={setMultiSplitOpen}
          products={selectedMultiProducts}
          onConfirm={handleMultiConfirm}
        />
      )}
    </div>
  );
}
