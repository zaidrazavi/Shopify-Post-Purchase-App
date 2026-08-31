import { useEffect, useState } from "react";
import { useNavigate, useFetcher } from "react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Save } from "lucide-react";
import { StepperNav } from "@/components/post-purchase/StepperNav";
import { TriggersStep } from "@/components/post-purchase/TriggersStep";
import { UpsellBranchingTree } from "@/components/post-purchase/UpsellBranchingTree";

/**
 * Post-purchase funnel editor: 2-step stepper (Triggers → Upsells) with the
 * branching tree. Adapted from RevLift's PostPurchaseFunnelEditor page to this
 * app's loader/action model — mutations go through the route action via a
 * fetcher (so tree/stepper state survives saves).
 */
export function PostPurchaseEditor({ funnel }) {
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [currentStep, setCurrentStep] = useState(0);
  // Editable trigger/name fields held locally; offers come from the loader.
  const [draft, setDraft] = useState({
    name: funnel.name,
    triggerType: funnel.triggerType,
    triggerValue: funnel.triggerValue ?? "",
  });
  const [status, setStatus] = useState(funnel.status);

  const busy = fetcher.state !== "idle";

  useEffect(() => {
    if (!fetcher.data) return;
    if (fetcher.data.ok) toast.success(fetcher.data.message || "Saved");
    else if (fetcher.data.error) toast.error(fetcher.data.error);
  }, [fetcher.data]);

  const submit = (fields) => fetcher.submit(fields, { method: "post" });

  const saveAndNext = () => {
    submit({ intent: "update-funnel", data: JSON.stringify(draft) });
    if (currentStep < 1) setCurrentStep(currentStep + 1);
  };

  const toggleActive = () => {
    const next = status === "active" ? "draft" : "active";
    setStatus(next);
    submit({ intent: "update-funnel", data: JSON.stringify({ status: next }) });
  };

  // section + optional product + traffic split → one create-offer call.
  const createOfferNode = (section, product, trafficSplit) => {
    const fields = { intent: "create-offer", offerType: "upsell", section };
    if (product) {
      fields.headline = product.title;
      fields.imageUrl = product.image;
      fields.productId = product.id;
      fields.price = String(product.price);
      if (product.compareAtPrice) fields.compareAtPrice = String(product.compareAtPrice);
    }
    if (trafficSplit != null) fields.trafficSplit = String(trafficSplit);
    submit(fields);
  };

  const editOffer = (offerId) =>
    navigate(`/app/funnels/post-purchase/${funnel.id}/offer/${offerId}`);
  const deleteOfferNode = (offerId) => submit({ intent: "delete-offer", offerId });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/app/funnels/post-purchase")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-bold text-foreground">{draft.name}</h1>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate("/app/analytics")}>
            View analytics
          </Button>
          <Button onClick={saveAndNext} disabled={busy} size="sm">
            <Save className="h-4 w-4 mr-2" />
            {busy ? "Saving..." : "Save and next"}
          </Button>
        </div>
      </div>

      {/* Stepper */}
      <StepperNav currentStep={currentStep} onStepChange={setCurrentStep} />

      {/* Step content */}
      <div className="min-h-[400px]">
        {currentStep === 0 && (
          <TriggersStep
            funnel={draft}
            onUpdate={(updates) => setDraft((d) => ({ ...d, ...updates }))}
          />
        )}
        {currentStep === 1 && (
          <UpsellBranchingTree
            offers={funnel.offers || []}
            onCreateOffer={createOfferNode}
            onEditOffer={editOffer}
            onDeleteOffer={deleteOfferNode}
          />
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-4 pt-4 border-t">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{status === "active" ? "Funnel active" : "Funnel inactive"}</span>
          <Switch checked={status === "active"} onCheckedChange={toggleActive} disabled={busy} />
        </div>
        <Button onClick={saveAndNext} disabled={busy}>
          {busy ? "Saving..." : "Save and next"}
        </Button>
      </div>
    </div>
  );
}
