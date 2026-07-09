import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search } from "lucide-react";
import { useState } from "react";
import consystLogo from "@/assets/consyst-logo.png";
import { MultiSelect } from "@/components/MultiSelect";
import { PriorityBadge, PRIORITY_RANK, type Priority } from "@/components/PriorityBadge";


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
  has_architect: boolean | null;
  architect_names: string | null;
};

const STATUS_FILTER_OPTIONS = [
  { label: "Pending", value: "Pending" },
  { label: "In Progress", value: "In Progress" },
  { label: "Waiting for Clarification", value: "Waiting for Clarification" },
  { label: "Submitted to Sales", value: "Submitted to Sales" },
  { label: "Closed Won", value: "Closed Won" },
  { label: "Closed Lost", value: "Closed Lost" },
];

const cmpCrm = (a: string, b: string) =>
  (a ?? "").localeCompare(b ?? "", undefined, { numeric: true, sensitivity: "base" });

function StatusPage() {
  const [search, setSearch] = useState("");
  const [statusF, setStatusF] = useState<string[]>([]);
  const [architectF, setArchitectF] = useState<string[]>([]);
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [sortBy, setSortBy] = useState<"crm" | "architect" | "architect_desc">("crm");

  const q = useQuery({
    queryKey: ["status-board"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_status_board");
      if (error) throw error;
      return ((data ?? []) as unknown) as Row[];
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const lastUploadQ = useQuery({
    queryKey: ["app-setting", "last_excel_upload_at"],
    queryFn: async () => {
      const { data } = await supabase
        .from("app_settings")
        .select("value, updated_at")
        .eq("key", "last_excel_upload_at")
        .maybeSingle();
      const raw = (data?.value as any) ?? data?.updated_at ?? null;
      return typeof raw === "string" ? raw : null;
    },
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const formatUploadedAt = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (isNaN(d.getTime())) return null;
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const allRows = q.data ?? [];

  const architectOptions = (() => {
    const set = new Set<string>();
    allRows.forEach((r) => {
      (r.architect_names ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((n) => set.add(n));
    });
    return Array.from(set).sort().map((n) => ({ label: n, value: n }));
  })();

  let rows = allRows.filter((o) => {
    if (statusF.length > 0 && !statusF.includes(o.status)) return false;
    if (unassignedOnly && o.has_architect) return false;
    if (architectF.length > 0) {
      const names = (o.architect_names ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      if (!architectF.some((f) => names.includes(f))) return false;
    }
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      o.crm_number?.toLowerCase().includes(s) ||
      o.customer_name?.toLowerCase().includes(s) ||
      o.project_name?.toLowerCase().includes(s) ||
      (o.architect_names ?? "").toLowerCase().includes(s)
    );
  });

  if (sortBy === "architect" || sortBy === "architect_desc") {
    const dir = sortBy === "architect" ? 1 : -1;
    rows = rows.slice().sort((a, b) => {
      const an = (a.architect_names || "~");
      const bn = (b.architect_names || "~");
      return an.localeCompare(bn) * dir;
    });
  } else {
    rows = rows.slice().sort((a, b) => cmpCrm(a.crm_number, b.crm_number));
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 flex items-center gap-3">
          <img src={consystLogo} alt="Consyst" className="h-9 w-auto shrink-0 object-contain" />
          <div className="min-w-0 flex-1">
            <div className="text-base font-bold leading-tight tracking-tight truncate">TeamSync</div>
            <div className="text-[11px] text-muted-foreground">Opportunity Status</div>
          </div>
          {lastUploadQ.data && (
            <div className="text-[11px] text-muted-foreground text-right shrink-0">
              Last upload on {formatUploadedAt(lastUploadQ.data)}
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 md:px-6 py-6">
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search customer, project, CRM, architect…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <MultiSelect
            className="w-44"
            options={STATUS_FILTER_OPTIONS}
            value={statusF}
            onChange={setStatusF}
            placeholder="All statuses"
          />
          <MultiSelect
            className="w-52"
            options={architectOptions}
            value={architectF}
            onChange={setArchitectF}
            placeholder="All architects"
          />
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground select-none cursor-pointer">
            <input type="checkbox" className="h-3.5 w-3.5" checked={unassignedOnly} onChange={(e) => setUnassignedOnly(e.target.checked)} />
            Unassigned only
          </label>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-44 h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="crm">Sort: CRM ID</SelectItem>
              <SelectItem value="architect">Sort: Architect A→Z</SelectItem>
              <SelectItem value="architect_desc">Sort: Architect Z→A</SelectItem>
            </SelectContent>
          </Select>
          <div className="text-xs text-muted-foreground ml-auto">{rows.length} opportunities</div>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-2.5 font-medium">CRM ID</th>
                  <th className="text-left px-4 py-2.5 font-medium">Customer Name</th>
                  <th className="text-left px-4 py-2.5 font-medium">Project name</th>
                  <th className="text-left px-4 py-2.5 font-medium">Architect Name</th>
                  <th className="text-left px-4 py-2.5 font-medium">Type</th>
                  <th className="text-left px-4 py-2.5 font-medium">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium">Approx Submission</th>
                </tr>
              </thead>
              <tbody>
                {q.isLoading && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                      Loading…
                    </td>
                  </tr>
                )}
                {!q.isLoading &&
                  rows.map((o) => (
                    <tr key={o.id} className="border-t border-border select-none">
                      <td className="px-4 py-2.5 font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          <span>{o.crm_number}</span>
                          {!o.has_architect && (
                            <Badge className="h-4 px-1.5 text-[10px] leading-none">New</Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">{o.customer_name}</td>
                      <td className="px-4 py-2.5">{o.project_name}</td>
                      <td className="px-4 py-2.5 text-xs">
                        {o.architect_names
                          ? o.architect_names
                          : <span className="text-muted-foreground">Unassigned</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="secondary">{o.opportunity_type}</Badge>
                      </td>
                      <td className="px-4 py-2.5">{o.status}</td>
                      <td className="px-4 py-2.5">{o.approx_submission_date ?? "—"}</td>
                    </tr>
                  ))}

                {!q.isLoading && rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
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
