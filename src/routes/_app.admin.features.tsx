import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useFeatures } from "@/hooks/use-features";
import { FEATURES, FEATURE_SETTING_KEY, parseFeatureFlags, type FeatureKey } from "@/lib/features";
import type { Json } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_app/admin/features")({
  head: () => ({
    meta: [
      { title: "Features — TeamSync" },
      { name: "description", content: "Turn optional TeamSync features on or off for everyone." },
      { property: "og:title", content: "Features — TeamSync" },
      { property: "og:description", content: "Turn optional TeamSync features on or off for everyone." },
    ],
  }),
  component: FeaturesPage,
});

function FeaturesPage() {
  const { isAdmin, isVp } = useAuth();
  const { flags, loading } = useFeatures();
  const qc = useQueryClient();
  const [pending, setPending] = useState<FeatureKey | null>(null);

  if (!(isAdmin || isVp)) return <Navigate to="/dashboard" replace />;

  const setFlag = async (key: FeatureKey, enabled: boolean) => {
    const label = FEATURES.find((f) => f.key === key)?.label ?? key;
    setPending(key);
    try {
      // Fresh read so other flags are never overwritten.
      const { data: cur } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", FEATURE_SETTING_KEY)
        .maybeSingle();
      const next = { ...parseFeatureFlags(cur?.value), [key]: enabled };
      const { error } = await supabase.from("app_settings").upsert(
        { key: FEATURE_SETTING_KEY, value: next as unknown as Json, updated_at: new Date().toISOString() },
        { onConflict: "key" },
      );
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(`${label} turned ${enabled ? "on" : "off"}`);
      }
      await qc.invalidateQueries({ queryKey: ["app-setting", FEATURE_SETTING_KEY] });
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight">Features</h1>
      <p className="text-sm text-muted-foreground mt-1">
        Turn optional features on or off for everyone. Turning a feature off hides it and blocks access to it. No data
        is deleted.
      </p>

      <Card className="divide-y mt-6">
        {FEATURES.map((f) => (
          <div key={f.key} className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="font-medium text-sm">{f.label}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{f.description}</div>
            </div>
            <Switch
              checked={flags[f.key]}
              disabled={loading || pending !== null}
              onCheckedChange={(v) => setFlag(f.key, v)}
            />
          </div>
        ))}
      </Card>
    </div>
  );
}
