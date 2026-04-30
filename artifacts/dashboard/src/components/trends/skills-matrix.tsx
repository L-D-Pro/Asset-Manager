import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Wrench } from "lucide-react";
import type { MarketAnalysis } from "@workspace/api-client-react";

interface SkillsMatrixProps {
  skills: MarketAnalysis["requiredSkills"];
}

export function SkillsMatrix({ skills }: SkillsMatrixProps) {
  const categories: Record<string, string> = {
    technical: "Technical",
    soft: "Soft Skills",
    domain: "Domain Knowledge",
  };

  const frequencyColors: Record<string, string> = {
    required: "bg-red-100 text-red-800",
    common: "bg-blue-100 text-blue-800",
    "nice-to-have": "bg-gray-100 text-gray-800",
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          Skills in Demand
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {(Object.keys(categories) as Array<keyof typeof categories>).map(
            (cat) => {
              const catSkills = skills.filter((s) => s.category === cat);
              if (catSkills.length === 0) return null;
              return (
                <div key={cat}>
                  <h4 className="text-sm font-semibold mb-2">
                    {categories[cat]}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {catSkills.map((skill) => (
                      <Badge
                        key={skill.skill}
                        className={frequencyColors[skill.frequency]}
                      >
                        {skill.skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            },
          )}
        </div>
      </CardContent>
    </Card>
  );
}
