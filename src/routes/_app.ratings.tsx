import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";
import { Star, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/_app/ratings")({ component: RatingsPage });

type Opp = { id: string; customer_name: string; project_name: string; status: string };
type Assign = { opportunity_id: string; user_id: string };
type Rating = { id: string; opportunity_id: string };
type Answer = { rating_id: string; score: number };
type Profile = { id: string; full_name: string | null; email: string | null };

function RatingsPage() {
  const [selectedArchitect, setSelectedArchitect] = useState<string | null>(null);

  const oppsQ = useQuery({
    queryKey: ["ratings-opps"],
    queryFn: async () => {
      const { data } = await supabase.from("opportunities").select("id, customer_name, project_name, status");
      return (data ?? []) as Opp[];
    },
  });
  const assignsQ = useQuery({
    queryKey: ["ratings-assigns"],
    queryFn: async () => {
      const { data } = await supabase.from("opportunity_architects").select("opportunity_id, user_id");
      return (data ?? []) as Assign[];
    },
  });
  const ratingsQ = useQuery({
    queryKey: ["ratings-all"],
    queryFn: async () => {
      const { data } = await supabase.from("ratings").select("id, opportunity_id");
      return (data ?? []) as Rating[];
    },
  });
  const answersQ = useQuery({
    queryKey: ["ratings-answers-all"],
    queryFn: async () => {
      const { data } = await supabase.from("rating_answers").select("rating_id, score");
      return (data ?? []) as Answer[];
    },
  });
  const profilesQ = useQuery({
    queryKey: ["ratings-profiles"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id, role").eq("role", "architect");
      const ids = (roles ?? []).map((r: any) => r.user_id);
      if (!ids.length) return [] as Profile[];
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", ids);
      return (data ?? []) as Profile[];
    },
  });

  // avg score per opportunity, converted to 5-point scale (raw 1-10 avg / 2)
  const oppAvg = useMemo(() => {
    const byRating: Record<string, number[]> = {};
    (answersQ.data ?? []).forEach((a) => (byRating[a.rating_id] ||= []).push(a.score));
    const byOpp: Record<string, number[]> = {};
    (ratingsQ.data ?? []).forEach((r) => {
      const scores = byRating[r.id] ?? [];
      if (scores.length) {
        const avg = scores.reduce((s, n) => s + n, 0) / scores.length;
        (byOpp[r.opportunity_id] ||= []).push(avg);
      }
    });
    const out: Record<string, { avg: number; reviews: number }> = {};
    Object.entries(byOpp).forEach(([oid, arr]) => {
      const raw10 = arr.reduce((a, b) => a + b, 0) / arr.length;
      out[oid] = {
        avg: Math.round((raw10 / 2) * 10) / 10,
        reviews: arr.length,
      };
    });
    return out;
  }, [ratingsQ.data, answersQ.data]);
    const out: Record<string, { avg: number; reviews: number }> = {};
    Object.entries(byOpp).forEach(([oid, arr]) => {
      out[oid] = {
        avg: Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10,
        reviews: arr.length,
      };
    });
    return out;
  }, [ratingsQ.data, answersQ.data]);

  if (selectedArchitect) {
    return (
      <ArchitectDetail
        architectId={selectedArchitect}
        onBack={() => setSelectedArchitect(null)}
        opps={oppsQ.data ?? []}
        assigns={assignsQ.data ?? []}
        oppAvg={oppAvg}
        profile={(profilesQ.data ?? []).find((p) => p.id === selectedArchitect) ?? null}
      />
    );
  }

  // architect summary rows
  const rows = (profilesQ.data ?? []).map((p) => {
    const oppIds = (assignsQ.data ?? []).filter((a) => a.user_id === p.id).map((a) => a.opportunity_id);
    const rated = oppIds.map((id) => oppAvg[id]).filter(Boolean) as { avg: number; reviews: number }[];
    const avg = rated.length
      ? Math.round((rated.reduce((s, r) => s + r.avg, 0) / rated.length) * 10) / 10
      : 0;
    const reviews = rated.reduce((s, r) => s + r.reviews, 0);
    return { ...p, opps: oppIds.length, ratedOpps: rated.length, avg, reviews };
  }).sort((a, b) => b.avg - a.avg);

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Architect Ratings</h1>
        <p className="text-sm text-muted-foreground">VP review scores per architect. Click an architect to see their opportunity scores.</p>
      </header>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Architect</th>
                <th className="text-left px-4 py-2.5 font-medium">Opportunities</th>
                <th className="text-left px-4 py-2.5 font-medium">Rated</th>
                <th className="text-left px-4 py-2.5 font-medium">Reviews</th>
                <th className="text-left px-4 py-2.5 font-medium">Avg score</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-border hover:bg-muted/30 cursor-pointer"
                  onClick={() => setSelectedArchitect(r.id)}
                >
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{r.full_name || r.email}</div>
                    <div className="text-xs text-muted-foreground">{r.email}</div>
                  </td>
                  <td className="px-4 py-2.5">{r.opps}</td>
                  <td className="px-4 py-2.5">{r.ratedOpps}</td>
                  <td className="px-4 py-2.5">{r.reviews}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1 font-medium ${r.avg > 0 && r.avg < 8 ? "text-destructive" : ""}`}>
                      <Star className="h-3.5 w-3.5" />{r.avg || "—"}
                    </span>
                    {r.avg > 0 && r.avg < 8 && <Badge variant="destructive" className="ml-2">Below threshold</Badge>}
                  </td>
                  <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">View →</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground text-sm">No architects yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function ArchitectDetail({
  architectId, onBack, opps, assigns, oppAvg, profile,
}: {
  architectId: string;
  onBack: () => void;
  opps: Opp[];
  assigns: Assign[];
  oppAvg: Record<string, { avg: number; reviews: number }>;
  profile: Profile | null;
}) {
  const myOppIds = new Set(assigns.filter((a) => a.user_id === architectId).map((a) => a.opportunity_id));
  const myOpps = opps.filter((o) => myOppIds.has(o.id));
  const overall = (() => {
    const rated = myOpps.map((o) => oppAvg[o.id]).filter(Boolean) as { avg: number; reviews: number }[];
    if (!rated.length) return 0;
    return Math.round((rated.reduce((s, r) => s + r.avg, 0) / rated.length) * 10) / 10;
  })();

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <Button variant="ghost" size="sm" onClick={onBack} className="mb-4 -ml-2">
        <ArrowLeft className="h-4 w-4 mr-1" /> All architects
      </Button>

      <header className="mb-6 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{profile?.full_name || profile?.email || "Architect"}</h1>
          <p className="text-sm text-muted-foreground">{profile?.email}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Overall avg</div>
          <div className={`text-2xl font-semibold inline-flex items-center gap-1 ${overall > 0 && overall < 8 ? "text-destructive" : ""}`}>
            <Star className="h-5 w-5" />{overall || "—"}
          </div>
        </div>
      </header>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Opportunity</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Reviews</th>
                <th className="text-left px-4 py-2.5 font-medium">Score</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {myOpps.map((o) => {
                const r = oppAvg[o.id];
                return (
                  <tr key={o.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{o.project_name}</div>
                      <div className="text-xs text-muted-foreground">{o.customer_name}</div>
                    </td>
                    <td className="px-4 py-2.5"><Badge variant="secondary">{o.status}</Badge></td>
                    <td className="px-4 py-2.5">{r?.reviews ?? 0}</td>
                    <td className="px-4 py-2.5">
                      {r ? (
                        <span className={`inline-flex items-center gap-1 font-medium ${r.avg < 8 ? "text-destructive" : ""}`}>
                          <Star className="h-3.5 w-3.5" />{r.avg}
                        </span>
                      ) : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link to="/opportunities/$id" params={{ id: o.id }} className="text-accent text-xs hover:underline">Open</Link>
                    </td>
                  </tr>
                );
              })}
              {myOpps.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground text-sm">No opportunities assigned to this architect.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
