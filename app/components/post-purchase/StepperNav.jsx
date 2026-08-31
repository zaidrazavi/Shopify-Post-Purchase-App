import { Sparkles, ShoppingBag } from "lucide-react";

const steps = [
  { label: "Triggers", icon: Sparkles },
  { label: "Upsells", icon: ShoppingBag },
];

export function StepperNav({ currentStep, onStepChange }) {
  return (
    <div className="flex items-center gap-0 w-full max-w-2xl mx-auto">
      {steps.map((step, idx) => {
        const isActive = idx === currentStep;
        const isCompleted = idx < currentStep;
        return (
          <button
            key={step.label}
            onClick={() => onStepChange(idx)}
            className="flex-1 flex flex-col items-center gap-2 group"
          >
            {/* Progress bar */}
            <div
              className={`w-full h-1 rounded-full transition-colors ${
                isActive ? "bg-foreground" : isCompleted ? "bg-foreground/60" : "bg-muted"
              }`}
            />
            {/* Icon + label */}
            <div className="flex items-center gap-2">
              <step.icon
                className={`h-4 w-4 transition-colors ${
                  isActive ? "text-foreground" : "text-muted-foreground"
                }`}
              />
              <span
                className={`text-sm font-medium transition-colors ${
                  isActive ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
