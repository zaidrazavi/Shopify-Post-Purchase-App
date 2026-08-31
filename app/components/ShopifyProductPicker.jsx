// Ported RevLift pattern: clickable list rows that also contain checkboxes.
// Keyboard/role a11y is a tracked follow-up.
/* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
import { useState, useEffect, useRef, useMemo } from "react";
import { useFetcher } from "react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Search, X, ChevronRight, Package, Loader2 } from "lucide-react";

/**
 * Real Shopify product/collection picker. Fetches from the authenticated
 * /api/products resource route (Admin GraphQL). UI/UX is unchanged from the
 * previous dummy-data version — only the data source changed.
 *
 * onSelect(items) returns full item objects (superset of the old {id,title}):
 *   product    → { id, title, image, price, compareAtPrice, variants, ... }
 *   collection → { id, title, productCount, image }
 */
export function ShopifyProductPicker({
  open,
  onOpenChange,
  onSelect,
  selected = [],
  mode = "product",
  multiple = true,
}) {
  const fetcher = useFetcher();
  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState(new Set(selected));
  const [expandedProduct, setExpandedProduct] = useState(null);
  // Remembers full item objects seen across searches, so a confirm returns
  // complete data even for items not in the current filtered results.
  const seen = useRef(new Map());

  // Reset selection each time the dialog opens.
  useEffect(() => {
    if (open) {
      setChecked(new Set(selected));
      setSearch("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Fetch from the resource route when open, or when the query/mode changes
  // (debounced while typing).
  useEffect(() => {
    if (!open) return undefined;
    const load = () => {
      const params = new URLSearchParams();
      if (mode === "collection") params.set("mode", "collection");
      else if (search.trim()) params.set("query", search.trim());
      fetcher.load(`/api/products?${params.toString()}`);
    };
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, search, mode]);

  const items = useMemo(
    () => (mode === "product" ? fetcher.data?.products ?? [] : fetcher.data?.collections ?? []),
    [fetcher.data, mode],
  );
  const loading = fetcher.state !== "idle";
  const error = fetcher.data?.error;

  // Accumulate seen items for cross-search selection integrity.
  useEffect(() => {
    for (const it of items) seen.current.set(it.id, it);
  }, [items]);

  const toggle = (id) => {
    const next = new Set(checked);
    if (multiple) {
      if (next.has(id)) next.delete(id);
      else next.add(id);
    } else {
      next.clear();
      next.add(id);
    }
    setChecked(next);
  };

  const handleConfirm = () => {
    const selectedItems = [...checked].map((id) => seen.current.get(id) || { id, title: id });
    onSelect(selectedItems);
    onOpenChange(false);
    setSearch("");
  };

  const handleCancel = () => {
    onOpenChange(false);
    setChecked(new Set(selected));
    setSearch("");
  };

  return (
    <Dialog open={open} onOpenChange={handleCancel}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-base">
            {mode === "product" ? "Select products" : "Select collections"}
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="px-4 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={mode === "product" ? "Search products..." : "Search collections..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* List */}
        <ScrollArea className="max-h-[380px] border-t border-b">
          <div className="divide-y">
            {loading && (
              <div className="py-8 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading...
              </div>
            )}
            {!loading && error && (
              <div className="py-8 text-center text-sm text-destructive">{error}</div>
            )}
            {!loading && !error && items.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No {mode === "product" ? "products" : "collections"} found
              </div>
            )}
            {!loading &&
              mode === "product" &&
              items.map((product) => (
                <div key={product.id}>
                  <div
                    className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 cursor-pointer"
                    onClick={() => toggle(product.id)}
                  >
                    <Checkbox
                      checked={checked.has(product.id)}
                      onCheckedChange={() => toggle(product.id)}
                    />
                    {/* Thumbnail */}
                    <div className="h-10 w-10 rounded-md bg-muted border flex items-center justify-center shrink-0 overflow-hidden text-[10px] font-bold text-muted-foreground">
                      {product.image ? (
                        <img src={product.image} alt="" className="h-full w-full object-cover rounded-md" />
                      ) : (
                        <Package className="h-4 w-4" />
                      )}
                    </div>
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{product.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {product.variants.length} variant{product.variants.length > 1 ? "s" : ""}
                      </p>
                    </div>
                    {/* Price */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium">${product.price.toFixed(2)}</p>
                      {product.compareAtPrice && (
                        <p className="text-xs text-muted-foreground line-through">
                          ${product.compareAtPrice.toFixed(2)}
                        </p>
                      )}
                    </div>
                    {/* Expand */}
                    {product.variants.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpandedProduct(expandedProduct === product.id ? null : product.id);
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ChevronRight
                          className={`h-4 w-4 transition-transform ${
                            expandedProduct === product.id ? "rotate-90" : ""
                          }`}
                        />
                      </button>
                    )}
                  </div>
                  {/* Variants */}
                  {expandedProduct === product.id && product.variants.length > 1 && (
                    <div className="bg-muted/30 border-t">
                      {product.variants.map((v) => (
                        <div
                          key={v.id}
                          className="flex items-center gap-3 px-4 pl-16 py-2 text-sm hover:bg-muted/50"
                        >
                          <div className="flex-1 text-muted-foreground">{v.title}</div>
                          <span className="text-xs text-muted-foreground">
                            {v.availableForSale ? "In stock" : "Sold out"}
                          </span>
                          <span className="text-sm">${v.price.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            {!loading &&
              mode === "collection" &&
              items.map((col) => (
                <div
                  key={col.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 cursor-pointer"
                  onClick={() => toggle(col.id)}
                >
                  <Checkbox checked={checked.has(col.id)} onCheckedChange={() => toggle(col.id)} />
                  <div className="h-10 w-10 rounded-md bg-muted border flex items-center justify-center shrink-0 overflow-hidden">
                    {col.image ? (
                      <img src={col.image} alt="" className="h-full w-full object-cover rounded-md" />
                    ) : (
                      <Package className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{col.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {col.productCount} product{col.productCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="p-4 pt-3 flex-row justify-between sm:justify-between">
          <p className="text-xs text-muted-foreground self-center">{checked.size} selected</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirm}>
              {multiple ? "Add" : "Select"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Inline selected items display (chips) ──────────────────
   `selected` is an array of { id, title } (from the picker's onSelect). */
export function SelectedProductsDisplay({ selected = [], onRemove, onBrowse, placeholder = "Browse..." }) {
  if (selected.length === 0) {
    return (
      <Button variant="outline" size="sm" className="h-9" onClick={onBrowse}>
        <Search className="h-3.5 w-3.5 mr-1.5" />
        {placeholder}
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {selected.map((item) => (
        <Badge key={item.id} variant="secondary" className="gap-1 pr-1 text-xs">
          {item.title}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(item.id);
            }}
            className="ml-0.5 hover:text-destructive"
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={onBrowse}>
        <Search className="h-3 w-3 mr-1" />
        Browse
      </Button>
    </div>
  );
}
