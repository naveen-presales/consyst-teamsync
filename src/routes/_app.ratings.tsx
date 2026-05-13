import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMemo } from "react";
import { Star } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/ratings")({ component: RatingsPage });

function RatingsPage() {
  const oppsQ = useQuery({
    queryKey: ["ratings-opps"],
    queryFn: async () => {
      const { data } = await supabase.from("opportunities").select("id, customer_name, project_name, status");
      return (data ?? []) as { id: string; customer_name: string; project_name: string; status: string }[];
    },
  });
  const ratingsQ = useQuery({
    queryKey: ["ratings-all"],
    queryFn: async () => {
      const { data } = await supabase.from("ratings").select("id, opportunity_id, vp_user_id");
      return (data ?? []) as { id: string; opportunity_id: string; vp_user_id: string }[];
    },
  });
  const answersQ = useQuery({
    queryKey: ["ratings-answers-all"],
    queryFn: async () => {
      const { data } = await supabase.from("rating_answers").select("rating_id, score");
      return (data ?? []) as { rating_id: string; score: number }[];
    },
  });

  const rows = useMemo(() => {
    const completed = (oppsQ.data ?? []).filter((o) => o.status === "Completed");
    return completed.map((o) => {
      const ratings = (ratingsQ.data ?? []).filter((r) => r.opportunity_id === o.id);
      const scores = (answersQ.data ?? []).filter((a) => ratings.find((r) => r.id === a.rating_id)).map((a) => a.score);
      const avg = scores.length ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
      return { ...o, ratingsCount: ratings.length, avg };
    });
  }, [oppsQ.data, ratingsQ.data, answersQ.data]);

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">VP Ratings</h1>
        <p className="text-sm text-muted-foreground">Completed opportunities and their VP review scores.</p>
      </header>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">Opportunity</th>
                <th className="text-left px-4 py-2.5 font-medium">Reviews</th>
                <th className="text-left px-4 py-2.5 font-medium">Avg</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{r.project_name}</div>
                    <div className="text-xs text-muted-foreground">{r.customer_name}</div>
                  </td>
                  <td className="px-4 py-2.5">{r.ratingsCount}</td>
                  <td className="px-4 py-2.5">
                    <span className={`inline-flex items-center gap-1 font-medium ${r.avg > 0 && r.avg < 4 ? "text-destructive" : ""}`}>
                      <Star className="h-3.5 w-3.5" />{r.avg || "—"}
                    </span>
                    {r.avg > 0 && r.avg < 4 && <Badge variant="destructive" className="ml-2">Below threshold</Badge>}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Link to="/opportunities/$id" params={{ id: r.id }} className="text-accent text-xs hover:underline">Open</Link>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground text-sm">No completed opportunities yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
