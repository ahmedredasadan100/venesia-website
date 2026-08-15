// Generated from the connected Supabase public schema. PostgreSQL introspection
// does not expose function-argument nullability; the nullable RPC fields marked
// below mirror the canonical SQL contracts in sql/migrations.
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
      admin_audit_logs: {
        Row: {
          action: string
          actor_admin_user_id: number | null
          actor_username: string
          created_at: string
          entity_id: number | null
          entity_label: string | null
          entity_type: string | null
          id: number
          ip_address: string | null
          metadata: Json
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_admin_user_id?: number | null
          actor_username: string
          created_at?: string
          entity_id?: number | null
          entity_label?: string | null
          entity_type?: string | null
          id?: number
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_admin_user_id?: number | null
          actor_username?: string
          created_at?: string
          entity_id?: number | null
          entity_label?: string | null
          entity_type?: string | null
          id?: number
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_logs_actor_admin_user_id_fkey"
            columns: ["actor_admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_user_preferences: {
        Row: {
          admin_user_id: number
          created_at: string
          preferences: Json
          updated_at: string
          view_key: string
        }
        Insert: {
          admin_user_id: number
          created_at?: string
          preferences?: Json
          updated_at?: string
          view_key: string
        }
        Update: {
          admin_user_id?: number
          created_at?: string
          preferences?: Json
          updated_at?: string
          view_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_user_preferences_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: number
          is_active: boolean
          last_login_at: string | null
          password_hash: string
          role: string
          session_version: number
          updated_at: string
          username: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: number
          is_active?: boolean
          last_login_at?: string | null
          password_hash: string
          role?: string
          session_version?: number
          updated_at?: string
          username: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: number
          is_active?: boolean
          last_login_at?: string | null
          password_hash?: string
          role?: string
          session_version?: number
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      analytics_provider_read_models: {
        Row: {
          checked_at: string
          compare_key: string
          connection_id: string
          id: string
          message: string
          metrics: Json
          period_key: string
          provider_key: string
          source_updated_at: string
          status: string
          watermark: Json
        }
        Insert: {
          checked_at?: string
          compare_key: string
          connection_id: string
          id?: string
          message: string
          metrics?: Json
          period_key: string
          provider_key: string
          source_updated_at: string
          status: string
          watermark?: Json
        }
        Update: {
          checked_at?: string
          compare_key?: string
          connection_id?: string
          id?: string
          message?: string
          metrics?: Json
          period_key?: string
          provider_key?: string
          source_updated_at?: string
          status?: string
          watermark?: Json
        }
        Relationships: [
          {
            foreignKeyName: "analytics_provider_read_models_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      breadcrumb_block_templates: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          id: number
          name: string
          slug: string
          sort_order: number
          status: string
          style_preset: string
          updated_at: string
          variant: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: number
          name: string
          slug: string
          sort_order?: number
          status?: string
          style_preset?: string
          updated_at?: string
          variant?: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: number
          name?: string
          slug?: string
          sort_order?: number
          status?: string
          style_preset?: string
          updated_at?: string
          variant?: string
        }
        Relationships: []
      }
      cards_block_templates: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          id: number
          name: string
          slug: string
          sort_order: number
          status: string
          style_preset: string
          updated_at: string
          variant: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: number
          name: string
          slug: string
          sort_order?: number
          status?: string
          style_preset?: string
          updated_at?: string
          variant?: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: number
          name?: string
          slug?: string
          sort_order?: number
          status?: string
          style_preset?: string
          updated_at?: string
          variant?: string
        }
        Relationships: []
      }
      content_block_templates: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          id: number
          name: string
          slug: string
          sort_order: number
          status: string
          style_preset: string
          updated_at: string
          variant: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: number
          name: string
          slug: string
          sort_order?: number
          status?: string
          style_preset?: string
          updated_at?: string
          variant?: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: number
          name?: string
          slug?: string
          sort_order?: number
          status?: string
          style_preset?: string
          updated_at?: string
          variant?: string
        }
        Relationships: []
      }
      cta_block_templates: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          id: number
          name: string
          slug: string
          sort_order: number
          status: string
          style_preset: string
          updated_at: string
          variant: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: number
          name: string
          slug: string
          sort_order?: number
          status?: string
          style_preset?: string
          updated_at?: string
          variant?: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: number
          name?: string
          slug?: string
          sort_order?: number
          status?: string
          style_preset?: string
          updated_at?: string
          variant?: string
        }
        Relationships: []
      }
      feed_module_templates: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          feed_type: string
          id: number
          name: string
          slug: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          feed_type: string
          id?: number
          name: string
          slug: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          feed_type?: string
          id?: number
          name?: string
          slug?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      hero_assignments: {
        Row: {
          created_at: string
          hero_id: number
          id: number
          is_active: boolean
          path: string | null
          priority: number
          target_id: number | null
          target_slug: string | null
          target_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          hero_id: number
          id?: number
          is_active?: boolean
          path?: string | null
          priority?: number
          target_id?: number | null
          target_slug?: string | null
          target_type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          hero_id?: number
          id?: number
          is_active?: boolean
          path?: string | null
          priority?: number
          target_id?: number | null
          target_slug?: string | null
          target_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hero_assignments_hero_id_fkey"
            columns: ["hero_id"]
            isOneToOne: false
            referencedRelation: "hero_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      hero_templates: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          id: number
          is_visible: boolean
          limit_count: number
          name: string
          section_key: string
          slug: string
          sort_order: number
          source_id: number | null
          source_slug: string | null
          source_type: string
          status: string
          style_preset: string
          updated_at: string
          variant: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: number
          is_visible?: boolean
          limit_count?: number
          name: string
          section_key?: string
          slug: string
          sort_order?: number
          source_id?: number | null
          source_slug?: string | null
          source_type?: string
          status?: string
          style_preset?: string
          updated_at?: string
          variant?: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: number
          is_visible?: boolean
          limit_count?: number
          name?: string
          section_key?: string
          slug?: string
          sort_order?: number
          source_id?: number | null
          source_slug?: string | null
          source_type?: string
          status?: string
          style_preset?: string
          updated_at?: string
          variant?: string
        }
        Relationships: []
      }
      integration_app_configuration_entries: {
        Row: {
          configuration_key: string
          group_id: string
          is_secret: boolean
          provider_key: string
          safe_metadata: Json
          safe_value: string | null
          updated_at: string
          vault_secret_id: string | null
        }
        Insert: {
          configuration_key: string
          group_id: string
          is_secret: boolean
          provider_key: string
          safe_metadata?: Json
          safe_value?: string | null
          updated_at?: string
          vault_secret_id?: string | null
        }
        Update: {
          configuration_key?: string
          group_id?: string
          is_secret?: boolean
          provider_key?: string
          safe_metadata?: Json
          safe_value?: string | null
          updated_at?: string
          vault_secret_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integration_app_configuration_entrie_group_id_provider_key_fkey"
            columns: ["group_id", "provider_key"]
            isOneToOne: false
            referencedRelation: "integration_app_configuration_groups"
            referencedColumns: ["id", "provider_key"]
          },
        ]
      }
      integration_app_configuration_groups: {
        Row: {
          configuration_source: string
          created_at: string
          environment_key: string
          id: string
          provider_key: string
          updated_at: string
          updated_by_admin_user_id: number | null
          version: number
        }
        Insert: {
          configuration_source?: string
          created_at?: string
          environment_key: string
          id?: string
          provider_key: string
          updated_at?: string
          updated_by_admin_user_id?: number | null
          version?: number
        }
        Update: {
          configuration_source?: string
          created_at?: string
          environment_key?: string
          id?: string
          provider_key?: string
          updated_at?: string
          updated_by_admin_user_id?: number | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "integration_app_configuration_gro_updated_by_admin_user_id_fkey"
            columns: ["updated_by_admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_app_configuration_validations: {
        Row: {
          group_id: string
          integration_key: string
          last_tested_at: string | null
          missing_keys: string[]
          provider_key: string
          safe_error_code: string | null
          status: string
          test_attempts_in_window: number
          test_window_started_at: string | null
          updated_at: string
          version: number
        }
        Insert: {
          group_id: string
          integration_key: string
          last_tested_at?: string | null
          missing_keys?: string[]
          provider_key: string
          safe_error_code?: string | null
          status: string
          test_attempts_in_window?: number
          test_window_started_at?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          group_id?: string
          integration_key?: string
          last_tested_at?: string | null
          missing_keys?: string[]
          provider_key?: string
          safe_error_code?: string | null
          status?: string
          test_attempts_in_window?: number
          test_window_started_at?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "integration_app_configuration_valida_group_id_provider_key_fkey"
            columns: ["group_id", "provider_key"]
            isOneToOne: false
            referencedRelation: "integration_app_configuration_groups"
            referencedColumns: ["id", "provider_key"]
          },
        ]
      }
      integration_authorization_attempts: {
        Row: {
          actor_admin_user_id: number
          consumed_at: string | null
          created_at: string
          environment_key: string
          expires_at: string
          failure_code: string | null
          id: string
          integration_key: string
          pkce_verifier_secret_id: string | null
          return_path: string
          state_hash: string
        }
        Insert: {
          actor_admin_user_id: number
          consumed_at?: string | null
          created_at?: string
          environment_key: string
          expires_at: string
          failure_code?: string | null
          id?: string
          integration_key: string
          pkce_verifier_secret_id?: string | null
          return_path: string
          state_hash: string
        }
        Update: {
          actor_admin_user_id?: number
          consumed_at?: string | null
          created_at?: string
          environment_key?: string
          expires_at?: string
          failure_code?: string | null
          id?: string
          integration_key?: string
          pkce_verifier_secret_id?: string | null
          return_path?: string
          state_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_authorization_attempts_actor_admin_user_id_fkey"
            columns: ["actor_admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connection_assets: {
        Row: {
          asset_type: string
          connection_id: string
          discovered_at: string
          display_name: string
          external_id: string
          id: string
          metadata: Json
          parent_external_id: string | null
          permissions: string[]
          selected: boolean
        }
        Insert: {
          asset_type: string
          connection_id: string
          discovered_at?: string
          display_name: string
          external_id: string
          id?: string
          metadata?: Json
          parent_external_id?: string | null
          permissions?: string[]
          selected?: boolean
        }
        Update: {
          asset_type?: string
          connection_id?: string
          discovered_at?: string
          display_name?: string
          external_id?: string
          id?: string
          metadata?: Json
          parent_external_id?: string | null
          permissions?: string[]
          selected?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "integration_connection_assets_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_connections: {
        Row: {
          access_expires_at: string | null
          backoff_until: string | null
          consecutive_failures: number
          created_at: string
          created_by_admin_user_id: number
          credential_strategy: string
          environment_key: string
          external_subject_id: string | null
          granted_scopes: string[]
          id: string
          integration_key: string
          last_error_code: string | null
          last_error_message: string | null
          last_sync_at: string | null
          last_validated_at: string | null
          next_sync_at: string | null
          refresh_expires_at: string | null
          revoked_at: string | null
          status: string
          sync_watermark: Json
          updated_at: string
          updated_by_admin_user_id: number
          version: number
        }
        Insert: {
          access_expires_at?: string | null
          backoff_until?: string | null
          consecutive_failures?: number
          created_at?: string
          created_by_admin_user_id: number
          credential_strategy: string
          environment_key: string
          external_subject_id?: string | null
          granted_scopes?: string[]
          id?: string
          integration_key: string
          last_error_code?: string | null
          last_error_message?: string | null
          last_sync_at?: string | null
          last_validated_at?: string | null
          next_sync_at?: string | null
          refresh_expires_at?: string | null
          revoked_at?: string | null
          status: string
          sync_watermark?: Json
          updated_at?: string
          updated_by_admin_user_id: number
          version?: number
        }
        Update: {
          access_expires_at?: string | null
          backoff_until?: string | null
          consecutive_failures?: number
          created_at?: string
          created_by_admin_user_id?: number
          credential_strategy?: string
          environment_key?: string
          external_subject_id?: string | null
          granted_scopes?: string[]
          id?: string
          integration_key?: string
          last_error_code?: string | null
          last_error_message?: string | null
          last_sync_at?: string | null
          last_validated_at?: string | null
          next_sync_at?: string | null
          refresh_expires_at?: string | null
          revoked_at?: string | null
          status?: string
          sync_watermark?: Json
          updated_at?: string
          updated_by_admin_user_id?: number
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "integration_connections_created_by_admin_user_id_fkey"
            columns: ["created_by_admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_connections_updated_by_admin_user_id_fkey"
            columns: ["updated_by_admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_credentials: {
        Row: {
          access_secret_id: string
          connection_id: string
          credential_strategy: string
          refresh_secret_id: string | null
          updated_at: string
        }
        Insert: {
          access_secret_id: string
          connection_id: string
          credential_strategy: string
          refresh_secret_id?: string | null
          updated_at?: string
        }
        Update: {
          access_secret_id?: string
          connection_id?: string
          credential_strategy?: string
          refresh_secret_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_credentials_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: true
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_sync_runs: {
        Row: {
          attempt_number: number
          completed_at: string | null
          connection_id: string
          error_code: string | null
          error_message: string | null
          id: string
          lease_token: string | null
          leased_until: string | null
          queued_at: string
          records_written: number
          started_at: string | null
          status: string
          trigger_kind: string
          watermark_after: Json
          watermark_before: Json
        }
        Insert: {
          attempt_number?: number
          completed_at?: string | null
          connection_id: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          lease_token?: string | null
          leased_until?: string | null
          queued_at?: string
          records_written?: number
          started_at?: string | null
          status: string
          trigger_kind: string
          watermark_after?: Json
          watermark_before?: Json
        }
        Update: {
          attempt_number?: number
          completed_at?: string | null
          connection_id?: string
          error_code?: string | null
          error_message?: string | null
          id?: string
          lease_token?: string | null
          leased_until?: string | null
          queued_at?: string
          records_written?: number
          started_at?: string | null
          status?: string
          trigger_kind?: string
          watermark_after?: Json
          watermark_before?: Json
        }
        Relationships: [
          {
            foreignKeyName: "integration_sync_runs_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "integration_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      media_assets: {
        Row: {
          bucket: string
          byte_size: number | null
          checksum: string | null
          created_at: string
          default_alt_text: string | null
          default_caption: string | null
          default_title: string | null
          display_name: string
          extension: string
          folder_path: string
          height: number | null
          id: string
          media_kind: string
          metadata: Json
          mime_type: string | null
          missing_object: boolean
          object_key: string
          original_filename: string
          provider: string
          public_url: string
          reconciliation_state: string
          status: string
          updated_at: string
          uploaded_by: number | null
          width: number | null
        }
        Insert: {
          bucket: string
          byte_size?: number | null
          checksum?: string | null
          created_at?: string
          default_alt_text?: string | null
          default_caption?: string | null
          default_title?: string | null
          display_name: string
          extension: string
          folder_path: string
          height?: number | null
          id?: string
          media_kind: string
          metadata?: Json
          mime_type?: string | null
          missing_object?: boolean
          object_key: string
          original_filename: string
          provider: string
          public_url: string
          reconciliation_state?: string
          status?: string
          updated_at?: string
          uploaded_by?: number | null
          width?: number | null
        }
        Update: {
          bucket?: string
          byte_size?: number | null
          checksum?: string | null
          created_at?: string
          default_alt_text?: string | null
          default_caption?: string | null
          default_title?: string | null
          display_name?: string
          extension?: string
          folder_path?: string
          height?: number | null
          id?: string
          media_kind?: string
          metadata?: Json
          mime_type?: string | null
          missing_object?: boolean
          object_key?: string
          original_filename?: string
          provider?: string
          public_url?: string
          reconciliation_state?: string
          status?: string
          updated_at?: string
          uploaded_by?: number | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_folder_fkey"
            columns: ["folder_path"]
            isOneToOne: false
            referencedRelation: "admin_media_folders_catalog"
            referencedColumns: ["normalized_path"]
          },
          {
            foreignKeyName: "media_assets_folder_fkey"
            columns: ["folder_path"]
            isOneToOne: false
            referencedRelation: "media_folders"
            referencedColumns: ["normalized_path"]
          },
          {
            foreignKeyName: "media_assets_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      media_delete_reservations: {
        Row: {
          actor_id: number | null
          asset_id: string
          created_at: string
          environment: string
          environment_key: string
          failure_code: string | null
          failure_metadata: Json
          finished_at: string | null
          id: string
          previous_asset_status: string
          previous_missing_object: boolean
          previous_reconciliation_state: string
          provider: string
          provider_registry_version: string
          request_identity: string | null
          reserved_bucket: string
          reserved_object_key: string
          reserved_public_url: string
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          actor_id?: number | null
          asset_id: string
          created_at?: string
          environment: string
          environment_key: string
          failure_code?: string | null
          failure_metadata?: Json
          finished_at?: string | null
          id?: string
          previous_asset_status: string
          previous_missing_object: boolean
          previous_reconciliation_state: string
          provider: string
          provider_registry_version: string
          request_identity?: string | null
          reserved_bucket: string
          reserved_object_key: string
          reserved_public_url: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          actor_id?: number | null
          asset_id?: string
          created_at?: string
          environment?: string
          environment_key?: string
          failure_code?: string | null
          failure_metadata?: Json
          finished_at?: string | null
          id?: string
          previous_asset_status?: string
          previous_missing_object?: boolean
          previous_reconciliation_state?: string
          provider?: string
          provider_registry_version?: string
          request_identity?: string | null
          reserved_bucket?: string
          reserved_object_key?: string
          reserved_public_url?: string
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_delete_reservations_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_delete_reservations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "admin_media_assets_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_delete_reservations_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      media_folders: {
        Row: {
          created_at: string
          created_by: number | null
          display_name: string
          id: string
          normalized_path: string
          parent_path: string | null
          reconciliation_state: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: number | null
          display_name: string
          id?: string
          normalized_path: string
          parent_path?: string | null
          reconciliation_state?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: number | null
          display_name?: string
          id?: string
          normalized_path?: string
          parent_path?: string | null
          reconciliation_state?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_folders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_folders_parent_fkey"
            columns: ["parent_path"]
            isOneToOne: false
            referencedRelation: "admin_media_folders_catalog"
            referencedColumns: ["normalized_path"]
          },
          {
            foreignKeyName: "media_folders_parent_fkey"
            columns: ["parent_path"]
            isOneToOne: false
            referencedRelation: "media_folders"
            referencedColumns: ["normalized_path"]
          },
        ]
      }
      media_hub_module_templates: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          id: number
          name: string
          section_key: string
          slug: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: number
          name: string
          section_key: string
          slug: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: number
          name?: string
          section_key?: string
          slug?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      media_reference_provider_revisions: {
        Row: {
          created_at: string
          domain_key: string
          revision: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain_key: string
          revision?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain_key?: string
          revision?: number
          updated_at?: string
        }
        Relationships: []
      }
      media_reference_write_leases: {
        Row: {
          actor_id: number | null
          asset_id: string
          completed_at: string | null
          created_at: string
          domain_key: string
          entity_identity: string
          entity_type: string
          environment: string
          environment_key: string
          expires_at: string
          failure_code: string | null
          failure_metadata: Json
          id: string
          lease_token: string
          provider: string
          provider_registry_version: string
          request_identity: string | null
          resolved_at: string | null
          started_at: string
          status: string
          synchronized_targets: Json
          updated_at: string
          write_targets: Json
        }
        Insert: {
          actor_id?: number | null
          asset_id: string
          completed_at?: string | null
          created_at?: string
          domain_key: string
          entity_identity: string
          entity_type: string
          environment: string
          environment_key: string
          expires_at: string
          failure_code?: string | null
          failure_metadata?: Json
          id?: string
          lease_token: string
          provider: string
          provider_registry_version: string
          request_identity?: string | null
          resolved_at?: string | null
          started_at?: string
          status?: string
          synchronized_targets?: Json
          updated_at?: string
          write_targets?: Json
        }
        Update: {
          actor_id?: number | null
          asset_id?: string
          completed_at?: string | null
          created_at?: string
          domain_key?: string
          entity_identity?: string
          entity_type?: string
          environment?: string
          environment_key?: string
          expires_at?: string
          failure_code?: string | null
          failure_metadata?: Json
          id?: string
          lease_token?: string
          provider?: string
          provider_registry_version?: string
          request_identity?: string | null
          resolved_at?: string | null
          started_at?: string
          status?: string
          synchronized_targets?: Json
          updated_at?: string
          write_targets?: Json
        }
        Relationships: [
          {
            foreignKeyName: "media_reference_write_leases_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_reference_write_leases_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "admin_media_assets_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_reference_write_leases_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      media_references: {
        Row: {
          asset_id: string
          created_at: string
          domain_key: string
          edit_href: string | null
          entity_identity: string
          entity_label: string | null
          entity_type: string
          field_key: string
          id: string
          metadata: Json
          public_href: string | null
          reference_state: string
          restorable: boolean
          updated_at: string
        }
        Insert: {
          asset_id: string
          created_at?: string
          domain_key: string
          edit_href?: string | null
          entity_identity: string
          entity_label?: string | null
          entity_type: string
          field_key: string
          id?: string
          metadata?: Json
          public_href?: string | null
          reference_state?: string
          restorable?: boolean
          updated_at?: string
        }
        Update: {
          asset_id?: string
          created_at?: string
          domain_key?: string
          edit_href?: string | null
          entity_identity?: string
          entity_label?: string | null
          entity_type?: string
          field_key?: string
          id?: string
          metadata?: Json
          public_href?: string | null
          reference_state?: string
          restorable?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_references_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "admin_media_assets_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_references_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      media_sidebar_module_templates: {
        Row: {
          config: Json
          created_at: string
          description: string | null
          id: number
          name: string
          slug: string
          sort_order: number
          status: string
          updated_at: string
          widget_key: string
        }
        Insert: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: number
          name: string
          slug: string
          sort_order?: number
          status?: string
          updated_at?: string
          widget_key: string
        }
        Update: {
          config?: Json
          created_at?: string
          description?: string | null
          id?: number
          name?: string
          slug?: string
          sort_order?: number
          status?: string
          updated_at?: string
          widget_key?: string
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          anchor: string | null
          created_at: string
          css_class: string | null
          href: string | null
          id: number
          is_visible: boolean
          item_type: string
          label: string
          linked_id: number | null
          linked_type: string | null
          menu_id: number
          parent_id: number | null
          sort_order: number
          style_preset: string
          target: string
          updated_at: string
        }
        Insert: {
          anchor?: string | null
          created_at?: string
          css_class?: string | null
          href?: string | null
          id?: number
          is_visible?: boolean
          item_type?: string
          label: string
          linked_id?: number | null
          linked_type?: string | null
          menu_id: number
          parent_id?: number | null
          sort_order?: number
          style_preset?: string
          target?: string
          updated_at?: string
        }
        Update: {
          anchor?: string | null
          created_at?: string
          css_class?: string | null
          href?: string | null
          id?: number
          is_visible?: boolean
          item_type?: string
          label?: string
          linked_id?: number | null
          linked_type?: string | null
          menu_id?: number
          parent_id?: number | null
          sort_order?: number
          style_preset?: string
          target?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_menu_id_fkey"
            columns: ["menu_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "menu_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "menu_items"
            referencedColumns: ["id"]
          },
        ]
      }
      menus: {
        Row: {
          created_at: string
          id: number
          is_active: boolean
          location: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_active?: boolean
          location?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          is_active?: boolean
          location?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      page_breadcrumb_block_assignments: {
        Row: {
          created_at: string
          id: number
          is_visible: boolean
          page_id: number
          slot: string
          sort_order: number
          template_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_visible?: boolean
          page_id: number
          slot?: string
          sort_order?: number
          template_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          is_visible?: boolean
          page_id?: number
          slot?: string
          sort_order?: number
          template_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_breadcrumb_block_assignments_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_breadcrumb_block_assignments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "breadcrumb_block_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      page_cards_block_assignments: {
        Row: {
          created_at: string
          id: number
          is_visible: boolean
          page_id: number
          slot: string
          sort_order: number
          template_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_visible?: boolean
          page_id: number
          slot?: string
          sort_order?: number
          template_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          is_visible?: boolean
          page_id?: number
          slot?: string
          sort_order?: number
          template_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_cards_block_assignments_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_cards_block_assignments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "cards_block_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      page_content_block_assignments: {
        Row: {
          created_at: string
          id: number
          is_visible: boolean
          page_id: number
          slot: string
          sort_order: number
          template_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_visible?: boolean
          page_id: number
          slot?: string
          sort_order?: number
          template_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          is_visible?: boolean
          page_id?: number
          slot?: string
          sort_order?: number
          template_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_content_block_assignments_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_content_block_assignments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "content_block_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      page_cta_block_assignments: {
        Row: {
          created_at: string
          id: number
          is_visible: boolean
          page_id: number
          slot: string
          sort_order: number
          template_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_visible?: boolean
          page_id: number
          slot?: string
          sort_order?: number
          template_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          is_visible?: boolean
          page_id?: number
          slot?: string
          sort_order?: number
          template_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_cta_block_assignments_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_cta_block_assignments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "cta_block_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      page_feed_module_assignments: {
        Row: {
          created_at: string
          id: number
          is_visible: boolean
          page_id: number
          slot: string
          sort_order: number
          template_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_visible?: boolean
          page_id: number
          slot?: string
          sort_order?: number
          template_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          is_visible?: boolean
          page_id?: number
          slot?: string
          sort_order?: number
          template_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_feed_module_assignments_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_feed_module_assignments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "feed_module_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      page_media_hub_module_assignments: {
        Row: {
          created_at: string
          id: number
          is_visible: boolean
          page_id: number
          slot: string
          sort_order: number
          template_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_visible?: boolean
          page_id: number
          slot?: string
          sort_order?: number
          template_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          is_visible?: boolean
          page_id?: number
          slot?: string
          sort_order?: number
          template_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_media_hub_module_assignments_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_media_hub_module_assignments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "media_hub_module_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      page_media_sidebar_module_assignments: {
        Row: {
          created_at: string
          id: number
          is_visible: boolean
          page_id: number
          slot: string
          sort_order: number
          template_id: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: number
          is_visible?: boolean
          page_id: number
          slot?: string
          sort_order?: number
          template_id: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: number
          is_visible?: boolean
          page_id?: number
          slot?: string
          sort_order?: number
          template_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_media_sidebar_module_assignments_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "page_media_sidebar_module_assignments_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "media_sidebar_module_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      pages: {
        Row: {
          canonical_url: string | null
          created_at: string
          focus_keyword: string
          id: number
          is_system: boolean
          og_image: string | null
          og_image_alt: string
          page_type: string
          path: string
          robots_follow: boolean | null
          robots_index: boolean | null
          seo_description: string
          seo_keywords: string[]
          seo_title: string
          slug: string
          sort_order: number
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          canonical_url?: string | null
          created_at?: string
          focus_keyword?: string
          id?: number
          is_system?: boolean
          og_image?: string | null
          og_image_alt?: string
          page_type?: string
          path: string
          robots_follow?: boolean | null
          robots_index?: boolean | null
          seo_description?: string
          seo_keywords?: string[]
          seo_title?: string
          slug: string
          sort_order?: number
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          canonical_url?: string | null
          created_at?: string
          focus_keyword?: string
          id?: number
          is_system?: boolean
          og_image?: string | null
          og_image_alt?: string
          page_type?: string
          path?: string
          robots_follow?: boolean | null
          robots_index?: boolean | null
          seo_description?: string
          seo_keywords?: string[]
          seo_title?: string
          slug?: string
          sort_order?: number
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      project_delivery_items: {
        Row: {
          body: string
          client_key: string
          created_at: string
          id: number
          project_id: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          body: string
          client_key?: string
          created_at?: string
          id?: number
          project_id: number
          sort_order: number
          updated_at?: string
        }
        Update: {
          body?: string
          client_key?: string
          created_at?: string
          id?: number
          project_id?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_delivery_items_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_features: {
        Row: {
          body: string
          client_key: string
          created_at: string
          id: number
          project_id: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          body: string
          client_key?: string
          created_at?: string
          id?: number
          project_id: number
          sort_order: number
          updated_at?: string
        }
        Update: {
          body?: string
          client_key?: string
          created_at?: string
          id?: number
          project_id?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_features_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_floor_plan_details: {
        Row: {
          client_key: string
          created_at: string
          floor_plan_id: number
          id: number
          label: string
          sort_order: number
          updated_at: string
          value: string
        }
        Insert: {
          client_key?: string
          created_at?: string
          floor_plan_id: number
          id?: number
          label: string
          sort_order: number
          updated_at?: string
          value: string
        }
        Update: {
          client_key?: string
          created_at?: string
          floor_plan_id?: number
          id?: number
          label?: string
          sort_order?: number
          updated_at?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_floor_plan_details_floor_plan_id_fkey"
            columns: ["floor_plan_id"]
            isOneToOne: false
            referencedRelation: "project_floor_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      project_floor_plans: {
        Row: {
          architectural_image: string | null
          architectural_image_alt: string
          area_text: string
          client_key: string
          created_at: string
          featured: boolean
          furnishing_image: string | null
          furnishing_image_alt: string
          id: number
          name: string
          project_id: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          architectural_image?: string | null
          architectural_image_alt?: string
          area_text?: string
          client_key?: string
          created_at?: string
          featured?: boolean
          furnishing_image?: string | null
          furnishing_image_alt?: string
          id?: number
          name: string
          project_id: number
          sort_order: number
          updated_at?: string
        }
        Update: {
          architectural_image?: string | null
          architectural_image_alt?: string
          area_text?: string
          client_key?: string
          created_at?: string
          featured?: boolean
          furnishing_image?: string | null
          furnishing_image_alt?: string
          id?: number
          name?: string
          project_id?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_floor_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_location_points: {
        Row: {
          client_key: string
          created_at: string
          distance_text: string
          id: number
          kind: string
          label: string
          project_id: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          client_key?: string
          created_at?: string
          distance_text?: string
          id?: number
          kind: string
          label: string
          project_id: number
          sort_order: number
          updated_at?: string
        }
        Update: {
          client_key?: string
          created_at?: string
          distance_text?: string
          id?: number
          kind?: string
          label?: string
          project_id?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_location_points_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_locations: {
        Row: {
          client_key: string
          created_at: string
          id: number
          is_active: boolean
          level: string
          name_ar: string
          name_en: string | null
          parent_id: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          client_key?: string
          created_at?: string
          id?: number
          is_active?: boolean
          level: string
          name_ar: string
          name_en?: string | null
          parent_id?: number | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          client_key?: string
          created_at?: string
          id?: number
          is_active?: boolean
          level?: string
          name_ar?: string
          name_en?: string | null
          parent_id?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_locations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "project_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      project_media: {
        Row: {
          alt_text: string
          client_key: string
          created_at: string
          id: number
          image: string
          project_id: number
          section: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          alt_text: string
          client_key?: string
          created_at?: string
          id?: number
          image: string
          project_id: number
          section: string
          sort_order: number
          updated_at?: string
        }
        Update: {
          alt_text?: string
          client_key?: string
          created_at?: string
          id?: number
          image?: string
          project_id?: number
          section?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_media_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_videos: {
        Row: {
          client_key: string
          created_at: string
          id: number
          poster_alt: string
          poster_image: string | null
          project_id: number
          section: string
          sort_order: number
          updated_at: string
          video_url: string
        }
        Insert: {
          client_key?: string
          created_at?: string
          id?: number
          poster_alt?: string
          poster_image?: string | null
          project_id: number
          section: string
          sort_order: number
          updated_at?: string
          video_url: string
        }
        Update: {
          client_key?: string
          created_at?: string
          id?: number
          poster_alt?: string
          poster_image?: string | null
          project_id?: number
          section?: string
          sort_order?: number
          updated_at?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_videos_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          arabic_name: string
          brochure_url: string | null
          canonical_url: string | null
          city_id: number
          code: string
          created_at: string
          delivery_body: string
          delivery_title: string
          english_name: string
          featured: boolean
          focus_keyword: string
          general_description: string
          google_maps_url: string
          governorate_id: number
          hero_image: string
          hero_image_alt: string
          homepage_order: number
          id: number
          image: string
          image_alt: string
          latitude: number
          location_description: string
          location_label: string
          longitude: number
          main_area_id: number
          map_zoom: number
          og_image: string | null
          og_image_alt: string
          overview_body: string
          overview_main_image: string | null
          overview_main_image_alt: string
          overview_media_type: string
          overview_title: string
          publication_status: string
          published_at: string | null
          published_by: number | null
          robots_follow: boolean | null
          robots_index: boolean | null
          seo_description: string
          seo_keywords: string[]
          seo_title: string
          short_description: string
          show_on_homepage: boolean
          slug: string
          small_box_image: string
          small_box_image_alt: string
          sub_area_id: number | null
          type: string
          updated_at: string
        }
        Insert: {
          arabic_name: string
          brochure_url?: string | null
          canonical_url?: string | null
          city_id: number
          code: string
          created_at?: string
          delivery_body: string
          delivery_title: string
          english_name: string
          featured?: boolean
          focus_keyword?: string
          general_description: string
          google_maps_url: string
          governorate_id: number
          hero_image: string
          hero_image_alt: string
          homepage_order?: number
          id?: number
          image: string
          image_alt: string
          latitude: number
          location_description?: string
          location_label: string
          longitude: number
          main_area_id: number
          map_zoom: number
          og_image?: string | null
          og_image_alt?: string
          overview_body: string
          overview_main_image?: string | null
          overview_main_image_alt?: string
          overview_media_type?: string
          overview_title: string
          publication_status?: string
          published_at?: string | null
          published_by?: number | null
          robots_follow?: boolean | null
          robots_index?: boolean | null
          seo_description?: string
          seo_keywords?: string[]
          seo_title?: string
          short_description: string
          show_on_homepage?: boolean
          slug: string
          small_box_image: string
          small_box_image_alt: string
          sub_area_id?: number | null
          type: string
          updated_at?: string
        }
        Update: {
          arabic_name?: string
          brochure_url?: string | null
          canonical_url?: string | null
          city_id?: number
          code?: string
          created_at?: string
          delivery_body?: string
          delivery_title?: string
          english_name?: string
          featured?: boolean
          focus_keyword?: string
          general_description?: string
          google_maps_url?: string
          governorate_id?: number
          hero_image?: string
          hero_image_alt?: string
          homepage_order?: number
          id?: number
          image?: string
          image_alt?: string
          latitude?: number
          location_description?: string
          location_label?: string
          longitude?: number
          main_area_id?: number
          map_zoom?: number
          og_image?: string | null
          og_image_alt?: string
          overview_body?: string
          overview_main_image?: string | null
          overview_main_image_alt?: string
          overview_media_type?: string
          overview_title?: string
          publication_status?: string
          published_at?: string | null
          published_by?: number | null
          robots_follow?: boolean | null
          robots_index?: boolean | null
          seo_description?: string
          seo_keywords?: string[]
          seo_title?: string
          short_description?: string
          show_on_homepage?: boolean
          slug?: string
          small_box_image?: string
          small_box_image_alt?: string
          sub_area_id?: number | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "project_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_governorate_id_fkey"
            columns: ["governorate_id"]
            isOneToOne: false
            referencedRelation: "project_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_main_area_id_fkey"
            columns: ["main_area_id"]
            isOneToOne: false
            referencedRelation: "project_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_sub_area_id_fkey"
            columns: ["sub_area_id"]
            isOneToOne: false
            referencedRelation: "project_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      topic_categories: {
        Row: {
          color_token: string
          created_at: string | null
          deleted_at: string | null
          description: string | null
          display_excerpt: string | null
          display_title: string | null
          id: number
          image: string | null
          image_alt: string | null
          is_active: boolean | null
          is_featured: boolean
          name: string
          parent_id: number | null
          published_at: string | null
          show_in_menu: boolean
          slug: string
          sort_order: number | null
          status: string
          updated_at: string | null
        }
        Insert: {
          color_token?: string
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          display_excerpt?: string | null
          display_title?: string | null
          id?: never
          image?: string | null
          image_alt?: string | null
          is_active?: boolean | null
          is_featured?: boolean
          name: string
          parent_id?: number | null
          published_at?: string | null
          show_in_menu?: boolean
          slug: string
          sort_order?: number | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          color_token?: string
          created_at?: string | null
          deleted_at?: string | null
          description?: string | null
          display_excerpt?: string | null
          display_title?: string | null
          id?: never
          image?: string | null
          image_alt?: string | null
          is_active?: boolean | null
          is_featured?: boolean
          name?: string
          parent_id?: number | null
          published_at?: string | null
          show_in_menu?: boolean
          slug?: string
          sort_order?: number | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "topic_categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "topic_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      topic_series: {
        Row: {
          category_id: number | null
          created_at: string
          deleted_at: string | null
          description: string | null
          id: number
          name: string
          slug: string
          sort_order: number
          status: string
          updated_at: string
        }
        Insert: {
          category_id?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: number
          name: string
          slug: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Update: {
          category_id?: number | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: number
          name?: string
          slug?: string
          sort_order?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "topic_series_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "topic_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      topics: {
        Row: {
          canonical_url: string | null
          category: string
          category_id: number | null
          category_slug: string
          content: string
          content_type: string
          created_at: string
          created_by: number | null
          date_label: string | null
          deleted_at: string | null
          excerpt: string
          faq: Json
          focus_keyword: string
          id: number
          image: string
          image_alt: string | null
          is_featured: boolean
          is_popular: boolean
          media_payload: Json | null
          media_project: string | null
          og_image: string | null
          og_image_alt: string
          published_at: string | null
          published_by: number | null
          robots_follow: boolean | null
          robots_index: boolean | null
          seo_description: string
          seo_keywords: string[]
          seo_title: string
          series: string | null
          series_id: number | null
          series_slug: string | null
          show_category_on_page: boolean
          show_date_on_page: boolean
          show_excerpt_on_page: boolean
          show_faq_on_page: boolean
          show_faq_title_on_page: boolean
          show_image_on_page: boolean
          show_intro_card_on_page: boolean
          show_series_on_page: boolean
          show_title_on_page: boolean
          slug: string
          status: string
          title: string
          updated_at: string
          updated_by: number | null
          views_count: number
        }
        Insert: {
          canonical_url?: string | null
          category: string
          category_id?: number | null
          category_slug: string
          content: string
          content_type?: string
          created_at?: string
          created_by?: number | null
          date_label?: string | null
          deleted_at?: string | null
          excerpt: string
          faq?: Json
          focus_keyword?: string
          id?: number
          image: string
          image_alt?: string | null
          is_featured?: boolean
          is_popular?: boolean
          media_payload?: Json | null
          media_project?: string | null
          og_image?: string | null
          og_image_alt?: string
          published_at?: string | null
          published_by?: number | null
          robots_follow?: boolean | null
          robots_index?: boolean | null
          seo_description?: string
          seo_keywords?: string[]
          seo_title?: string
          series?: string | null
          series_id?: number | null
          series_slug?: string | null
          show_category_on_page?: boolean
          show_date_on_page?: boolean
          show_excerpt_on_page?: boolean
          show_faq_on_page?: boolean
          show_faq_title_on_page?: boolean
          show_image_on_page?: boolean
          show_intro_card_on_page?: boolean
          show_series_on_page?: boolean
          show_title_on_page?: boolean
          slug: string
          status?: string
          title: string
          updated_at?: string
          updated_by?: number | null
          views_count?: number
        }
        Update: {
          canonical_url?: string | null
          category?: string
          category_id?: number | null
          category_slug?: string
          content?: string
          content_type?: string
          created_at?: string
          created_by?: number | null
          date_label?: string | null
          deleted_at?: string | null
          excerpt?: string
          faq?: Json
          focus_keyword?: string
          id?: number
          image?: string
          image_alt?: string | null
          is_featured?: boolean
          is_popular?: boolean
          media_payload?: Json | null
          media_project?: string | null
          og_image?: string | null
          og_image_alt?: string
          published_at?: string | null
          published_by?: number | null
          robots_follow?: boolean | null
          robots_index?: boolean | null
          seo_description?: string
          seo_keywords?: string[]
          seo_title?: string
          series?: string | null
          series_id?: number | null
          series_slug?: string | null
          show_category_on_page?: boolean
          show_date_on_page?: boolean
          show_excerpt_on_page?: boolean
          show_faq_on_page?: boolean
          show_faq_title_on_page?: boolean
          show_image_on_page?: boolean
          show_intro_card_on_page?: boolean
          show_series_on_page?: boolean
          show_title_on_page?: boolean
          slug?: string
          status?: string
          title?: string
          updated_at?: string
          updated_by?: number | null
          views_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "topics_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "topic_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "topic_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      url_redirects: {
        Row: {
          created_at: string
          destination_path: string
          id: number
          note: string | null
          redirect_type: string
          source_path: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          destination_path: string
          id?: never
          note?: string | null
          redirect_type: string
          source_path: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          destination_path?: string
          id?: never
          note?: string | null
          redirect_type?: string
          source_path?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      admin_content_topics: {
        Row: {
          canonical_url: string | null
          category_color_token: string | null
          category_id: number | null
          category_name: string | null
          category_slug: string | null
          content: string | null
          content_type: string | null
          created_at: string | null
          created_by: number | null
          created_by_display: string | null
          date_label: string | null
          deleted_at: string | null
          excerpt: string | null
          faq: Json | null
          focus_keyword: string | null
          id: number | null
          image: string | null
          image_alt: string | null
          is_featured: boolean | null
          is_popular: boolean | null
          media_payload: Json | null
          og_image: string | null
          og_image_alt: string | null
          published_at: string | null
          published_by: number | null
          published_by_display: string | null
          robots_follow: boolean | null
          robots_index: boolean | null
          seo_description: string | null
          seo_keywords: string[] | null
          seo_title: string | null
          series_id: number | null
          series_name: string | null
          series_slug: string | null
          show_excerpt_on_page: boolean | null
          show_image_on_page: boolean | null
          show_title_on_page: boolean | null
          slug: string | null
          status: string | null
          title: string | null
          updated_at: string | null
          updated_by: number | null
          updated_by_display: string | null
          views_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "topics_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "topic_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_series_id_fkey"
            columns: ["series_id"]
            isOneToOne: false
            referencedRelation: "topic_series"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "topics_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_media_assets_catalog: {
        Row: {
          bucket: string | null
          byte_size: number | null
          checksum: string | null
          created_at: string | null
          default_alt_text: string | null
          default_caption: string | null
          default_title: string | null
          display_name: string | null
          extension: string | null
          folder_path: string | null
          height: number | null
          id: string | null
          media_kind: string | null
          metadata: Json | null
          mime_type: string | null
          missing_object: boolean | null
          object_key: string | null
          original_filename: string | null
          provider: string | null
          public_url: string | null
          reconciliation_state: string | null
          reference_count: number | null
          status: string | null
          updated_at: string | null
          uploaded_by: number | null
          width: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_assets_folder_fkey"
            columns: ["folder_path"]
            isOneToOne: false
            referencedRelation: "admin_media_folders_catalog"
            referencedColumns: ["normalized_path"]
          },
          {
            foreignKeyName: "media_assets_folder_fkey"
            columns: ["folder_path"]
            isOneToOne: false
            referencedRelation: "media_folders"
            referencedColumns: ["normalized_path"]
          },
          {
            foreignKeyName: "media_assets_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_media_folders_catalog: {
        Row: {
          child_folder_count: number | null
          created_at: string | null
          created_by: number | null
          direct_asset_count: number | null
          direct_total_bytes: number | null
          display_name: string | null
          id: string | null
          normalized_path: string | null
          parent_path: string | null
          reconciliation_state: string | null
          updated_at: string | null
        }
        Insert: {
          child_folder_count?: never
          created_at?: string | null
          created_by?: number | null
          direct_asset_count?: never
          direct_total_bytes?: never
          display_name?: string | null
          id?: string | null
          normalized_path?: string | null
          parent_path?: string | null
          reconciliation_state?: string | null
          updated_at?: string | null
        }
        Update: {
          child_folder_count?: never
          created_at?: string | null
          created_by?: number | null
          direct_asset_count?: never
          direct_total_bytes?: never
          display_name?: string | null
          id?: string | null
          normalized_path?: string | null
          parent_path?: string | null
          reconciliation_state?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_folders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_folders_parent_fkey"
            columns: ["parent_path"]
            isOneToOne: false
            referencedRelation: "admin_media_folders_catalog"
            referencedColumns: ["normalized_path"]
          },
          {
            foreignKeyName: "media_folders_parent_fkey"
            columns: ["parent_path"]
            isOneToOne: false
            referencedRelation: "media_folders"
            referencedColumns: ["normalized_path"]
          },
        ]
      }
      page_composition_assignments: {
        Row: {
          id: number | null
          is_visible: boolean | null
          kind: string | null
          page_id: number | null
          slot: string | null
          sort_order: number | null
          template_id: number | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      acquire_media_reference_write_lease: {
        Args: {
          p_actor_id?: number
          p_expected_environment?: string
          p_expected_environment_key?: string
          p_expected_provider?: string
          p_expected_provider_registry_version?: string
          p_request_identity?: string
          p_targets: Json
          p_ttl_seconds?: number
        }
        Returns: {
          lease_expires_at: string
          lease_started_at: string
          lease_token: string
          leased_asset_count: number
        }[]
      }
      admin_dashboard_truth_v1: { Args: never; Returns: Json }
      admin_list_categories: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_sort_direction?: string
          p_sort_field?: string
          p_status?: string
          p_view?: string
        }
        Returns: Json
      }
      admin_list_pages: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_sort_direction?: string
          p_sort_field?: string
        }
        Returns: Json
      }
      admin_list_projects: {
        Args: {
          p_featured?: string
          p_page: number
          p_page_size: number
          p_project_type: string
          p_publication_status?: string
          p_search?: string
          p_sort_direction: string
          p_sort_field: string
        }
        Returns: Json
      }
      admin_list_series: {
        Args: {
          p_category_id?: number
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_sort_direction?: string
          p_sort_field?: string
          p_status?: string
          p_view?: string
        }
        Returns: Json
      }
      admin_move_topic_categories_to_trash: {
        Args: { p_actor_id: number; p_category_ids: number[] }
        Returns: Json
      }
      admin_move_topic_series_to_trash: {
        Args: { p_actor_id: number; p_series_ids: number[] }
        Returns: Json
      }
      admin_permanently_delete_topic_categories: {
        Args: { p_actor_id: number; p_category_ids: number[] }
        Returns: Json
      }
      admin_permanently_delete_topic_series: {
        Args: { p_actor_id: number; p_series_ids: number[] }
        Returns: Json
      }
      admin_reports_truth_v1: { Args: never; Returns: Json }
      admin_restore_topic_categories: {
        Args: { p_actor_id: number; p_category_ids: number[] }
        Returns: Json
      }
      admin_restore_topic_series: {
        Args: { p_actor_id: number; p_series_ids: number[] }
        Returns: Json
      }
      admin_update_topic_category: {
        Args: {
          p_actor_id: number
          p_category_id: number
          p_color_token: string | null
          p_is_active: boolean
          p_name: string
          p_parent_id: number | null
        }
        Returns: Json
      }
      admin_update_topic_series: {
        Args: {
          p_actor_id: number
          p_category_id: number
          p_name: string
          p_series_id: number
          p_status: string
        }
        Returns: Json
      }
      assert_media_catalog_coordination_ready: {
        Args: {
          p_expected_environment: string
          p_expected_environment_key: string
          p_expected_provider: string
          p_expected_provider_registry_version: string
        }
        Returns: undefined
      }
      cancel_media_asset_deletion: {
        Args: {
          p_asset_id: string
          p_failure_code: string
          p_failure_metadata?: Json
          p_reservation_id: string
          p_storage_state?: string
          p_storage_verified_at?: string
        }
        Returns: string
      }
      claim_integration_app_configuration_test: {
        Args: {
          p_environment_key: string
          p_expected_group_version: number
          p_integration_key: string
        }
        Returns: Json
      }
      claim_integration_sync_run: {
        Args: { p_lease_seconds?: number; p_run_id?: string }
        Returns: Json
      }
      complete_integration_app_configuration_test: {
        Args: {
          p_environment_key: string
          p_integration_key: string
          p_safe_error_code?: string
          p_status: string
          p_test_version: number
        }
        Returns: boolean
      }
      complete_integration_sync_run: {
        Args: {
          p_lease_token: string
          p_message: string
          p_records_written: number
          p_run_id: string
          p_status: string
          p_watermark: Json
        }
        Returns: undefined
      }
      complete_media_reference_write_lease: {
        Args: { p_entity_identity: string; p_lease_token: string }
        Returns: number
      }
      consume_integration_authorization_attempt: {
        Args: {
          p_actor_admin_user_id: number
          p_attempt_id: string
          p_state_hash: string
        }
        Returns: Json
      }
      create_integration_vault_secret: {
        Args: { p_description?: string; p_name: string; p_secret: string }
        Returns: string
      }
      delete_integration_vault_secret: {
        Args: { p_secret_id: string }
        Returns: undefined
      }
      delete_project_admin_entry: {
        Args: { p_project_id: number }
        Returns: {
          project_slug: string
          project_type: string
        }[]
      }
      duplicate_project_admin_entry: {
        Args: { p_project_id: number }
        Returns: {
          created_at: string
          featured: boolean
          project_id: number
          project_slug: string
          project_type: string
          updated_at: string
        }[]
      }
      duplicate_project_admin_entry_core: {
        Args: { p_project_id: number }
        Returns: {
          created_at: string
          featured: boolean
          project_id: number
          project_slug: string
          project_type: string
          updated_at: string
        }[]
      }
      external_integrations_capability_health: { Args: never; Returns: Json }
      fail_integration_sync_run: {
        Args: {
          p_error_code: string
          p_error_message: string
          p_lease_token: string
          p_requires_reauth?: boolean
          p_run_id: string
        }
        Returns: undefined
      }
      fail_media_reference_write_lease: {
        Args: {
          p_domain_write_committed?: boolean
          p_entity_identity: string
          p_failure_code: string
          p_failure_metadata?: Json
          p_lease_token: string
        }
        Returns: number
      }
      finalize_media_asset_deletion: {
        Args: {
          p_asset_id: string
          p_reservation_id: string
          p_storage_state: string
          p_storage_verified_at: string
        }
        Returns: string
      }
      finalize_media_asset_identity_move: {
        Args: {
          p_asset_id: string
          p_expected_bucket: string
          p_expected_object_key: string
          p_expected_provider: string
          p_expected_public_url: string
          p_lease_token: string
        }
        Returns: number
      }
      get_media_reference_provider_revision: {
        Args: { p_domain_key: string }
        Returns: number
      }
      global_seo_infrastructure_health: { Args: never; Returns: Json }
      global_truth_atomic_closure_health: { Args: never; Returns: Json }
      increment_topic_view: { Args: { p_topic_id: number }; Returns: number }
      ingest_analytics_provider_read_model: {
        Args: {
          p_compare_key: string
          p_connection_id: string
          p_message: string
          p_metrics: Json
          p_period_key: string
          p_provider_key: string
          p_source_updated_at: string
          p_status: string
          p_watermark: Json
        }
        Returns: string
      }
      integration_app_configuration_provider: {
        Args: { p_integration_key: string }
        Returns: string
      }
      integration_app_configuration_required_keys: {
        Args: { p_integration_key: string }
        Returns: string[]
      }
      is_valid_global_seo_settings: {
        Args: { payload: Json }
        Returns: boolean
      }
      mark_media_asset_delete_recovery: {
        Args: {
          p_asset_id: string
          p_failure_code: string
          p_failure_metadata?: Json
          p_reservation_id: string
          p_storage_state?: string
          p_storage_verified_at?: string
        }
        Returns: string
      }
      mutate_menu_tree: {
        Args: {
          p_actor_admin_user_id?: number
          p_actor_username?: string
          p_menu_id: number
          p_operation: string
          p_payload?: Json
        }
        Returns: Json
      }
      mutate_page_composition: {
        Args: {
          p_actor_admin_user_id?: number
          p_actor_username?: string
          p_operation: string
          p_page_id: number
          p_payload?: Json
        }
        Returns: Json
      }
      mutate_project_location: {
        Args: { p_action: string; p_location_id?: number; p_payload?: Json }
        Returns: {
          client_key: string
          created_at: string
          id: number
          is_active: boolean
          level: string
          name_ar: string
          name_en: string | null
          parent_id: number | null
          sort_order: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "project_locations"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      project_publishing_readiness: {
        Args: { p_project_id: number }
        Returns: {
          blocker_code: string
          ready: boolean
        }[]
      }
      promote_integration_authorization: {
        Args: {
          p_access_expires_at: string | null
          p_access_secret_id: string
          p_actor_admin_user_id: number
          p_credential_strategy: string
          p_environment_key: string
          p_external_subject_id: string | null
          p_granted_scopes: string[]
          p_integration_key: string
          p_refresh_expires_at: string | null
          p_refresh_secret_id: string | null
        }
        Returns: string
      }
      prune_integration_authorization_attempts: { Args: never; Returns: number }
      queue_due_integration_sync_runs: {
        Args: { p_limit?: number }
        Returns: number
      }
      queue_integration_initial_sync: {
        Args: {
          p_actor_admin_user_id: number
          p_connection_id: string
          p_trigger_kind: string
        }
        Returns: string
      }
      read_integration_vault_secret: {
        Args: { p_secret_id: string }
        Returns: string
      }
      remove_integration_app_configuration: {
        Args: {
          p_actor_admin_user_id: number
          p_environment_key: string
          p_expected_version: number
          p_provider_key: string
        }
        Returns: boolean
      }
      repair_media_delete_reservation: {
        Args: {
          p_action: string
          p_asset_id: string
          p_repair_metadata?: Json
          p_reservation_id: string
          p_storage_state: string
          p_storage_verified_at: string
        }
        Returns: string
      }
      replace_integration_app_configuration: {
        Args: {
          p_actor_admin_user_id: number
          p_affected_integrations: string[]
          p_configuration_source?: string
          p_entries: Json
          p_environment_key: string
          p_expected_version: number
          p_provider_key: string
        }
        Returns: Json
      }
      replace_integration_discovered_assets: {
        Args: {
          p_actor_admin_user_id: number
          p_assets: Json
          p_connection_id: string
        }
        Returns: number
      }
      replace_media_references_for_entity: {
        Args: {
          p_domain_key: string
          p_entity_identity: string
          p_entity_type: string
          p_lease_entity_identity: string | null
          p_lease_token: string | null
          p_references: Json
        }
        Returns: number
      }
      replace_media_references_for_provider: {
        Args: {
          p_domain_key: string
          p_expected_provider_revision: number
          p_reconciliation_run_identity: string
          p_references: Json
        }
        Returns: number
      }
      reserve_media_asset_deletion: {
        Args: {
          p_actor_id?: number
          p_asset_id: string
          p_expected_asset_bucket?: string
          p_expected_asset_object_key?: string
          p_expected_asset_provider?: string
          p_expected_environment?: string
          p_expected_environment_key?: string
          p_expected_provider?: string
          p_expected_provider_registry_version?: string
          p_request_identity?: string
        }
        Returns: {
          asset_status: string
          reservation_id: string
          reservation_status: string
          reserved_asset_id: string
          reserved_bucket: string
          reserved_object_key: string
          reserved_provider: string
          reserved_public_url: string
          started_at: string
        }[]
      }
      resolve_media_reference_write_lease: {
        Args: {
          p_entity_identity?: string
          p_lease_token: string
          p_reconciliation_run_identity: string
          p_resolution_code: string
        }
        Returns: number
      }
      revoke_integration_connection: {
        Args: { p_actor_admin_user_id: number; p_connection_id: string }
        Returns: undefined
      }
      rollback_media_asset_identity_move: {
        Args: {
          p_asset_id: string
          p_expected_bucket: string
          p_expected_object_key: string
          p_expected_provider: string
          p_expected_public_url: string
          p_lease_token: string
          p_restore_bucket: string
          p_restore_folder_path: string
          p_restore_missing_object: boolean
          p_restore_object_key: string
          p_restore_public_url: string
          p_restore_reconciliation_state: string
        }
        Returns: number
      }
      rotate_integration_credentials: {
        Args: {
          p_access_expires_at: string | null
          p_access_secret_id: string
          p_connection_id: string
          p_granted_scopes: string[]
          p_refresh_expires_at: string | null
          p_refresh_secret_id: string | null
        }
        Returns: undefined
      }
      save_footer_settings: {
        Args: {
          p_action: string
          p_actor_admin_user_id: number
          p_actor_username: string
          p_metadata?: Json
          p_settings: Json
        }
        Returns: Json
      }
      save_project_admin_entry: {
        Args: { p_payload?: Json; p_project_id?: number }
        Returns: {
          project_id: number
          slug: string
          updated_at: string
        }[]
      }
      save_project_admin_entry_core: {
        Args: { p_payload?: Json; p_project_id?: number }
        Returns: {
          project_id: number
          slug: string
          updated_at: string
        }[]
      }
      select_integration_assets: {
        Args: {
          p_actor_admin_user_id: number
          p_asset_ids: string[]
          p_connection_id: string
        }
        Returns: number
      }
      set_project_featured_admin_entry: {
        Args: { p_featured: boolean; p_project_id: number }
        Returns: {
          featured: boolean
          project_id: number
          project_slug: string
          project_type: string
          updated_at: string
        }[]
      }
      set_project_publication_admin_entry: {
        Args: { p_actor_id: number; p_project_id: number; p_visible: boolean }
        Returns: {
          featured: boolean
          project_id: number
          project_slug: string
          project_type: string
          publication_status: string
          published_at: string
          published_by: number
          updated_at: string
        }[]
      }
      transition_media_asset_identity_for_move: {
        Args: {
          p_asset_id: string
          p_expected_bucket: string
          p_expected_object_key: string
          p_expected_provider: string
          p_expected_public_url: string
          p_lease_token: string
          p_next_bucket: string
          p_next_folder_path: string
          p_next_object_key: string
          p_next_public_url: string
        }
        Returns: number
      }
      transition_project_publication_admin_entry: {
        Args: {
          p_actor_id: number
          p_project_id: number
          p_target_status: string
        }
        Returns: {
          project_id: number
          publication_status: string
          published_at: string
          published_by: number
          updated_at: string
        }[]
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
    Enums: {},
  },
} as const
