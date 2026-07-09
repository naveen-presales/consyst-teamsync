import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type Priority = "Low" | "Medium" | "High";

const STYLES: Record<Priority, string> = {
  High: "bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400",
  Medium: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400",
  Low: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400",
};

export function PriorityBadge({ value, className }: { value?: string | null; className?: string }) {
  const v = (value ?? "Medium") as Priority;
  const style = STYLES[v] ?? STYLES.Medium;
  return (
    <Badge
      variant="outline"
      className={cn("h-4 px-1.5 text-[10px] leading-none font-medium", style, className)}
    >
      {v}
    </Badge>
  );
}

export const PRIORITY_OPTIONS: Priority[] = ["Low", "Medium", "High"];

export const PRIORITY_RANK: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 };
