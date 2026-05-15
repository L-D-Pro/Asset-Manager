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
    <Tabs defaultValue="prompt">
      <TabsList>
        <TabsTrigger value="prompt">Prompt</TabsTrigger>
        <TabsTrigger value="role">Role</TabsTrigger>
        <TabsTrigger value="model">Model</TabsTrigger>
        <TabsTrigger value="best-practices">Best Practices</TabsTrigger>
        <TabsTrigger value="examples">Examples</TabsTrigger>
      </TabsList>
      <TabsContent value="prompt">
        <PromptTab taskScope={taskScope} />
      </TabsContent>
      <TabsContent value="role">
        <RoleTab taskScope={taskScope} />
      </TabsContent>
      <TabsContent value="model">
        <ModelTab taskScope={taskScope} />
      </TabsContent>
      <TabsContent value="best-practices">
        <BestPracticesTab taskScope={taskScope} />
      </TabsContent>
      <TabsContent value="examples">
        <ExamplesTab taskScope={taskScope} />
      </TabsContent>
    </Tabs>
  );
}
