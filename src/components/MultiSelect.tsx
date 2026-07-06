import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface MultiSelectOption {
  label: string;
  value: string;
}

interface Props {
  options: MultiSelectOption[];
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({ options, value, onChange, placeholder = "All", className }: Props) {
  const toggle = (v: string) => {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  };
  const label =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? options.find((o) => o.value === value[0])?.label ?? value[0]
        : `${value.length} selected`;
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className={cn("justify-between font-normal", className)}>
          <span className="truncate">{label}</span>
          <ChevronDown className="h-4 w-4 opacity-50 ml-2 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-1 w-56" align="start">
        {value.length > 0 && (
          <button
            type="button"
            onClick={() => onChange([])}
            className="w-full text-left text-xs px-2 py-1 rounded hover:bg-muted text-muted-foreground"
          >
            Clear all
          </button>
        )}
        {options.map((o) => {
          const active = value.includes(o.value);
          return (
            <button
              type="button"
              key={o.value}
              onClick={() => toggle(o.value)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-muted text-left"
            >
              <div
                className={cn(
                  "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                  active ? "bg-primary border-primary text-primary-foreground" : "border-input",
                )}
              >
                {active && <Check className="h-3 w-3" />}
              </div>
              <span className="truncate">{o.label}</span>
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}
