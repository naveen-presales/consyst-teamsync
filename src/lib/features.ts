export type FeatureKey = "vendor_enquiries" | "status_board";

export interface FeatureDef {
  key: FeatureKey;
  label: string;
  description: string;
  /** Route prefix under the authenticated app shell owned by this feature. */
  routePrefix?: string;
}

export const FEATURES: readonly FeatureDef[] = [
  {
    key: "vendor_enquiries",
    label: "Vendor enquiries",
    description:
      "Vendor enquiry tracking: the sidebar page, vendor pages and the Vendor enquiries tab on each opportunity.",
    routePrefix: "/vendor-enquiries",
  },
  {
    key: "status_board",
    label: "Status board",
    description:
      "The public read-only status page, its sidebar entry and the Share status link button.",
  },
];

export type FeatureFlags = Record<FeatureKey, boolean>;

export const FEATURE_SETTING_KEY = "features";
export const FEATURES_QUERY_KEY = ["app-setting", FEATURE_SETTING_KEY] as const;

export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  vendor_enquiries: false,
  status_board: false,
};

export function parseFeatureFlags(raw: unknown): FeatureFlags {
  const out: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS };
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const f of FEATURES) {
      const v = (raw as Record<string, unknown>)[f.key];
      if (typeof v === "boolean") out[f.key] = v;
    }
  }
  return out;
}
