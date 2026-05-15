import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

function Tabs({ ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return <TabsPrimitive.Root {...props} />;
}

function TabsList({ ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
  return <TabsPrimitive.List {...props} />;
}

function TabsTrigger({ ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return <TabsPrimitive.Trigger {...props} />;
}

function TabsContent({ ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return <TabsPrimitive.Content {...props} />;
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
