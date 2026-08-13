export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      documents: {
        Row: {
          content: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          opportunity_id: string
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          opportunity_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          opportunity_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_progress: {
        Row: {
          created_at: string
          created_by: string
          goal_id: string
          id: string
          note: string | null
          period_month: string
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          created_by: string
          goal_id: string
          id?: string
          note?: string | null
          period_month: string
          updated_at?: string
          value: number
        }
        Update: {
          created_at?: string
          created_by?: string
          goal_id?: string
          id?: string
          note?: string | null
          period_month?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "goal_progress_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_progress_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          due_date: string
          duration: string | null
          id: string
          measurement_type: Database["public"]["Enums"]["goal_measurement"]
          operator: Database["public"]["Enums"]["goal_operator"]
          owner_id: string | null
          scope: Database["public"]["Enums"]["goal_scope"]
          start_date: string
          target_metric: string | null
          target_value: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          due_date: string
          duration?: string | null
          id?: string
          measurement_type?: Database["public"]["Enums"]["goal_measurement"]
          operator?: Database["public"]["Enums"]["goal_operator"]
          owner_id?: string | null
          scope: Database["public"]["Enums"]["goal_scope"]
          start_date: string
          target_metric?: string | null
          target_value: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          due_date?: string
          duration?: string | null
          id?: string
          measurement_type?: Database["public"]["Enums"]["goal_measurement"]
          operator?: Database["public"]["Enums"]["goal_operator"]
          owner_id?: string | null
          scope?: Database["public"]["Enums"]["goal_scope"]
          start_date?: string
          target_metric?: string | null
          target_value?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          created_at: string
          id: string
          link: string | null
          opportunity_id: string | null
          read_at: string | null
          recipient_id: string
          title: string
          type: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          opportunity_id?: string | null
          read_at?: string | null
          recipient_id: string
          title: string
          type: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          opportunity_id?: string | null
          read_at?: string | null
          recipient_id?: string
          title?: string
          type?: string
        }
        Relationships: []
      }
      opportunities: {
        Row: {
          approx_submission_date: string | null
          breach_ignored: boolean
          breach_ignored_at: string | null
          breach_ignored_by: string | null
          breach_ignored_reason: string | null
          completed_date: string | null
          created_at: string
          created_by: string | null
          crm_number: string
          customer_name: string
          deadline: string | null
          domain: string | null
          end_user: string | null
          estimation_hours: number | null
          final_bom: string | null
          hold_reason: string | null
          hold_started_at: string | null
          id: string
          on_hold: boolean
          opportunity_cost: number | null
          opportunity_type: Database["public"]["Enums"]["opportunity_type"]
          phase1_completed_at: string | null
          phase2_completed_at: string | null
          phase3_completed_at: string | null
          phase4_completed_at: string | null
          pre_hold_status:
            | Database["public"]["Enums"]["opportunity_status"]
            | null
          priority: Database["public"]["Enums"]["opportunity_priority"]
          project_name: string
          received_date: string | null
          region: string | null
          revision_count: number
          rfq_reading_hours: number | null
          start_date: string | null
          status: Database["public"]["Enums"]["opportunity_status"]
          system_details: string | null
          updated_at: string
        }
        Insert: {
          approx_submission_date?: string | null
          breach_ignored?: boolean
          breach_ignored_at?: string | null
          breach_ignored_by?: string | null
          breach_ignored_reason?: string | null
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          crm_number: string
          customer_name: string
          deadline?: string | null
          domain?: string | null
          end_user?: string | null
          estimation_hours?: number | null
          final_bom?: string | null
          hold_reason?: string | null
          hold_started_at?: string | null
          id?: string
          on_hold?: boolean
          opportunity_cost?: number | null
          opportunity_type?: Database["public"]["Enums"]["opportunity_type"]
          phase1_completed_at?: string | null
          phase2_completed_at?: string | null
          phase3_completed_at?: string | null
          phase4_completed_at?: string | null
          pre_hold_status?:
            | Database["public"]["Enums"]["opportunity_status"]
            | null
          priority?: Database["public"]["Enums"]["opportunity_priority"]
          project_name: string
          received_date?: string | null
          region?: string | null
          revision_count?: number
          rfq_reading_hours?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["opportunity_status"]
          system_details?: string | null
          updated_at?: string
        }
        Update: {
          approx_submission_date?: string | null
          breach_ignored?: boolean
          breach_ignored_at?: string | null
          breach_ignored_by?: string | null
          breach_ignored_reason?: string | null
          completed_date?: string | null
          created_at?: string
          created_by?: string | null
          crm_number?: string
          customer_name?: string
          deadline?: string | null
          domain?: string | null
          end_user?: string | null
          estimation_hours?: number | null
          final_bom?: string | null
          hold_reason?: string | null
          hold_started_at?: string | null
          id?: string
          on_hold?: boolean
          opportunity_cost?: number | null
          opportunity_type?: Database["public"]["Enums"]["opportunity_type"]
          phase1_completed_at?: string | null
          phase2_completed_at?: string | null
          phase3_completed_at?: string | null
          phase4_completed_at?: string | null
          pre_hold_status?:
            | Database["public"]["Enums"]["opportunity_status"]
            | null
          priority?: Database["public"]["Enums"]["opportunity_priority"]
          project_name?: string
          received_date?: string | null
          region?: string | null
          revision_count?: number
          rfq_reading_hours?: number | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["opportunity_status"]
          system_details?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      opportunity_activity_log: {
        Row: {
          created_at: string
          event_type: string
          id: string
          message: string | null
          opportunity_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          message?: string | null
          opportunity_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          message?: string | null
          opportunity_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_activity_log_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_architects: {
        Row: {
          opportunity_id: string
          user_id: string
        }
        Insert: {
          opportunity_id: string
          user_id: string
        }
        Update: {
          opportunity_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "opportunity_architects_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      opportunity_breach_history: {
        Row: {
          acted_at: string
          acted_by: string
          action: string
          id: string
          opportunity_id: string
          reason: string
          revision_count_at_action: number
        }
        Insert: {
          acted_at?: string
          acted_by: string
          action: string
          id?: string
          opportunity_id: string
          reason: string
          revision_count_at_action: number
        }
        Update: {
          acted_at?: string
          acted_by?: string
          action?: string
          id?: string
          opportunity_id?: string
          reason?: string
          revision_count_at_action?: number
        }
        Relationships: []
      }
      opportunity_requests: {
        Row: {
          created_at: string
          created_opportunity_id: string | null
          crm_number: string
          customer_name: string
          deadline: string | null
          id: string
          notes: string | null
          opportunity_type: Database["public"]["Enums"]["opportunity_type"]
          project_name: string
          received_date: string | null
          requested_by: string
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["request_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_opportunity_id?: string | null
          crm_number: string
          customer_name: string
          deadline?: string | null
          id?: string
          notes?: string | null
          opportunity_type?: Database["public"]["Enums"]["opportunity_type"]
          project_name: string
          received_date?: string | null
          requested_by: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_opportunity_id?: string | null
          crm_number?: string
          customer_name?: string
          deadline?: string | null
          id?: string
          notes?: string | null
          opportunity_type?: Database["public"]["Enums"]["opportunity_type"]
          project_name?: string
          received_date?: string | null
          requested_by?: string
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          status: Database["public"]["Enums"]["user_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          status?: Database["public"]["Enums"]["user_status"]
          updated_at?: string
        }
        Relationships: []
      }
      rating_answers: {
        Row: {
          id: string
          question_id: string
          rating_id: string
          score: number
        }
        Insert: {
          id?: string
          question_id: string
          rating_id: string
          score: number
        }
        Update: {
          id?: string
          question_id?: string
          rating_id?: string
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "rating_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "rating_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rating_answers_rating_id_fkey"
            columns: ["rating_id"]
            isOneToOne: false
            referencedRelation: "ratings"
            referencedColumns: ["id"]
          },
        ]
      }
      rating_questions: {
        Row: {
          active: boolean
          created_at: string
          id: string
          sort_order: number
          text: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          sort_order?: number
          text: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          sort_order?: number
          text?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          opportunity_id: string
          vp_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          opportunity_id: string
          vp_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          opportunity_id?: string
          vp_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_contacts: {
        Row: {
          created_at: string
          email: string | null
          id: string
          is_primary: boolean
          name: string
          phone: string | null
          role: string | null
          vendor_id: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          phone?: string | null
          role?: string | null
          vendor_id: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string | null
          role?: string | null
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_contacts_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_custom_fields: {
        Row: {
          created_at: string
          field_key: string
          field_value: string | null
          id: string
          vendor_id: string
        }
        Insert: {
          created_at?: string
          field_key: string
          field_value?: string | null
          id?: string
          vendor_id: string
        }
        Update: {
          created_at?: string
          field_key?: string
          field_value?: string | null
          id?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_custom_fields_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_enquiries: {
        Row: {
          consyst_final_response: string | null
          contact_id: string | null
          created_at: string
          created_by: string | null
          enquiry_date: string
          id: string
          item_added_erp: boolean
          last_contact_date: string | null
          make: string | null
          opportunity_id: string
          requirement: string | null
          shared_by: string | null
          status: Database["public"]["Enums"]["vendor_enquiry_status"]
          supplier_quotation_added: boolean
          updated_at: string
          vendor_id: string
        }
        Insert: {
          consyst_final_response?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          enquiry_date?: string
          id?: string
          item_added_erp?: boolean
          last_contact_date?: string | null
          make?: string | null
          opportunity_id: string
          requirement?: string | null
          shared_by?: string | null
          status?: Database["public"]["Enums"]["vendor_enquiry_status"]
          supplier_quotation_added?: boolean
          updated_at?: string
          vendor_id: string
        }
        Update: {
          consyst_final_response?: string | null
          contact_id?: string | null
          created_at?: string
          created_by?: string | null
          enquiry_date?: string
          id?: string
          item_added_erp?: boolean
          last_contact_date?: string | null
          make?: string | null
          opportunity_id?: string
          requirement?: string | null
          shared_by?: string | null
          status?: Database["public"]["Enums"]["vendor_enquiry_status"]
          supplier_quotation_added?: boolean
          updated_at?: string
          vendor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_enquiries_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "vendor_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_enquiries_opportunity_id_fkey"
            columns: ["opportunity_id"]
            isOneToOne: false
            referencedRelation: "opportunities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_enquiries_shared_by_fkey"
            columns: ["shared_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_enquiries_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      vendors: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      approve_opportunity_request: {
        Args: { _request_id: string }
        Returns: string
      }
      can_view_opportunity: { Args: { _opp_id: string }; Returns: boolean }
      email_exists: { Args: { _email: string }; Returns: boolean }
      get_status_board: {
        Args: never
        Returns: {
          approx_submission_date: string
          architect_names: string
          crm_number: string
          customer_name: string
          has_architect: boolean
          id: string
          opportunity_type: string
          priority: string
          project_name: string
          status: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      ignore_revision_breach: {
        Args: { _opp_id: string; _reason: string }
        Returns: undefined
      }
      is_approved: { Args: { _user_id: string }; Returns: boolean }
      is_assigned: {
        Args: { _opp_id: string; _user_id: string }
        Returns: boolean
      }
      opportunity_refs: {
        Args: never
        Returns: {
          crm_number: string
          customer_name: string
          id: string
          project_name: string
        }[]
      }
      restore_revision_breach: {
        Args: { _opp_id: string; _reason: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "architect" | "vp" | "sales"
      goal_measurement: "numeric" | "percentage" | "currency" | "boolean"
      goal_operator: "gte" | "gt" | "eq" | "lte" | "lt"
      goal_scope: "team" | "department" | "individual"
      opportunity_priority: "Low" | "Medium" | "High"
      opportunity_status:
        | "Pending"
        | "In Progress"
        | "Completed"
        | "On Hold"
        | "Submitted to Sales"
        | "Closed Won"
        | "Closed Lost"
        | "Waiting for Clarification"
        | "Reopened"
        | "Regret"
      opportunity_type: "Budgetary" | "JIH" | "Firm Budgetary" | "Tender"
      request_status: "pending" | "approved" | "rejected"
      user_status: "pending" | "approved" | "rejected"
      vendor_enquiry_status:
        | "Pending"
        | "Quote requested"
        | "Quote received"
        | "On hold"
        | "Regret"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "architect", "vp", "sales"],
      goal_measurement: ["numeric", "percentage", "currency", "boolean"],
      goal_operator: ["gte", "gt", "eq", "lte", "lt"],
      goal_scope: ["team", "department", "individual"],
      opportunity_priority: ["Low", "Medium", "High"],
      opportunity_status: [
        "Pending",
        "In Progress",
        "Completed",
        "On Hold",
        "Submitted to Sales",
        "Closed Won",
        "Closed Lost",
        "Waiting for Clarification",
        "Reopened",
        "Regret",
      ],
      opportunity_type: ["Budgetary", "JIH", "Firm Budgetary", "Tender"],
      request_status: ["pending", "approved", "rejected"],
      user_status: ["pending", "approved", "rejected"],
      vendor_enquiry_status: [
        "Pending",
        "Quote requested",
        "Quote received",
        "On hold",
        "Regret",
      ],
    },
  },
} as const
