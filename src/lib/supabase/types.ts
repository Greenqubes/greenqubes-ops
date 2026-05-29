// Hand-written until `supabase gen types typescript` can be run against the live DB.
// After applying migrations, regenerate with:
//   npx supabase gen types typescript --project-id <project-id> > src/lib/supabase/types.ts

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Role        = 'sales' | 'scheduler' | 'installer' | 'admin'
export type JobStatus   = 'scheduled' | 'pending' | 'awaiting_approval' | 'completed'
export type FileKind    = 'photo' | 'voice' | 'do' | 'attachment' | 'completion' | 'url_link' | 'production_instructions'
export type MessageKind = 'text' | 'voice'
export type LangCode    = 'en' | 'zh' | 'bn'
export type Punctuality = 'strict' | 'flexible'

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id:                string
          auth_id:           string | null
          email:             string | null
          name:              string
          role:              Role
          telegram_chat_id:  string | null
          lang:              LangCode
          phone:             string | null
          digest_subscriber: boolean
          visibility:        string[]
          years_experience:  number | null
          skills:            string[]
          created_at:        string
          deleted_at:        string | null
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at'> & {
          id?:         string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['users']['Insert']>
        Relationships: []
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
        Relationships: []
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
        Relationships: []
      }

      job_assignees: {
        Row:    { job_id: string; user_id: string }
        Insert: Database['public']['Tables']['job_assignees']['Row']
        Update: Partial<Database['public']['Tables']['job_assignees']['Row']>
        Relationships: []
      }

      files: {
        Row: {
          id:          string
          job_id:      string | null
          kind:        FileKind
          r2_key:      string
          uploader_id: string | null
          bucket_id:   string | null
          url_text:    string | null
          visibility:  string[]
          ts:          string
        }
        Insert: Omit<Database['public']['Tables']['files']['Row'], 'id' | 'ts'> & {
          id?: string
          ts?: string
        }
        Update: Partial<Database['public']['Tables']['files']['Insert']>
        Relationships: []
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
        Relationships: []
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
          pinned:     boolean
          visibility: string[]
          ts:         string
          updated_at: string
        }
        Insert: {
          id?:         string
          user_id:     string
          msgs:        Json
          embedding?:  string | null
          topic?:      string | null
          entities?:   string[] | null
          tags?:       string[] | null
          importance?: number | null
          pinned?:     boolean
          visibility:  string[]
          ts?:         string
          updated_at?: string
        }
        Update: {
          id?:         string
          user_id?:    string
          msgs?:       Json
          embedding?:  string | null
          topic?:      string | null
          entities?:   string[] | null
          tags?:       string[] | null
          importance?: number | null
          pinned?:     boolean
          visibility?: string[]
          ts?:         string
          updated_at?: string
        }
        Relationships: []
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
        Relationships: []
      }

      digest_votes: {
        Row: {
          id:       string
          chat_id:  string
          voter_id: string
          vote:     'yes' | 'no'
          ts:       string
        }
        Insert: Omit<Database['public']['Tables']['digest_votes']['Row'], 'id' | 'ts'> & {
          id?: string
          ts?: string
        }
        Update: Partial<Database['public']['Tables']['digest_votes']['Insert']>
        Relationships: []
      }

      api_usage_logs: {
        Row: {
          id:             string
          service:        string
          endpoint:       string
          called_by:      string | null
          job_id:         string | null
          tokens_in:      number | null
          tokens_out:     number | null
          estimated_cost: number | null
          ip_address:     string | null
          user_agent:     string | null
          ts:             string
        }
        Insert: Omit<Database['public']['Tables']['api_usage_logs']['Row'], 'id' | 'ts'> & {
          id?: string
          ts?: string
        }
        Update: Partial<Database['public']['Tables']['api_usage_logs']['Insert']>
        Relationships: []
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
        Relationships: []
      }

      crash_logs: {
        Row: {
          id:              string
          occurred_at:     string
          route:           string
          error_message:   string
          stack_trace:     string | null
          component_stack: string | null
          user_id:         string | null
          user_email:      string | null
          user_agent:      string | null
          markdown_body:   string
          resolved:        boolean
        }
        Insert: Omit<
          Database['public']['Tables']['crash_logs']['Row'],
          'id' | 'occurred_at' | 'user_id' | 'resolved'
        > & {
          id?:          string
          occurred_at?: string
          user_id?:     string | null
          resolved?:    boolean
        }
        Update: Partial<Database['public']['Tables']['crash_logs']['Insert']>
        Relationships: []
      }

      attachment_buckets: {
        Row: {
          id:         string
          job_id:     string
          name:       string
          position:   number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['attachment_buckets']['Row'], 'id' | 'created_at'> & {
          id?: string; created_at?: string
        }
        Update: Partial<Database['public']['Tables']['attachment_buckets']['Insert']>
        Relationships: []
      }

      clients: {
        Row:    { id: string; name: string }
        Insert: { id?: string; name: string }
        Update: Partial<{ id: string; name: string }>
        Relationships: []
      }

      client_contacts: {
        Row:    { id: string; client_id: string; name: string }
        Insert: { id?: string; client_id: string; name: string }
        Update: Partial<{ id: string; client_id: string; name: string }>
        Relationships: []
      }

      bug_reports: {
        Row: {
          id:             string
          user_email:     string | null
          user_role:      string | null
          route:          string | null
          message:        string
          priority:       'low' | 'medium' | 'high' | 'urgent'
          status:         'open' | 'fixed'
          screenshot_key: string | null
          markdown_file:  string | null
          ip_address:     string | null
          platform:       string | null
          browser:        string | null
          os:             string | null
          screen:         string | null
          created_at:       string
          resolved_at:      string | null
          github_issue_url: string | null
        }
        Insert: Omit<
          Database['public']['Tables']['bug_reports']['Row'],
          'id' | 'created_at' | 'status' | 'resolved_at' | 'github_issue_url'
        > & {
          id?:               string
          created_at?:       string
          status?:           'open' | 'fixed'
          resolved_at?:      string | null
          github_issue_url?: string | null
        }
        Update: Partial<Database['public']['Tables']['bug_reports']['Insert']>
        Relationships: []
      }
    }

    Views: Record<string, never>

    Functions: {
      get_my_id:   { Args: Record<string, never>; Returns: string }
      get_my_role: { Args: Record<string, never>; Returns: string }
      match_kb_chunks: {
        Args: { query_embedding: number[]; match_threshold?: number; match_count?: number }
        Returns: { id: string; source_path: string; content: string; tags: string[] | null; similarity: number }[]
      }
      match_asst_chats: {
        Args: { query_embedding: number[]; match_threshold?: number; match_count?: number }
        Returns: { id: string; topic: string | null; msgs: Json; tags: string[] | null; importance: number | null; similarity: number }[]
      }
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
