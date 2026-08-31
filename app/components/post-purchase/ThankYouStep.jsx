import { Card, CardContent } from "@/components/ui/card";
import { Heart } from "lucide-react";

export function ThankYouStep() {
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-foreground">Thank You Page</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Configure what customers see on the Thank You page after completing all offers.
        </p>
      </div>

      <Card>
        <CardContent className="p-6 flex flex-col items-center justify-center text-center min-h-[200px] gap-3">
          <div className="rounded-full bg-muted p-3">
            <Heart className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Thank You page customization will appear here. <br />
            Configure product recommendations, order summary, and custom content blocks.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
