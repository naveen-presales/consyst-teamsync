import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, Plus, Search } from "lucide-react";
import { EnquiryDialog } from "@/components/vendor/EnquiryDialog";
import { exportAllEnquiries, fetchEnquiries, fetchVendors } from "@/lib/vendors";

export const Route = createFileRoute("/_app/vendor-enquiries/")({
  head: () => ({
    meta: [
      { title: "Vendor Enquiries — TeamSync" },
      { name: "description", content: "Track vendor enquiries raised against opportunities." },
      { property: "og:title", content: "Vendor Enquiries — TeamSync" },
      { property: "og:description", content: "Track vendor enquiries raised against opportunities." },
    ],
  }),
  component: VendorEnquiriesPage,
});

function VendorEnquiriesPage() {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const vendorsQ = useQuery({ queryKey: ["vendors"], queryFn: fetchVendors });
  const enquiriesQ = useQuery({ queryKey: ["vendor-enquiries", {}], queryFn: () => fetchEnquiries() });

  const cards = useMemo(() => {
    const q = search.trim().toLowerCase();
    const byVendor = new Map<string, { total: number; received: number; pending: number }>();
    for (const e of enquiriesQ.data ?? []) {
      const cur = byVendor.get(e.vendor_id) ?? { total: 0, received: 0, pending: 0 };
      cur.total += 1;
      if (e.status === "Quote received") cur.received += 1;
      if (e.status === "Pending") cur.pending += 1;
      byVendor.set(e.vendor_id, cur);
    }
    return (vendorsQ.data ?? [])
      .filter((v) => !q || v.name.toLowerCase().includes(q))
      .map((v) => ({ ...v, stats: byVendor.get(v.id) ?? { total: 0, received: 0, pending: 0 } }));
  }, [vendorsQ.data, enquiriesQ.data, search]);

  const doExport = async () => {
    try {
      const n = await exportAllEnquiries();
      toast.success(`Exported ${n} enquiries`);
    } catch (e: any) {
      toast.error(e.message ?? "Export failed");
    }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Vendor enquiries</h1>
          <p className="text-sm text-muted-foreground">Vendors and the enquiries raised with them.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={doExport}><Download className="h-4 w-4 mr-1.5" /> Export</Button>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1.5" /> New enquiry</Button>
        </div>
      </div>

      <div className="relative mt-5 max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Search vendors…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((v) => (
          <Link key={v.id} to="/vendor-enquiries/$vendorId" params={{ vendorId: v.id }}>
            <Card className="p-4 h-full hover:border-primary/50 transition-colors">
              <div className="font-medium truncate">{v.name}</div>
              <div className="text-xs text-muted-foreground mt-1">
                {v.stats.total} {v.stats.total === 1 ? "enquiry" : "enquiries"}
                {v.stats.total > 0 && ` · ${v.stats.received} received, ${v.stats.pending} pending`}
              </div>
            </Card>
          </Link>
        ))}
        {cards.length === 0 && (
          <div className="text-sm text-muted-foreground">No vendors yet — create one from “New enquiry”.</div>
        )}
      </div>

      <EnquiryDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}
