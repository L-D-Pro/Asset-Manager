import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PromptTab } from "./tabs/PromptTab";
import { RoleTab } from "./tabs/RoleTab";
import { ModelTab } from "./tabs/ModelTab";
import { BestPracticesTab } from "./tabs/BestPracticesTab";
import { ExamplesTab } from "./tabs/ExamplesTab";

interface AiTaskDetailPanelProps {
  taskScope: string;
}

export function AiTaskDetailPanel({ taskScope }: AiTaskDetailPanelProps) {
  return (
    <Tabs defaultValue="prompt" className="w-full">
      <TabsList className="flex-wrap gap-1">
        <TabsTrigger value="prompt">Prompt</TabsTrigger>
        <TabsTrigger value="role">Role</TabsTrigger>
        <TabsTrigger value="model">Model</TabsTrigger>
        <TabsTrigger value="best-practices">Best Practices</TabsTrigger>
        <TabsTrigger value="examples">Examples</TabsTrigger>
      </TabsList>
      <TabsContent value="prompt" className="mt-4">
        <PromptTab taskScope={taskScope} />
      </TabsContent>
      <TabsContent value="role" className="mt-4">
        <RoleTab taskScope={taskScope} />
      </TabsContent>
      <TabsContent value="model" className="mt-4">
        <ModelTab taskScope={taskScope} />
      </TabsContent>
      <TabsContent value="best-practices" className="mt-4">
        <BestPracticesTab taskScope={taskScope} />
      </TabsContent>
      <TabsContent value="examples" className="mt-4">
        <ExamplesTab taskScope={taskScope} />
      </TabsContent>
    </Tabs>
  );
}
