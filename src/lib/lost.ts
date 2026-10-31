export const LOST_CATEGORIES = [
  { value: "price", label: "Lost on price" },
  { value: "other", label: "Lost for other reasons" },
] as const;

export type LostCategory = (typeof LOST_CATEGORIES)[number]["value"];

export const lostCategoryLabel = (v: string | null | undefined) =>
  LOST_CATEGORIES.find((c) => c.value === v)?.label ?? "Lost";

export const HOLD_CLEAR = {
  on_hold: false,
  hold_reason: null,
  hold_started_at: null,
  pre_hold_status: null,
};

export const LOST_CLEAR = {
  lost_category: null,
  lost_reason: null,
  lost_at: null,
};
