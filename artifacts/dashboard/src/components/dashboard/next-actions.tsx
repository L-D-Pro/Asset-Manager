import { useQuery } from "@tanstack/react-query";
import { ArrowRight, FileText, Target, ClipboardList, Wand2 } from "lucide-react";
import { Link } from "react-router-dom";

interface NextAction {
  id: string;
  title: string;
  description: string;
  href: string;
  priority: number;
  category: "setup" | "action" | "review";
}

const CATEGORY_ICONS = {
  setup: FileText,
  action: Target,
  review: ClipboardList,
};

const CATEGORY_COLORS = {
  setup: "from-amber-500/20 to-orange-500/10",
  action: "from-primary/20 to-accent/10",
  review: "from-emerald-500/20 to-teal-500/10",
};

async function apiGet(path: string) {
  const res = await fetch(`/api${path}`, { credentials: "include" });
  if (!res.ok) throw new Error(`GET ${path} failed`);
  return res.json();
}

export function NextActions() {
  const { data, isLoading } = useQuery<{ actions: NextAction[] }>({
    queryKey: ["next-actions"],
    queryFn: () => apiGet("/gamification/next-actions"),
  });

  if (isLoading) {
    return (
      <div>
        {[1, 2, 3].map((i) => (
          <div key={i}>Loading...</div>
        ))}
      </div>
    );
  }

  const actions = data?.actions ?? [];

  if (actions.length === 0) {
    return (
      <div>
        <Wand2 />
        <h3>You&apos;re all caught up!</h3>
        <p>
          Check out Trends or ingest a new job to keep momentum.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h2>What&apos;s Next?</h2>
      <div>
        {actions.map((action) => {
          const Icon = CATEGORY_ICONS[action.category];
          return (
            <div key={action.id}>
              <Link to={action.href}>
                <div>
                  <div>
                    <Icon />
                  </div>
                  <ArrowRight />
                </div>
                <h3>{action.title}</h3>
                <p>{action.description}</p>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
