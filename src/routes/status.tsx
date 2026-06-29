import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState } from "react";
import consystLogo from "@/assets/consyst-logo.png";

export const Route = createFileRoute("/status")({
  head: () => ({
    meta: [
      { title: "Opportunity Status — Consyst TeamSync" },
      { name: "description", content: "Public read-only status board of opportunities." },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: StatusPage,
});

type Row = {
  id: string;
  crm_number: string;
  customer_name: string;
  project_name: string;
  opportunity_type: string;
  status: string;
  approx_submission_date: string | null;
};

function StatusPage() {
  const [search, setSearch] = useState("");
  const q = useQuery({
    queryKey: ["status-board"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_status_board");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const rows = (q.data ?? []).filter((o) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      o.crm_number?.toLowerCase().includes(s) ||
      o.customer_name?.toLowerCase().includes(s) ||
      o.project_name?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 flex items-center gap-3">
          <img src={consystLogo} alt="Consyst" className="h-7 w-auto object-contain" />
          <div className="min-w-0">
            <div className="text-sm font-semibold leading-tight">Opportunity Status</div>
            <div className="text-[11px] text-muted-foreground">Public read-only view</div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search customer, project, CRM…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="text-xs text-muted-foreground">{rows.length} opportunities</div>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">CRM ID</th>
                  <th className="text-left px-4 py-2.5 font-medium">Customer Name</th>
                  <th className="text-left px-4 py-2.5 font-medium">Project name</th>
                  <th className="text-left px-4 py-2.5 font-medium">Type</th>
                  <th className="text-left px-4 py-2.5 font-medium">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium">Approx Submission</th>
                </tr>
              </thead>
              <tbody>
                {q.isLoading && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                )}
                {!q.isLoading &&
                  rows.map((o) => (
                    <tr key={o.id} className="border-t border-border select-none">
                      <td className="px-4 py-2.5 font-mono text-xs">{o.crm_number}</td>
                      <td className="px-4 py-2.5">{o.customer_name}</td>
                      <td className="px-4 py-2.5">{o.project_name}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant="secondary">{o.opportunity_type}</Badge>
                      </td>
                      <td className="px-4 py-2.5">{o.status}</td>
                      <td className="px-4 py-2.5">{o.approx_submission_date ?? "—"}</td>
                    </tr>
                  ))}
                {!q.isLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                      No opportunities.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </div>
  );
}
