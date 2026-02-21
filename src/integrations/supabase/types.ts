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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          meta_json: Json | null
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_user_id: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          meta_json?: Json | null
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          meta_json?: Json | null
          target_user_id?: string | null
        }
        Relationships: []
      }
      build_files: {
        Row: {
          build_id: string
          content_hash: string | null
          content_text: string
          id: string
          path: string
          updated_at: string
        }
        Insert: {
          build_id: string
          content_hash?: string | null
          content_text?: string
          id?: string
          path: string
          updated_at?: string
        }
        Update: {
          build_id?: string
          content_hash?: string | null
          content_text?: string
          id?: string
          path?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "build_files_build_id_fkey"
            columns: ["build_id"]
            isOneToOne: false
            referencedRelation: "builds"
            referencedColumns: ["id"]
          },
        ]
      }
      build_previews: {
        Row: {
          build_id: string
          id: string
          last_deployed_at: string | null
          logs_text: string | null
          preview_url: string | null
          provider: string
          status: string
        }
        Insert: {
          build_id: string
          id?: string
          last_deployed_at?: string | null
          logs_text?: string | null
          preview_url?: string | null
          provider?: string
          status?: string
        }
        Update: {
          build_id?: string
          id?: string
          last_deployed_at?: string | null
          logs_text?: string | null
          preview_url?: string | null
          provider?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "build_previews_build_id_fkey"
            columns: ["build_id"]
            isOneToOne: true
            referencedRelation: "builds"
            referencedColumns: ["id"]
          },
        ]
      }
      builds: {
        Row: {
          artifact_url: string | null
          build_json: Json | null
          created_at: string
          id: string
          input_json: Json
          project_id: string | null
          status: string
          template_id: string | null
          user_id: string
        }
        Insert: {
          artifact_url?: string | null
          build_json?: Json | null
          created_at?: string
          id?: string
          input_json?: Json
          project_id?: string | null
          status?: string
          template_id?: string | null
          user_id: string
        }
        Update: {
          artifact_url?: string | null
          build_json?: Json | null
          created_at?: string
          id?: string
          input_json?: Json
          project_id?: string | null
          status?: string
          template_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "builds_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "builds_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      generations: {
        Row: {
          created_at: string
          id: string
          input_data: Json
          project_id: string
          result: string | null
          status: string
          template_id: string | null
          tokens_used: number | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          input_data?: Json
          project_id: string
          result?: string | null
          status?: string
          template_id?: string | null
          tokens_used?: number | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          input_data?: Json
          project_id?: string
          result?: string | null
          status?: string
          template_id?: string | null
          tokens_used?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "generations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "generations_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_settings: {
        Row: {
          created_at: string
          cta_primary_text: string
          cta_secondary_text: string
          elite_credits: number
          elite_price: string
          hero_badge: string
          hero_subtitle: string
          hero_title: string
          id: string
          install_banner_enabled: boolean
          is_active: boolean
          pro_credits: number
          pro_price: string
          starter_credits: number
          starter_price: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          cta_primary_text?: string
          cta_secondary_text?: string
          elite_credits?: number
          elite_price?: string
          hero_badge?: string
          hero_subtitle?: string
          hero_title?: string
          id?: string
          install_banner_enabled?: boolean
          is_active?: boolean
          pro_credits?: number
          pro_price?: string
          starter_credits?: number
          starter_price?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          cta_primary_text?: string
          cta_secondary_text?: string
          elite_credits?: number
          elite_price?: string
          hero_badge?: string
          hero_subtitle?: string
          hero_title?: string
          id?: string
          install_banner_enabled?: boolean
          is_active?: boolean
          pro_credits?: number
          pro_price?: string
          starter_credits?: number
          starter_price?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: string
          created_at: string
          email: string | null
          full_name: string | null
          grace_until: string | null
          id: string
          language_preference: string
          plan: string
          theme_preference: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_status?: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          grace_until?: string | null
          id?: string
          language_preference?: string
          plan?: string
          theme_preference?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_status?: string
          created_at?: string
          email?: string | null
          full_name?: string | null
          grace_until?: string | null
          id?: string
          language_preference?: string
          plan?: string
          theme_preference?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      projects: {
        Row: {
          ai_provider: string | null
          creation_mode: string | null
          context: Json | null
          created_at: string
          description: string | null
          id: string
          name: string
          original_prompt: string | null
          parsed_prompt: string | null
          stack: string[]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_provider?: string | null
          creation_mode?: string | null
          context?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          original_prompt?: string | null
          parsed_prompt?: string | null
          stack?: string[]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_provider?: string | null
          creation_mode?: string | null
          context?: Json | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          original_prompt?: string | null
          parsed_prompt?: string | null
          stack?: string[]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_file_versions: {
        Row: {
          content: string
          created_at: string
          file_id: string
          id: string
          source: string
        }
        Insert: {
          content: string
          created_at?: string
          file_id: string
          id?: string
          source?: string
        }
        Update: {
          content?: string
          created_at?: string
          file_id?: string
          id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_file_versions_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "project_files"
            referencedColumns: ["id"]
          },
        ]
      }
      project_files: {
        Row: {
          content: string
          created_at: string
          hash: string | null
          id: string
          is_dirty: boolean
          path: string
          project_id: string
          size: number
          updated_at: string
        }
        Insert: {
          content?: string
          created_at?: string
          hash?: string | null
          id?: string
          is_dirty?: boolean
          path: string
          project_id: string
          size?: number
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          hash?: string | null
          id?: string
          is_dirty?: boolean
          path?: string
          project_id?: string
          size?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_logs: {
        Row: {
          action: string
          file_path: string | null
          id: string
          project_id: string
          timestamp: string
          user_id: string
        }
        Insert: {
          action: string
          file_path?: string | null
          id?: string
          project_id: string
          timestamp?: string
          user_id: string
        }
        Update: {
          action?: string
          file_path?: string | null
          id?: string
          project_id?: string
          timestamp?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_versions: {
        Row: {
          ai_provider: string | null
          build_notes: string | null
          created_at: string
          id: string
          project_id: string
          version: number
        }
        Insert: {
          ai_provider?: string | null
          build_notes?: string | null
          created_at?: string
          id?: string
          project_id: string
          version: number
        }
        Update: {
          ai_provider?: string | null
          build_notes?: string | null
          created_at?: string
          id?: string
          project_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_versions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      templates: {
        Row: {
          category: string
          created_at: string
          description: string | null
          fields: Json
          id: string
          is_system: boolean
          name: string
          prompt_template: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_system?: boolean
          name: string
          prompt_template?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          fields?: Json
          id?: string
          is_system?: boolean
          name?: string
          prompt_template?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      user_quotas: {
        Row: {
          generations_used: number
          id: string
          monthly_limit: number
          plan: string
          reset_date: string
          user_id: string
        }
        Insert: {
          generations_used?: number
          id?: string
          monthly_limit?: number
          plan?: string
          reset_date?: string
          user_id: string
        }
        Update: {
          generations_used?: number
          id?: string
          monthly_limit?: number
          plan?: string
          reset_date?: string
          user_id?: string
        }
        Relationships: []
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
          role?: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "user" | "admin" | "superadmin"
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
      app_role: ["user", "admin", "superadmin"],
    },
  },
} as const
