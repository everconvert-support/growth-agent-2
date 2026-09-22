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
      approvals: {
        Row: {
          action_id: string
          decided_at: string
          decided_by: string
          decision: string
          id: string
          note: string | null
          workspace_id: string
        }
        Insert: {
          action_id: string
          decided_at?: string
          decided_by: string
          decision: string
          id?: string
          note?: string | null
          workspace_id: string
        }
        Update: {
          action_id?: string
          decided_at?: string
          decided_by?: string
          decision?: string
          id?: string
          note?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: true
            referencedRelation: "proposed_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approvals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          actor_id: string | null
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          event_type: string
          id: string
          workspace_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          event_type: string
          id?: string
          workspace_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          event_type?: string
          id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      demo_accounts: {
        Row: {
          email: string
          id: string
          is_admin: boolean
          workspace_role: Database["public"]["Enums"]["workspace_role"]
          workspace_slug: string | null
        }
        Insert: {
          email: string
          id?: string
          is_admin?: boolean
          workspace_role?: Database["public"]["Enums"]["workspace_role"]
          workspace_slug?: string | null
        }
        Update: {
          email?: string
          id?: string
          is_admin?: boolean
          workspace_role?: Database["public"]["Enums"]["workspace_role"]
          workspace_slug?: string | null
        }
        Relationships: []
      }
      executions: {
        Row: {
          action_id: string
          approval_id: string
          attempts: number
          created_at: string
          id: string
          idempotency_key: string
          provider_response: Json | null
          status: Database["public"]["Enums"]["exec_status"]
          updated_at: string
          verification_result: string | null
          verified_at: string | null
          workspace_id: string
        }
        Insert: {
          action_id: string
          approval_id: string
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key: string
          provider_response?: Json | null
          status?: Database["public"]["Enums"]["exec_status"]
          updated_at?: string
          verification_result?: string | null
          verified_at?: string | null
          workspace_id: string
        }
        Update: {
          action_id?: string
          approval_id?: string
          attempts?: number
          created_at?: string
          id?: string
          idempotency_key?: string
          provider_response?: Json | null
          status?: Database["public"]["Enums"]["exec_status"]
          updated_at?: string
          verification_result?: string | null
          verified_at?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "executions_action_id_fkey"
            columns: ["action_id"]
            isOneToOne: false
            referencedRelation: "proposed_actions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executions_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "executions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          access_token: string | null
          connected_at: string | null
          id: string
          last_checked_at: string | null
          page_state: Json
          provider: string
          status: Database["public"]["Enums"]["integration_status"]
          workspace_id: string
        }
        Insert: {
          access_token?: string | null
          connected_at?: string | null
          id?: string
          last_checked_at?: string | null
          page_state?: Json
          provider?: string
          status?: Database["public"]["Enums"]["integration_status"]
          workspace_id: string
        }
        Update: {
          access_token?: string | null
          connected_at?: string | null
          id?: string
          last_checked_at?: string | null
          page_state?: Json
          provider?: string
          status?: Database["public"]["Enums"]["integration_status"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      pagepilot_service_tokens: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          issued_at: string
          state: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_at?: string
          state?: string
          token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          issued_at?: string
          state?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      proposed_actions: {
        Row: {
          action_type: string
          created_at: string
          id: string
          input: Json
          recommendation_id: string
          status: Database["public"]["Enums"]["action_status"]
          workspace_id: string
        }
        Insert: {
          action_type?: string
          created_at?: string
          id?: string
          input: Json
          recommendation_id: string
          status?: Database["public"]["Enums"]["action_status"]
          workspace_id: string
        }
        Update: {
          action_type?: string
          created_at?: string
          id?: string
          input?: Json
          recommendation_id?: string
          status?: Database["public"]["Enums"]["action_status"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposed_actions_recommendation_id_fkey"
            columns: ["recommendation_id"]
            isOneToOne: false
            referencedRelation: "recommendations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposed_actions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      recommendations: {
        Row: {
          created_at: string
          finding: string
          id: string
          page_url: string
          status: Database["public"]["Enums"]["rec_status"]
          title: string
          why_it_matters: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          finding: string
          id?: string
          page_url: string
          status?: Database["public"]["Enums"]["rec_status"]
          title: string
          why_it_matters: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          finding?: string
          id?: string
          page_url?: string
          status?: Database["public"]["Enums"]["rec_status"]
          title?: string
          why_it_matters?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      trial_submissions: {
        Row: {
          answer_changed: string
          answer_found: string
          answer_next_day: string
          answer_not_changed: string
          commit_sha: string | null
          created_at: string
          id: string
          repo_url: string | null
          submitted_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          answer_changed?: string
          answer_found?: string
          answer_next_day?: string
          answer_not_changed?: string
          commit_sha?: string | null
          created_at?: string
          id?: string
          repo_url?: string | null
          submitted_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          answer_changed?: string
          answer_found?: string
          answer_next_day?: string
          answer_not_changed?: string
          commit_sha?: string | null
          created_at?: string
          id?: string
          repo_url?: string | null
          submitted_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_workspace_member: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
    }
    Enums: {
      action_status:
        | "proposed"
        | "approved"
        | "rejected"
        | "executed"
        | "failed"
      app_role: "admin"
      exec_status: "pending" | "succeeded" | "failed"
      integration_status: "connected" | "disconnected"
      rec_status: "open" | "approved" | "rejected" | "executed"
      workspace_role: "owner" | "member"
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
    Enums: {
      action_status: ["proposed", "approved", "rejected", "executed", "failed"],
      app_role: ["admin"],
      exec_status: ["pending", "succeeded", "failed"],
      integration_status: ["connected", "disconnected"],
      rec_status: ["open", "approved", "rejected", "executed"],
      workspace_role: ["owner", "member"],
    },
  },
} as const
