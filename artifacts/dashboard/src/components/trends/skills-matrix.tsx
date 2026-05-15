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
        <CardTitle>
          <Wrench />
          Skills in Demand
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div>
          {(Object.keys(categories) as Array<keyof typeof categories>).map(
            (cat) => {
              const catSkills = skills.filter((s) => s.category === cat);
              if (catSkills.length === 0) return null;
              return (
                <div key={cat}>
                  <h4>{categories[cat]}</h4>
                  <div>
                    {catSkills.map((skill) => (
                      <Badge key={skill.skill}>
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
