import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Target } from "lucide-react";
import type { MarketAnalysis } from "@workspace/api-client-react";
import { useState } from "react";

interface ActionPlanChecklistProps {
  actionPlan: MarketAnalysis["actionPlan"];
}

export function ActionPlanChecklist({
  actionPlan,
}: ActionPlanChecklistProps) {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (item: string) => {
    const next = new Set(checked);
    if (next.has(item)) next.delete(item);
    else next.add(item);
    setChecked(next);
  };

  const sections = [
    { title: "Immediate (This Week)", items: actionPlan.immediate },
    { title: "Short Term (1-3 Months)", items: actionPlan.shortTerm },
    { title: "Long Term (3-12 Months)", items: actionPlan.longTerm },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Action Plan
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {sections.map((section) => (
          <div key={section.title}>
            <h4 className="text-sm font-semibold mb-2">{section.title}</h4>
            <div className="space-y-2">
              {section.items.map((item) => (
                <div key={item} className="flex items-start gap-2">
                  <Checkbox
                    id={item}
                    checked={checked.has(item)}
                    onCheckedChange={() => toggle(item)}
                  />
                  <label
                    htmlFor={item}
                    className={`text-sm leading-none ${
                      checked.has(item)
                        ? "line-through text-muted-foreground"
                        : ""
                    }`}
                  >
                    {item}
                  </label>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
