import { type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useAiProgress } from "@/hooks/use-ai-progress";

interface AiProgressButtonProps extends Omit<ButtonProps, "children"> {
 isPending: boolean;
 idleLabel: ReactNode;
 connectingVerb?: string;
 generatingVerb?: string;
 finalizingVerb?: string;
 connectingLabel?: string;
 generatingLabel?: string;
 finalizingLabel?: string;
 showProgressBar?: boolean;
 icon?: ReactNode;
 wrapperClassName?: string;
 progressClassName?: string;
}

export function AiProgressButton({
 isPending,
 idleLabel,
 connectingVerb = "Connecting",
 generatingVerb = "Generating",
 finalizingVerb = "Finalizing",
 connectingLabel = "Connecting to model",
 generatingLabel = "Model is generating",
 finalizingLabel = "Wrapping up",
 showProgressBar = true,
 icon = <Sparkles className="mr-2 h-4 w-4" />,
 wrapperClassName,
 progressClassName,
 className,
 ...buttonProps
}: AiProgressButtonProps) {
 const { progress, phase } = useAiProgress(isPending);

 return (
 <div className={cn("flex flex-col gap-2", wrapperClassName)}>
 <Button {...buttonProps} className={className} disabled={buttonProps.disabled || isPending}>
 {icon}
 {isPending
 ? `${phase === "connecting" ? connectingVerb : phase === "generating" ? generatingVerb : finalizingVerb} ${progress}%`
 : idleLabel}
 </Button>
 {isPending && showProgressBar && (
 <div className="space-y-1">
 <div className="flex items-center justify-between text-[11px] text-muted-foreground">
 <span>
 {phase === "connecting"
 ? connectingLabel
 : phase === "generating"
 ? generatingLabel
 : finalizingLabel}
 </span>
 <span>{progress}%</span>
 </div>
 <Progress value={progress} className={progressClassName ?? "h-1.5"} />
 </div>
 )}
 </div>
 );
}
