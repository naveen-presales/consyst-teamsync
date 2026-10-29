import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_FEATURE_FLAGS,
  FEATURES_QUERY_KEY,
  FEATURE_SETTING_KEY,
  parseFeatureFlags,
  type FeatureKey,
} from "@/lib/features";

/** Reads the flags. Missing row / error => defaults (all OFF). Never throws to the UI. */
export function useFeatures() {
  const q = useQuery({
    queryKey: FEATURES_QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", FEATURE_SETTING_KEY)
        .maybeSingle();
      if (error) throw error;
      return parseFeatureFlags(data?.value);
    },
    staleTime: 30_000,
    retry: 1,
    refetchOnWindowFocus: true,
  });
  const flags = q.data ?? DEFAULT_FEATURE_FLAGS;
  return {
    flags,
    loading: q.isLoading,
    isEnabled: (key: FeatureKey) => flags[key] === true,
  };
}

export function useFeature(key: FeatureKey) {
  const { isEnabled, loading } = useFeatures();
  return { enabled: isEnabled(key), loading };
}

/** Call ONCE (in AppLayout). Live-updates flags in open sessions when a switch is flipped. */
export function useFeaturesRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const channel = supabase
      .channel(`feature-flags-${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings", filter: `key=eq.${FEATURE_SETTING_KEY}` },
        () => {
          qc.invalidateQueries({ queryKey: FEATURES_QUERY_KEY });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
