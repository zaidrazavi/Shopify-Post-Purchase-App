import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, Tag, ShoppingCart, User, Clock } from "lucide-react";

const triggerGroups = [
  {
    key: "product",
    icon: Tag,
    label: "Product Based Triggers",
    description: "Trigger based on specific products or collections in the order.",
  },
  {
    key: "cart",
    icon: ShoppingCart,
    label: "Cart & Discount Triggers",
    description: "Trigger based on cart value, item quantity, or discount codes.",
  },
  {
    key: "customer",
    icon: User,
    label: "Customer Attribute Triggers",
    description: "Trigger based on customer tags, order count, or location.",
  },
  {
    key: "order",
    icon: Clock,
    label: "Order Details & Time Based Triggers",
    description: "Trigger based on order details or time-based rules.",
  },
];

export function TriggersStep({ funnel, onUpdate }) {
  const isAllCustomers = funnel.triggerType === "all-products";

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-foreground">Triggers</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Set triggers to control when customers see your offers.
        </p>
      </div>

      {/* Show for all customers */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center gap-3">
          <Checkbox
            id="all-customers"
            checked={isAllCustomers}
            onCheckedChange={(checked) => {
              onUpdate({ triggerType: checked ? "all-products" : "specific-products" });
            }}
          />
          <Label htmlFor="all-customers" className="text-sm font-medium cursor-pointer">
            Show this funnel for all customers
          </Label>
        </div>
      </div>

      {/* OR divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 border-t border-border" />
        <span className="text-xs font-semibold text-muted-foreground tracking-wider">OR</span>
        <div className="flex-1 border-t border-border" />
      </div>

      {/* Trigger groups */}
      <div className="space-y-3">
        {triggerGroups.map((group) => (
          <Collapsible key={group.key}>
            <CollapsibleTrigger className="w-full rounded-xl border bg-card p-4 flex items-center justify-between hover:bg-accent/50 transition-colors">
              <div className="flex items-center gap-3">
                <group.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{group.label}</span>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
            </CollapsibleTrigger>
            <CollapsibleContent className="px-4 pt-3 pb-1">
              <p className="text-xs text-muted-foreground">{group.description}</p>
              <p className="text-xs text-muted-foreground mt-2 italic">
                Configure trigger conditions here. (Coming soon)
              </p>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}
