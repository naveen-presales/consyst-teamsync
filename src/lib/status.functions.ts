import { createServerFn } from "@tanstack/react-start";
import { FEATURE_SETTING_KEY, parseFeatureFlags } from "@/lib/features";

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

export type StatusBoardResult = { enabled: boolean; rows: StatusBoardRow[] };

export const getStatusBoard = createServerFn({ method: "GET" }).handler(
  async (): Promise<StatusBoardResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: setting, error: settingErr } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", FEATURE_SETTING_KEY)
      .maybeSingle();
    if (settingErr) throw new Error("Unable to load the status board");
    if (!parseFeatureFlags(setting?.value).status_board) return { enabled: false, rows: [] };
    const { data, error } = await supabaseAdmin.rpc("get_status_board");
    if (error) throw new Error("Unable to load the status board");
    return { enabled: true, rows: ((data ?? []) as unknown) as StatusBoardRow[] };
  },
);
