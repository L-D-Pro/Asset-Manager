import { useState } from "react";
import { PromptTab } from "./tabs/PromptTab";
import { RoleTab } from "./tabs/RoleTab";
import { ModelTab } from "./tabs/ModelTab";
import { BestPracticesTab } from "./tabs/BestPracticesTab";
import { ExamplesTab } from "./tabs/ExamplesTab";

const TABS = [
  { id: "prompt",         label: "Prompt" },
  { id: "role",           label: "Role" },
  { id: "model",          label: "Model" },
  { id: "best-practices", label: "Best practices" },
  { id: "examples",       label: "Examples" },
];

interface AiTaskDetailPanelProps {
  taskScope: string;
}

export function AiTaskDetailPanel({ taskScope }: AiTaskDetailPanelProps) {
  const [active, setActive] = useState("prompt");

  return (
    <div>
      <div className="tabs" style={{ padding: "0 18px", borderBottom: "1px solid var(--line-soft)" }}>
        {TABS.map((t) => (
          <div
            key={t.id}
            className={`tab${active === t.id ? " active" : ""}`}
            onClick={() => setActive(t.id)}
          >
            {t.label}
          </div>
        ))}
      </div>
      <div style={{ padding: "18px 20px" }}>
        {active === "prompt"         && <PromptTab taskScope={taskScope} />}
        {active === "role"           && <RoleTab taskScope={taskScope} />}
        {active === "model"          && <ModelTab taskScope={taskScope} />}
        {active === "best-practices" && <BestPracticesTab taskScope={taskScope} />}
        {active === "examples"       && <ExamplesTab taskScope={taskScope} />}
      </div>
    </div>
  );
}
