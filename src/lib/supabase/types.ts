// Hand-written until `supabase gen types typescript` can be run against the live DB.
// After applying migrations, regenerate with:
//   npx supabase gen types typescript --project-id <project-id> > src/lib/supabase/types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Role        = 'sales' | 'scheduler' | 'installer'
export type JobStatus   = 'scheduled' | 'pending' | 'awaiting_approval' | 'completed'
export type FileKind    = 'photo' | 'voice' | 'do' | 'attachment' | 'completion'
export type MessageKind = 'text' | 'voice'
export type LangCode    = 'en' | 'zh' | 'bn'
export type Punctuality = 'strict' | 'flexible'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id:               string
          auth_id:          string | null
          name:             string
          role:             Role
          telegram_chat_id: string | null
          lang:             LangCode
          phone:            string | null
          visibility:       string[]
          created_at:       string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at'> & {
          id?:         string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }

      jobs: {
        Row: {
          id:                      string
          status:                  JobStatus
          date:                    string
          time_start:              string | null
          time_end:                string | null
          client:                  string
          location:                string
          description:             string | null
          client_poc_name:         string | null
          client_poc_phone:        string | null
          sales_poc_id:            string | null
          production_ready:        boolean
          do_issued:               boolean
          punctuality:             Punctuality
          production_instructions: string | null
          notes:                   string | null
          approved_by:             string | null
          approved_at:             string | null
          completed_at:            string | null
          completion_override:     boolean
          visibility:              string[]
          created_at:              string
          updated_at:              string
        }
        Insert: Omit<
          Database['public']['Tables']['jobs']['Row'],
          'id' | 'created_at' | 'updated_at'
        > & { id?: string; created_at?: string; updated_at?: string }
        Update: Partial<Database['public']['Tables']['jobs']['Insert']>
      }

      job_financials: {
        Row: {
          job_id:        string
          quote_amount:  number | null
          supplier_cost: number | null
          margin_notes:  string | null
          visibility:    string[]
        }
        Insert: Database['public']['Tables']['job_financials']['Row']
        Update: Partial<Database['public']['Tables']['job_financials']['Row']>
      }

      job_assignees: {
        Row:    { job_id: string; user_id: string }
        Insert: Database['public']['Tables']['job_assignees']['Row']
        Update: Partial<Database['public']['Tables']['job_assignees']['Row']>
      }

      files: {
        Row: {
          id:          string
          job_id:      string | null
          kind:        FileKind
          r2_key:      string
          uploader_id: string | null
          visibility:  string[]
          ts:          string
        }
        Insert: Omit<Database['public']['Tables']['files']['Row'], 'id' | 'ts'> & {
          id?: string
          ts?: string
        }
        Update: Partial<Database['public']['Tables']['files']['Insert']>
      }

      messages: {
        Row: {
          id:         string
          job_id:     string
          author_id:  string | null
          kind:       MessageKind
          content:    string | null
          voice_url:  string | null
          visibility: string[]
          ts:         string
        }
        Insert: Omit<Database['public']['Tables']['messages']['Row'], 'id' | 'ts'> & {
          id?: string
          ts?: string
        }
        Update: Partial<Database['public']['Tables']['messages']['Insert']>
      }

      asst_chats: {
        Row: {
          id:         string
          user_id:    string
          msgs:       Json
          embedding:  string | null
          topic:      string | null
          entities:   string[] | null
          tags:       string[] | null
          importance: number | null
          visibility: string[]
          ts:         string
          updated_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['asst_chats']['Row'],
          'id' | 'ts' | 'updated_at'
        > & { id?: string; ts?: string; updated_at?: string }
        Update: Partial<Database['public']['Tables']['asst_chats']['Insert']>
      }

      kb_chunks: {
        Row: {
          id:          string
          source_path: string
          chunk_index: number
          content:     string
          embedding:   string | null
          tags:        string[] | null
          visibility:  string[]
          updated_at:  string
        }
        Insert: Omit<
          Database['public']['Tables']['kb_chunks']['Row'],
          'id' | 'updated_at'
        > & { id?: string; updated_at?: string }
        Update: Partial<Database['public']['Tables']['kb_chunks']['Insert']>
      }

      events: {
        Row: {
          id:           string
          actor_id:     string | null
          kind:         string
          target_id:    string | null
          target_table: string | null
          payload:      Json | null
          visibility:   string[]
          ts:           string
        }
        Insert: Omit<Database['public']['Tables']['events']['Row'], 'id' | 'ts'> & {
          id?: string
          ts?: string
        }
        Update: Partial<Database['public']['Tables']['events']['Insert']>
      }
    }

    Views: Record<string, never>

    Functions: {
      get_my_id:   { Args: Record<string, never>; Returns: string }
      get_my_role: { Args: Record<string, never>; Returns: string }
    }

    Enums: {
      user_role:    Role
      job_status:   JobStatus
      file_kind:    FileKind
      message_kind: MessageKind
      punctuality:  Punctuality
    }
  }
}
