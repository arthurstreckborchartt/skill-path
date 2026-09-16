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
      feedback: {
        Row: {
          created_at: string
          id: string
          kind: string
          message: string
          page: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          message: string
          page?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          message?: string
          page?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      pathly_learning_activity_progress: {
        Row: {
          activity_id: string
          activity_type: string
          attempts: number
          completed_at: string | null
          confidence: number | null
          created_at: string
          last_answer_correct: boolean | null
          minutes_spent: number
          review_due_at: string | null
          route_signature: string
          score: number | null
          skill_names: string[]
          status: string
          step_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          activity_type?: string
          attempts?: number
          completed_at?: string | null
          confidence?: number | null
          created_at?: string
          last_answer_correct?: boolean | null
          minutes_spent?: number
          review_due_at?: string | null
          route_signature: string
          score?: number | null
          skill_names?: string[]
          status?: string
          step_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          activity_type?: string
          attempts?: number
          completed_at?: string | null
          confidence?: number | null
          created_at?: string
          last_answer_correct?: boolean | null
          minutes_spent?: number
          review_due_at?: string | null
          route_signature?: string
          score?: number | null
          skill_names?: string[]
          status?: string
          step_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pathly_licoes: {
        Row: {
          chave: string
          conteudo: Json
          created_at: string
          etapa: string
          habilidades: string[]
          modelo: string | null
          tarefa: string
        }
        Insert: {
          chave: string
          conteudo: Json
          created_at?: string
          etapa: string
          habilidades?: string[]
          modelo?: string | null
          tarefa: string
        }
        Update: {
          chave?: string
          conteudo?: Json
          created_at?: string
          etapa?: string
          habilidades?: string[]
          modelo?: string | null
          tarefa?: string
        }
        Relationships: []
      }
      pathly_profiles: {
        Row: {
          assinatura_ate: string | null
          assinatura_status: string | null
          goal_text: string | null
          onboarding: Json
          plano: string
          stripe_customer_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          assinatura_ate?: string | null
          assinatura_status?: string | null
          goal_text?: string | null
          onboarding: Json
          plano?: string
          stripe_customer_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          assinatura_ate?: string | null
          assinatura_status?: string | null
          goal_text?: string | null
          onboarding?: Json
          plano?: string
          stripe_customer_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pathly_projetos: {
        Row: {
          atualizado_em: string
          conteudo: Json
          criado_em: string
          etapa_atual: number
          etapas_concluidas: number
          etapas_total: number
          id: string
          ideia: string
          nome: string
          status: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          conteudo?: Json
          criado_em?: string
          etapa_atual?: number
          etapas_concluidas?: number
          etapas_total?: number
          id?: string
          ideia: string
          nome: string
          status?: string
          user_id: string
        }
        Update: {
          atualizado_em?: string
          conteudo?: Json
          criado_em?: string
          etapa_atual?: number
          etapas_concluidas?: number
          etapas_total?: number
          id?: string
          ideia?: string
          nome?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      pathly_project_progress: {
        Row: {
          completed_at: string | null
          evidence_url: string | null
          progress: number
          project_id: string
          reflection: string | null
          route_signature: string
          status: string
          step_id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          evidence_url?: string | null
          progress?: number
          project_id: string
          reflection?: string | null
          route_signature: string
          status?: string
          step_id: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          evidence_url?: string | null
          progress?: number
          project_id?: string
          reflection?: string | null
          route_signature?: string
          status?: string
          step_id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pathly_resources: {
        Row: {
          areas: string[]
          created_at: string
          id: string
          is_free: boolean
          kind: string
          language: string
          level: string | null
          provider: string | null
          slug: string
          source: string
          source_license: string
          summary: string
          title: string
          topics: string[]
          url: string
        }
        Insert: {
          areas?: string[]
          created_at?: string
          id?: string
          is_free?: boolean
          kind: string
          language?: string
          level?: string | null
          provider?: string | null
          slug: string
          source: string
          source_license: string
          summary: string
          title: string
          topics?: string[]
          url: string
        }
        Update: {
          areas?: string[]
          created_at?: string
          id?: string
          is_free?: boolean
          kind?: string
          language?: string
          level?: string | null
          provider?: string | null
          slug?: string
          source?: string
          source_license?: string
          summary?: string
          title?: string
          topics?: string[]
          url?: string
        }
        Relationships: []
      }
      pathly_route_progress: {
        Row: {
          progress: Json
          route_signature: string
          updated_at: string
          user_id: string
        }
        Insert: {
          progress: Json
          route_signature: string
          updated_at?: string
          user_id: string
        }
        Update: {
          progress?: Json
          route_signature?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pathly_routes: {
        Row: {
          area: string
          created_at: string
          generator: string
          id: string
          signature: string
          steps: Json
          user_id: string
        }
        Insert: {
          area: string
          created_at?: string
          generator?: string
          id?: string
          signature: string
          steps: Json
          user_id: string
        }
        Update: {
          area?: string
          created_at?: string
          generator?: string
          id?: string
          signature?: string
          steps?: Json
          user_id?: string
        }
        Relationships: []
      }
      pathly_skill_mastery: {
        Row: {
          evidence_count: number
          last_practiced_at: string | null
          mastery: number
          route_signature: string
          skill_key: string
          skill_name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          evidence_count?: number
          last_practiced_at?: string | null
          mastery?: number
          route_signature: string
          skill_key: string
          skill_name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          evidence_count?: number
          last_practiced_at?: string | null
          mastery?: number
          route_signature?: string
          skill_key?: string
          skill_name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pathly_xp_events: {
        Row: {
          amount: number
          created_at: string
          event_key: string
          id: string
          metadata: Json
          route_signature: string
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          event_key: string
          id?: string
          metadata?: Json
          route_signature: string
          source: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          event_key?: string
          id?: string
          metadata?: Json
          route_signature?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
