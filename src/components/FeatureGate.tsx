import { ReactNode, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useFeature, useFeatures } from "@/hooks/use-features";
import { FEATURES, type FeatureKey } from "@/lib/features";

/** Renders children only when the feature is ON. Renders nothing while loading or when OFF. */
export function FeatureGate({ feature, children }: { feature: FeatureKey; children: ReactNode }) {
  const { enabled, loading } = useFeature(feature);
  if (loading || !enabled) return null;
  return <>{children}</>;
}

/** Wraps the routed page content in AppLayout. Pages owned by a feature that is OFF are never mounted. */
export function FeatureRouteGuard({ pathname, children }: { pathname: string; children: ReactNode }) {
  const { isEnabled, loading } = useFeatures();
  const navigate = useNavigate();
  const owner = FEATURES.find(
    (f) => f.routePrefix && (pathname === f.routePrefix || pathname.startsWith(f.routePrefix + "/")),
  );
  const blocked = !!owner && !loading && !isEnabled(owner.key);
  useEffect(() => {
    if (blocked) navigate({ to: "/dashboard", replace: true });
  }, [blocked, navigate]);
  if (owner && (loading || blocked)) return null;
  return <>{children}</>;
}
