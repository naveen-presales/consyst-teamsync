import { createServerFn } from "@tanstack/react-start";

export type StatusBoardRow = {
  id: string;
  crm_number: string;
  customer_name: string;
  project_name: string;
  opportunity_type: string;
  status: string;
  priority: string | null;
  approx_submission_date: string | null;
  has_architect: boolean | null;
  architect_names: string | null;
};

export const getStatusBoard = createServerFn({ method: "GET" }).handler(
  async (): Promise<StatusBoardRow[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("get_status_board");
    if (error) throw new Error("Unable to load the status board");
    return ((data ?? []) as unknown) as StatusBoardRow[];
  },
);
