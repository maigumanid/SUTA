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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          admin_user_id: string
          after_values: Json
          before_values: Json
          created_at: string
          id: number
          target_bsi_user_id: string
        }
        Insert: {
          action: string
          admin_user_id: string
          after_values?: Json
          before_values?: Json
          created_at?: string
          id?: never
          target_bsi_user_id: string
        }
        Update: {
          action?: string
          admin_user_id?: string
          after_values?: Json
          before_values?: Json
          created_at?: string
          id?: never
          target_bsi_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "bsi_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_log_target_bsi_user_id_fkey"
            columns: ["target_bsi_user_id"]
            isOneToOne: false
            referencedRelation: "bsi_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bsi_profiles: {
        Row: {
          active: boolean
          assigned_barangay_id: string | null
          assigned_barangay_name: string | null
          contact_number: string
          created_at: string
          email: string
          id: string
          jurisdiction_name: string | null
          must_change_password: boolean
          name: string
          role: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          assigned_barangay_id?: string | null
          assigned_barangay_name?: string | null
          contact_number: string
          created_at?: string
          email: string
          id: string
          jurisdiction_name?: string | null
          must_change_password?: boolean
          name: string
          role?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          assigned_barangay_id?: string | null
          assigned_barangay_name?: string | null
          contact_number?: string
          created_at?: string
          email?: string
          id?: string
          jurisdiction_name?: string | null
          must_change_password?: boolean
          name?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bsi_profiles_barangay_directory_fk"
            columns: ["assigned_barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
          },
        ]
      }
      barangays: {
        Row: {
          active: boolean
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      inspections: {
        Row: {
          barangay_id: string
          bsi_uid: string
          findings: Json
          id: string
          inspection_date: string
          inspection_location: Json | null
          location_capture_attempted_at: string | null
          location_capture_status: string
          place_id: string
          reinspection_id: string | null
          reinspection_of_inspection_id: string | null
          remarks: string
          result: string
          risk_critical_failure: boolean
          risk_earned_points: number
          risk_evaluated_items: number
          risk_level: string
          risk_maximum_points: number
          risk_percentage: number | null
          safe_water_supply: Json
          sanitation_facility: Json
          synced_at: string
        }
        Insert: {
          barangay_id: string
          bsi_uid: string
          findings?: Json
          id: string
          inspection_date: string
          inspection_location?: Json | null
          location_capture_attempted_at?: string | null
          location_capture_status: string
          place_id: string
          reinspection_id?: string | null
          reinspection_of_inspection_id?: string | null
          remarks?: string
          result: string
          risk_critical_failure?: boolean
          risk_earned_points?: number
          risk_evaluated_items?: number
          risk_level?: string
          risk_maximum_points?: number
          risk_percentage?: number | null
          safe_water_supply: Json
          sanitation_facility: Json
          synced_at?: string
        }
        Update: {
          barangay_id?: string
          bsi_uid?: string
          findings?: Json
          id?: string
          inspection_date?: string
          inspection_location?: Json | null
          location_capture_attempted_at?: string | null
          location_capture_status?: string
          place_id?: string
          reinspection_id?: string | null
          reinspection_of_inspection_id?: string | null
          remarks?: string
          result?: string
          risk_critical_failure?: boolean
          risk_earned_points?: number
          risk_evaluated_items?: number
          risk_level?: string
          risk_maximum_points?: number
          risk_percentage?: number | null
          safe_water_supply?: Json
          sanitation_facility?: Json
          synced_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inspections_bsi_uid_fkey"
            columns: ["bsi_uid"]
            isOneToOne: false
            referencedRelation: "bsi_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inspections_original_barangay_fk"
            columns: ["reinspection_of_inspection_id", "barangay_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id", "barangay_id"]
          },
          {
            foreignKeyName: "inspections_place_barangay_fk"
            columns: ["place_id", "barangay_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id", "barangay_id"]
          },
          {
            foreignKeyName: "inspections_reinspection_barangay_fk"
            columns: ["reinspection_id", "barangay_id"]
            isOneToOne: false
            referencedRelation: "reinspections"
            referencedColumns: ["id", "barangay_id"]
          },
        ]
      }
      places: {
        Row: {
          address: string
          barangay_id: string
          barangay_name: string | null
          created_at: string
          created_by_uid: string
          id: string
          last_inspection_date: string | null
          name: string
          place_type: string
          purok: string
          representative_name: string
          risk_level: string
          status: string
          updated_at: string
          updated_by_uid: string | null
        }
        Insert: {
          address: string
          barangay_id: string
          barangay_name?: string | null
          created_at?: string
          created_by_uid: string
          id: string
          last_inspection_date?: string | null
          name: string
          place_type: string
          purok: string
          representative_name: string
          risk_level?: string
          status?: string
          updated_at?: string
          updated_by_uid?: string | null
        }
        Update: {
          address?: string
          barangay_id?: string
          barangay_name?: string | null
          created_at?: string
          created_by_uid?: string
          id?: string
          last_inspection_date?: string | null
          name?: string
          place_type?: string
          purok?: string
          representative_name?: string
          risk_level?: string
          status?: string
          updated_at?: string
          updated_by_uid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "places_barangay_directory_fk"
            columns: ["barangay_id"]
            isOneToOne: false
            referencedRelation: "barangays"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_created_by_uid_fkey"
            columns: ["created_by_uid"]
            isOneToOne: false
            referencedRelation: "bsi_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "places_updated_by_uid_fkey"
            columns: ["updated_by_uid"]
            isOneToOne: false
            referencedRelation: "bsi_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reinspections: {
        Row: {
          barangay_id: string
          bsi_uid: string
          completed_at: string | null
          completed_inspection_id: string | null
          created_at: string
          id: string
          original_inspection_id: string
          place_id: string
          scheduled_date: string
          status: string
          synced_at: string | null
        }
        Insert: {
          barangay_id: string
          bsi_uid: string
          completed_at?: string | null
          completed_inspection_id?: string | null
          created_at?: string
          id: string
          original_inspection_id: string
          place_id: string
          scheduled_date: string
          status: string
          synced_at?: string | null
        }
        Update: {
          barangay_id?: string
          bsi_uid?: string
          completed_at?: string | null
          completed_inspection_id?: string | null
          created_at?: string
          id?: string
          original_inspection_id?: string
          place_id?: string
          scheduled_date?: string
          status?: string
          synced_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reinspections_bsi_uid_fkey"
            columns: ["bsi_uid"]
            isOneToOne: false
            referencedRelation: "bsi_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reinspections_completed_barangay_fk"
            columns: ["completed_inspection_id", "barangay_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id", "barangay_id"]
          },
          {
            foreignKeyName: "reinspections_original_barangay_fk"
            columns: ["original_inspection_id", "barangay_id"]
            isOneToOne: false
            referencedRelation: "inspections"
            referencedColumns: ["id", "barangay_id"]
          },
          {
            foreignKeyName: "reinspections_place_barangay_fk"
            columns: ["place_id", "barangay_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id", "barangay_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_create_bsi_profile: {
        Args: {
          p_admin_user_id: string
          p_assigned_barangay_id: string
          p_assigned_barangay_name: string
          p_contact_number: string
          p_email: string
          p_name: string
          p_target_user_id: string
        }
        Returns: Database["public"]["Tables"]["bsi_profiles"]["Row"]
      }
      admin_update_bsi_profile: {
        Args: {
          p_action: string
          p_admin_user_id: string
          p_assigned_barangay_id?: string
          p_assigned_barangay_name?: string
          p_target_user_id: string
        }
        Returns: Database["public"]["Tables"]["bsi_profiles"]["Row"]
      }
      complete_password_change: {
        Args: { p_user_id: string }
        Returns: Database["public"]["Tables"]["bsi_profiles"]["Row"]
      }
      submit_inspection: {
        Args: {
          p_findings: Json
          p_id: string
          p_inspection_date: string
          p_inspection_location?: Json
          p_location_capture_attempted_at?: string
          p_location_capture_status: string
          p_place_id: string
          p_reinspection_id?: string
          p_reinspection_of_inspection_id?: string
          p_remarks: string
          p_result: string
          p_safe_water_supply: Json
          p_sanitation_facility: Json
        }
        Returns: {
          barangay_id: string
          bsi_uid: string
          findings: Json
          id: string
          inspection_date: string
          inspection_location: Json | null
          location_capture_attempted_at: string | null
          location_capture_status: string
          place_id: string
          reinspection_id: string | null
          reinspection_of_inspection_id: string | null
          remarks: string
          result: string
          risk_critical_failure: boolean
          risk_earned_points: number
          risk_evaluated_items: number
          risk_level: string
          risk_maximum_points: number
          risk_percentage: number | null
          safe_water_supply: Json
          sanitation_facility: Json
          synced_at: string
        }
        SetofOptions: {
          from: "*"
          to: "inspections"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
