import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/status")({ component: StatusPage });

type Row = {
  id: string;
  crm_number: string;
  customer_name: string;
  project_name: string;
  opportunity_type: string;
  status: string;
  deadline: string | null;
};

function StatusPage() {
  const { isVp, isSales, isAdmin, loading } = useAuth();
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState("all");

  const oppsQ = useQuery({
    queryKey: ["status-opps"],
    enabled: isVp || isSales || isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("opportunities")
        .select("id, crm_number, customer_name, project_name, opportunity_type, status, deadline")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  if (loading) return null;
  if (!isVp && !isSales && !isAdmin) return <Navigate to="/dashboard" replace />;

  const filtered = (oppsQ.data ?? []).filter((o) => {
    if (statusF !== "all" && o.status !== statusF) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      o.customer_name.toLowerCase().includes(s) ||
      o.project_name.toLowerCase().includes(s) ||
      o.crm_number.toLowerCase().includes(s)
    );
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Status</h1>
        <p className="text-sm text-muted-foreground">Read-only view of opportunity status.</p>
      </header>

      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search customer, project, CRM…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusF} onValueChange={setStatusF}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="In Progress">In Progress</SelectItem>
            <SelectItem value="On Hold">On Hold</SelectItem>
            <SelectItem value="Submitted to Sales">Submitted to Sales</SelectItem>
            <SelectItem value="Completed">Completed</SelectItem>
            <SelectItem value="Closed Won">Closed Won</SelectItem>
            <SelectItem value="Closed Lost">Closed Lost</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm select-none">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium">CRM ID</th>
                <th className="text-left px-4 py-2.5 font-medium">Customer Name</th>
                <th className="text-left px-4 py-2.5 font-medium">Project Name</th>
                <th className="text-left px-4 py-2.5 font-medium">Type</th>
                <th className="text-left px-4 py-2.5 font-medium">Status</th>
                <th className="text-left px-4 py-2.5 font-medium">Approx Submission</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-t border-border">
                  <td className="px-4 py-2.5 font-mono text-xs">{o.crm_number}</td>
                  <td className="px-4 py-2.5">{o.customer_name}</td>
                  <td className="px-4 py-2.5">{o.project_name}</td>
                  <td className="px-4 py-2.5"><Badge variant="secondary">{o.opportunity_type}</Badge></td>
                  <td className="px-4 py-2.5">{o.status}</td>
                  <td className="px-4 py-2.5">{o.deadline ?? "—"}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground text-sm">
                    {oppsQ.isLoading ? "Loading…" : "No opportunities."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
