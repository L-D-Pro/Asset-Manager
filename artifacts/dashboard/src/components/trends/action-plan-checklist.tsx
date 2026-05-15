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
        <CardTitle>
          <Target />
          Action Plan
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sections.map((section) => (
          <div key={section.title}>
            <h4>{section.title}</h4>
            <div>
              {section.items.map((item) => (
                <div key={item}>
                  <Checkbox
                    id={item}
                    checked={checked.has(item)}
                    onCheckedChange={() => toggle(item)}
                  />
                  <label htmlFor={item}>
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
