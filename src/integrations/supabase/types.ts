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
      pathly_acoes_externas: {
        Row: {
          acao_id: string
          criado_em: string
          decidido_em: string | null
          destino: string
          erro: string | null
          estado: string
          executado_em: string | null
          id: string
          impacto: string
          payload: Json
          projeto_id: string | null
          provedor: string
          resultado: string | null
          resumo: string
          user_id: string
        }
        Insert: {
          acao_id: string
          criado_em?: string
          decidido_em?: string | null
          destino: string
          erro?: string | null
          estado?: string
          executado_em?: string | null
          id?: string
          impacto?: string
          payload?: Json
          projeto_id?: string | null
          provedor: string
          resultado?: string | null
          resumo: string
          user_id: string
        }
        Update: {
          acao_id?: string
          criado_em?: string
          decidido_em?: string | null
          destino?: string
          erro?: string | null
          estado?: string
          executado_em?: string | null
          id?: string
          impacto?: string
          payload?: Json
          projeto_id?: string | null
          provedor?: string
          resultado?: string | null
          resumo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pathly_acoes_externas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "pathly_projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      pathly_apis: {
        Row: {
          atualizado_em: string
          criado_em: string
          mapa: Json
          projeto_id: string
          testes_feitos: number[]
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          mapa: Json
          projeto_id: string
          testes_feitos?: number[]
          user_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          mapa?: Json
          projeto_id?: string
          testes_feitos?: number[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pathly_apis_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: true
            referencedRelation: "pathly_projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      pathly_arquitetura_ia: {
        Row: {
          atualizado_em: string
          criado_em: string
          plano: Json
          projeto_id: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          plano?: Json
          projeto_id: string
          user_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          plano?: Json
          projeto_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pathly_arquitetura_ia_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: true
            referencedRelation: "pathly_projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      pathly_conexoes: {
        Row: {
          atualizado_em: string
          conta: string
          criado_em: string
          escopos: string[]
          expira_em: string | null
          provedor: string
          token_cifrado: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          conta?: string
          criado_em?: string
          escopos?: string[]
          expira_em?: string | null
          provedor: string
          token_cifrado: string
          user_id: string
        }
        Update: {
          atualizado_em?: string
          conta?: string
          criado_em?: string
          escopos?: string[]
          expira_em?: string | null
          provedor?: string
          token_cifrado?: string
          user_id?: string
        }
        Relationships: []
      }
      pathly_copilot_decisoes: {
        Row: {
          chave: string
          confirmado_em: string | null
          criado_em: string
          id: string
          metadata: Json
          motivo: string
          origem: string
          projeto_id: string
          status: string
          substitui_decisao_id: string | null
          titulo: string
          user_id: string
          valor: string
        }
        Insert: {
          chave: string
          confirmado_em?: string | null
          criado_em?: string
          id?: string
          metadata?: Json
          motivo: string
          origem?: string
          projeto_id: string
          status?: string
          substitui_decisao_id?: string | null
          titulo: string
          user_id: string
          valor: string
        }
        Update: {
          chave?: string
          confirmado_em?: string | null
          criado_em?: string
          id?: string
          metadata?: Json
          motivo?: string
          origem?: string
          projeto_id?: string
          status?: string
          substitui_decisao_id?: string | null
          titulo?: string
          user_id?: string
          valor?: string
        }
        Relationships: [
          {
            foreignKeyName: "pathly_copilot_decisoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "pathly_projetos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pathly_copilot_decisoes_substitui_decisao_id_fkey"
            columns: ["substitui_decisao_id"]
            isOneToOne: false
            referencedRelation: "pathly_copilot_decisoes"
            referencedColumns: ["id"]
          },
        ]
      }
      pathly_copilot_mensagens: {
        Row: {
          conteudo: Json
          criado_em: string
          id: string
          metadata: Json
          papel: string
          projeto_id: string
          user_id: string
        }
        Insert: {
          conteudo?: Json
          criado_em?: string
          id?: string
          metadata?: Json
          papel: string
          projeto_id: string
          user_id: string
        }
        Update: {
          conteudo?: Json
          criado_em?: string
          id?: string
          metadata?: Json
          papel?: string
          projeto_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pathly_copilot_mensagens_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "pathly_projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      pathly_copilot_propostas: {
        Row: {
          atualizado_em: string
          campo_afetado: string | null
          confirmado_em: string | null
          criado_em: string
          decisao_id: string | null
          descricao: string
          id: string
          impactos: string[]
          metadata: Json
          motivo: string
          projeto_id: string
          status: string
          tipo: string
          titulo: string
          user_id: string
          valor_atual: Json | null
          valor_proposto: Json | null
        }
        Insert: {
          atualizado_em?: string
          campo_afetado?: string | null
          confirmado_em?: string | null
          criado_em?: string
          decisao_id?: string | null
          descricao: string
          id?: string
          impactos?: string[]
          metadata?: Json
          motivo: string
          projeto_id: string
          status?: string
          tipo: string
          titulo: string
          user_id: string
          valor_atual?: Json | null
          valor_proposto?: Json | null
        }
        Update: {
          atualizado_em?: string
          campo_afetado?: string | null
          confirmado_em?: string | null
          criado_em?: string
          decisao_id?: string | null
          descricao?: string
          id?: string
          impactos?: string[]
          metadata?: Json
          motivo?: string
          projeto_id?: string
          status?: string
          tipo?: string
          titulo?: string
          user_id?: string
          valor_atual?: Json | null
          valor_proposto?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "pathly_copilot_propostas_decisao_id_fkey"
            columns: ["decisao_id"]
            isOneToOne: false
            referencedRelation: "pathly_copilot_decisoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pathly_copilot_propostas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "pathly_projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      pathly_etapas: {
        Row: {
          anotacoes: string
          atualizado_em: string
          checklist_feito: number[]
          concluida_em: string | null
          conteudo: Json | null
          id: string
          iniciada_em: string | null
          ordem: number
          projeto_id: string
          status: string
          user_id: string
        }
        Insert: {
          anotacoes?: string
          atualizado_em?: string
          checklist_feito?: number[]
          concluida_em?: string | null
          conteudo?: Json | null
          id?: string
          iniciada_em?: string | null
          ordem: number
          projeto_id: string
          status?: string
          user_id: string
        }
        Update: {
          anotacoes?: string
          atualizado_em?: string
          checklist_feito?: number[]
          concluida_em?: string | null
          conteudo?: Json | null
          id?: string
          iniciada_em?: string | null
          ordem?: number
          projeto_id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pathly_etapas_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "pathly_projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      pathly_hub_aprovacoes: {
        Row: {
          action: string
          approved_at: string | null
          approved_by: string | null
          capability: string
          created_at: string
          error: string | null
          executed_at: string | null
          expires_at: string
          fingerprint: string
          id: string
          integration_id: string
          metadata: Json
          nonce: string
          project_id: string | null
          requested_permission: string
          result: string | null
          scope: string
          status: string
          user_id: string
        }
        Insert: {
          action: string
          approved_at?: string | null
          approved_by?: string | null
          capability: string
          created_at?: string
          error?: string | null
          executed_at?: string | null
          expires_at: string
          fingerprint: string
          id?: string
          integration_id: string
          metadata?: Json
          nonce: string
          project_id?: string | null
          requested_permission: string
          result?: string | null
          scope?: string
          status?: string
          user_id: string
        }
        Update: {
          action?: string
          approved_at?: string | null
          approved_by?: string | null
          capability?: string
          created_at?: string
          error?: string | null
          executed_at?: string | null
          expires_at?: string
          fingerprint?: string
          id?: string
          integration_id?: string
          metadata?: Json
          nonce?: string
          project_id?: string | null
          requested_permission?: string
          result?: string | null
          scope?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      pathly_hub_auditoria: {
        Row: {
          acao_id: string | null
          ato: string
          capacidade: string | null
          detalhe: string
          em: string
          id: string
          projeto_id: string | null
          provedor: string
          user_id: string
        }
        Insert: {
          acao_id?: string | null
          ato: string
          capacidade?: string | null
          detalhe?: string
          em?: string
          id?: string
          projeto_id?: string | null
          provedor: string
          user_id: string
        }
        Update: {
          acao_id?: string | null
          ato?: string
          capacidade?: string | null
          detalhe?: string
          em?: string
          id?: string
          projeto_id?: string | null
          provedor?: string
          user_id?: string
        }
        Relationships: []
      }
      pathly_hub_eventos: {
        Row: {
          dados: Json
          id: string
          origem: string
          processado: boolean
          projeto_id: string | null
          provedor: string
          recebido_em: string
          tipo: string
          user_id: string
        }
        Insert: {
          dados?: Json
          id?: string
          origem?: string
          processado?: boolean
          projeto_id?: string | null
          provedor: string
          recebido_em?: string
          tipo: string
          user_id: string
        }
        Update: {
          dados?: Json
          id?: string
          origem?: string
          processado?: boolean
          projeto_id?: string | null
          provedor?: string
          recebido_em?: string
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pathly_hub_eventos_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "pathly_projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      pathly_hub_ferramentas_projeto: {
        Row: {
          atualizado_em: string
          criado_em: string
          papel: string
          project_id: string
          provedor_id: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          papel: string
          project_id: string
          provedor_id: string
          user_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          papel?: string
          project_id?: string
          provedor_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pathly_hub_ferramentas_projeto_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pathly_projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      pathly_hub_permissoes: {
        Row: {
          capacidade: string
          concedida_em: string
          expira_em: string | null
          id: string
          projeto_id: string | null
          provedor: string
          revogada_em: string | null
          user_id: string
        }
        Insert: {
          capacidade: string
          concedida_em?: string
          expira_em?: string | null
          id?: string
          projeto_id?: string | null
          provedor: string
          revogada_em?: string | null
          user_id: string
        }
        Update: {
          capacidade?: string
          concedida_em?: string
          expira_em?: string | null
          id?: string
          projeto_id?: string | null
          provedor?: string
          revogada_em?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pathly_hub_permissoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: false
            referencedRelation: "pathly_projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      pathly_hub_registros: {
        Row: {
          criado_em: string
          etapa_ordem: number | null
          id: string
          itens: string[]
          origem: string
          project_id: string
          provedor_id: string
          texto: string
          tipo: string
          user_id: string
        }
        Insert: {
          criado_em?: string
          etapa_ordem?: number | null
          id?: string
          itens?: string[]
          origem: string
          project_id: string
          provedor_id: string
          texto: string
          tipo: string
          user_id: string
        }
        Update: {
          criado_em?: string
          etapa_ordem?: number | null
          id?: string
          itens?: string[]
          origem?: string
          project_id?: string
          provedor_id?: string
          texto?: string
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pathly_hub_registros_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pathly_projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      pathly_hub_sessoes: {
        Row: {
          approved_actions: Json
          completed_at: string | null
          context_snapshot: Json | null
          current_step: string
          errors: Json
          executed_actions: Json
          id: string
          integration_id: string | null
          project_id: string
          provider: string | null
          requested_actions: Json
          result: Json | null
          started_at: string
          steps: Json
          task_id: string
          technical_decisions: Json
          user_id: string
        }
        Insert: {
          approved_actions?: Json
          completed_at?: string | null
          context_snapshot?: Json | null
          current_step?: string
          errors?: Json
          executed_actions?: Json
          id?: string
          integration_id?: string | null
          project_id: string
          provider?: string | null
          requested_actions?: Json
          result?: Json | null
          started_at?: string
          steps?: Json
          task_id: string
          technical_decisions?: Json
          user_id: string
        }
        Update: {
          approved_actions?: Json
          completed_at?: string | null
          context_snapshot?: Json | null
          current_step?: string
          errors?: Json
          executed_actions?: Json
          id?: string
          integration_id?: string | null
          project_id?: string
          provider?: string | null
          requested_actions?: Json
          result?: Json | null
          started_at?: string
          steps?: Json
          task_id?: string
          technical_decisions?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pathly_hub_sessoes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pathly_projetos"
            referencedColumns: ["id"]
          },
        ]
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
      pathly_modelos_dados: {
        Row: {
          atualizado_em: string
          checklist_feito: number[]
          criado_em: string
          dialeto: string
          modelo: Json
          projeto_id: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          checklist_feito?: number[]
          criado_em?: string
          dialeto?: string
          modelo: Json
          projeto_id: string
          user_id: string
        }
        Update: {
          atualizado_em?: string
          checklist_feito?: number[]
          criado_em?: string
          dialeto?: string
          modelo?: Json
          projeto_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pathly_modelos_dados_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: true
            referencedRelation: "pathly_projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      pathly_obsidian_conexao: {
        Row: {
          atualizado_em: string
          automatica: boolean
          criado_em: string
          direcao: string
          mapeamento: Json
          mecanismo: string
          pastas: Json
          tipos: Json
          user_id: string
          vault: string
        }
        Insert: {
          atualizado_em?: string
          automatica?: boolean
          criado_em?: string
          direcao?: string
          mapeamento?: Json
          mecanismo?: string
          pastas?: Json
          tipos?: Json
          user_id: string
          vault: string
        }
        Update: {
          atualizado_em?: string
          automatica?: boolean
          criado_em?: string
          direcao?: string
          mapeamento?: Json
          mecanismo?: string
          pastas?: Json
          tipos?: Json
          user_id?: string
          vault?: string
        }
        Relationships: []
      }
      pathly_obsidian_eventos: {
        Row: {
          caminho: string
          criado_em: string
          detalhe: string | null
          evento: string
          id: string
          origem: string
          project_id: string | null
          user_id: string
        }
        Insert: {
          caminho: string
          criado_em?: string
          detalhe?: string | null
          evento: string
          id?: string
          origem: string
          project_id?: string | null
          user_id: string
        }
        Update: {
          caminho?: string
          criado_em?: string
          detalhe?: string | null
          evento?: string
          id?: string
          origem?: string
          project_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pathly_obsidian_eventos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pathly_projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      pathly_obsidian_notas: {
        Row: {
          caminho: string
          id: string
          impressao: string
          project_id: string | null
          sincronizado_em: string
          tipo: string
          user_id: string
        }
        Insert: {
          caminho: string
          id?: string
          impressao: string
          project_id?: string | null
          sincronizado_em?: string
          tipo: string
          user_id: string
        }
        Update: {
          caminho?: string
          id?: string
          impressao?: string
          project_id?: string | null
          sincronizado_em?: string
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pathly_obsidian_notas_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pathly_projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      pathly_ponte_codigos: {
        Row: {
          codigo_hash: string
          criado_em: string
          expira_em: string
          usado_em: string | null
          user_id: string
        }
        Insert: {
          codigo_hash: string
          criado_em?: string
          expira_em: string
          usado_em?: string | null
          user_id: string
        }
        Update: {
          codigo_hash?: string
          criado_em?: string
          expira_em?: string
          usado_em?: string | null
          user_id?: string
        }
        Relationships: []
      }
      pathly_ponte_tarefas: {
        Row: {
          acao_id: string
          concluida_em: string | null
          criada_em: string
          entregue_em: string | null
          estado: string
          expira_em: string
          id: string
          impressao_plano: string | null
          modo: string
          parametros: Json
          plano_id: string | null
          ponte_id: string
          project_id: string | null
          recusa: string | null
          resultado: Json | null
          user_id: string
        }
        Insert: {
          acao_id: string
          concluida_em?: string | null
          criada_em?: string
          entregue_em?: string | null
          estado?: string
          expira_em: string
          id?: string
          impressao_plano?: string | null
          modo: string
          parametros?: Json
          plano_id?: string | null
          ponte_id: string
          project_id?: string | null
          recusa?: string | null
          resultado?: Json | null
          user_id: string
        }
        Update: {
          acao_id?: string
          concluida_em?: string | null
          criada_em?: string
          entregue_em?: string | null
          estado?: string
          expira_em?: string
          id?: string
          impressao_plano?: string | null
          modo?: string
          parametros?: Json
          plano_id?: string | null
          ponte_id?: string
          project_id?: string | null
          recusa?: string | null
          resultado?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pathly_ponte_tarefas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "pathly_ponte_tarefas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pathly_ponte_tarefas_ponte_id_fkey"
            columns: ["ponte_id"]
            isOneToOne: false
            referencedRelation: "pathly_pontes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pathly_ponte_tarefas_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "pathly_projetos"
            referencedColumns: ["id"]
          },
        ]
      }
      pathly_pontes: {
        Row: {
          adaptadores: string[]
          criada_em: string
          id: string
          nome: string
          plataforma: string
          revogada_em: string | null
          token_hash: string
          ultima_batida: string | null
          user_id: string
          versao: string
        }
        Insert: {
          adaptadores?: string[]
          criada_em?: string
          id?: string
          nome: string
          plataforma?: string
          revogada_em?: string | null
          token_hash: string
          ultima_batida?: string | null
          user_id: string
          versao?: string
        }
        Update: {
          adaptadores?: string[]
          criada_em?: string
          id?: string
          nome?: string
          plataforma?: string
          revogada_em?: string | null
          token_hash?: string
          ultima_batida?: string | null
          user_id?: string
          versao?: string
        }
        Relationships: []
      }
      pathly_profiles: {
        Row: {
          assinatura_ate: string | null
          assinatura_evento_em: string | null
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
          assinatura_evento_em?: string | null
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
          assinatura_evento_em?: string | null
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
          respostas: Json
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
          respostas?: Json
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
          respostas?: Json
          status?: string
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
      pathly_revisoes: {
        Row: {
          acertos_seguidos: number
          chave_licao: string
          indice_pergunta: number
          proxima_em: string
          tarefa: string
          total_erros: number
          ultima_em: string
          user_id: string
        }
        Insert: {
          acertos_seguidos?: number
          chave_licao: string
          indice_pergunta: number
          proxima_em: string
          tarefa: string
          total_erros?: number
          ultima_em?: string
          user_id: string
        }
        Update: {
          acertos_seguidos?: number
          chave_licao?: string
          indice_pergunta?: number
          proxima_em?: string
          tarefa?: string
          total_erros?: number
          ultima_em?: string
          user_id?: string
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
      pathly_seguranca: {
        Row: {
          atualizado_em: string
          criado_em: string
          extras: Json
          itens_feitos: string[]
          projeto_id: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          extras?: Json
          itens_feitos?: string[]
          projeto_id: string
          user_id: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          extras?: Json
          itens_feitos?: string[]
          projeto_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pathly_seguranca_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: true
            referencedRelation: "pathly_projetos"
            referencedColumns: ["id"]
          },
        ]
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
      pathly_uso_ia: {
        Row: {
          chamadas: number
          endpoint: string
          janela: string
          user_id: string
        }
        Insert: {
          chamadas?: number
          endpoint: string
          janela: string
          user_id: string
        }
        Update: {
          chamadas?: number
          endpoint?: string
          janela?: string
          user_id?: string
        }
        Relationships: []
      }
      pathly_validacoes: {
        Row: {
          atualizado_em: string
          confirmacoes: Json
          criado_em: string
          projeto_id: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string
          confirmacoes?: Json
          criado_em?: string
          projeto_id: string
          user_id: string
        }
        Update: {
          atualizado_em?: string
          confirmacoes?: Json
          criado_em?: string
          projeto_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pathly_validacoes_projeto_id_fkey"
            columns: ["projeto_id"]
            isOneToOne: true
            referencedRelation: "pathly_projetos"
            referencedColumns: ["id"]
          },
        ]
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
      registrar_uso_ia: {
        Args: { p_endpoint: string; p_janela_minutos: number }
        Returns: number
      }
      registrar_uso_ia_servidor: {
        Args: {
          p_endpoint: string
          p_janela_minutos: number
          p_user_id: string
        }
        Returns: number
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
