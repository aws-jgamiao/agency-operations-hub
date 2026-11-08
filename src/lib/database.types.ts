
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "ops": {
          Tables: {
            "audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"changes": NonNullable<Json>,"entity_id": string,"entity_type": string,"id": number,"occurred_at": string,"workspace_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"changes"?: NonNullable<Json>,"entity_id": string,"entity_type": string,"id"?: never,"occurred_at"?: string,"workspace_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"changes"?: NonNullable<Json>,"entity_id"?: string,"entity_type"?: string,"id"?: never,"occurred_at"?: string,"workspace_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"client_requests": {
                  Row: {
                    "assignee_id": string | null,"body": string,"channel": string,"client_id": string,"created_at": string,"created_by": string | null,"id": string,"priority": Database["ops"]['Enums']["priority"],"resolution": string | null,"resolved_at": string | null,"status": Database["ops"]['Enums']["request_status"],"title": string,"updated_at": string,"version": number,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_id"?: string | null,"body"?: string,"channel"?: string,"client_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"priority"?: Database["ops"]['Enums']["priority"],"resolution"?: string | null,"resolved_at"?: string | null,"status"?: Database["ops"]['Enums']["request_status"],"title": string,"updated_at"?: string,"version"?: number,"workspace_id": string
                  }
                  Update: {
                    "assignee_id"?: string | null,"body"?: string,"channel"?: string,"client_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"priority"?: Database["ops"]['Enums']["priority"],"resolution"?: string | null,"resolved_at"?: string | null,"status"?: Database["ops"]['Enums']["request_status"],"title"?: string,"updated_at"?: string,"version"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "client_requests_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_requests_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_requests_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "client_requests_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"clients": {
                  Row: {
                    "contact_email": string | null,"created_at": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "contact_email"?: string | null,"created_at"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "contact_email"?: string | null,"created_at"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    
                  ]
                },"kb_articles": {
                  Row: {
                    "author_id": string | null,"body": string,"category_id": string,"created_at": string,"id": string,"published": boolean,"slug": string,"title": string,"updated_at": string,"visibility": Database["ops"]['Enums']["kb_visibility"],"workspace_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"body"?: string,"category_id": string,"created_at"?: string,"id"?: string,"published"?: boolean,"slug": string,"title": string,"updated_at"?: string,"visibility"?: Database["ops"]['Enums']["kb_visibility"],"workspace_id"?: string | null
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"category_id"?: string,"created_at"?: string,"id"?: string,"published"?: boolean,"slug"?: string,"title"?: string,"updated_at"?: string,"visibility"?: Database["ops"]['Enums']["kb_visibility"],"workspace_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "kb_articles_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "kb_articles_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "kb_categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "kb_articles_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"kb_categories": {
                  Row: {
                    "id": string,"name": string,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"name": string,"slug": string
                  }
                  Update: {
                    "id"?: string,"name"?: string,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"members": {
                  Row: {
                    "active": boolean,"created_at": string,"email": string,"full_name": string,"id": string,"is_demo": boolean,"role": Database["ops"]['Enums']["member_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"email": string,"full_name": string,"id": string,"is_demo"?: boolean,"role"?: Database["ops"]['Enums']["member_role"]
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"email"?: string,"full_name"?: string,"id"?: string,"is_demo"?: boolean,"role"?: Database["ops"]['Enums']["member_role"]
                  }
                  Relationships: [
                    
                  ]
                },"notification_outbox": {
                  Row: {
                    "attempts": number,"created_at": string,"delivery_mode": string | null,"event_type": string,"id": number,"last_error": string | null,"last_http_status": number | null,"lease_expires_at": string | null,"lease_token": string | null,"next_attempt_at": string,"payload": NonNullable<Json>,"sent_at": string | null,"status": Database["ops"]['Enums']["outbox_status"],"workspace_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"created_at"?: string,"delivery_mode"?: string | null,"event_type": string,"id"?: never,"last_error"?: string | null,"last_http_status"?: number | null,"lease_expires_at"?: string | null,"lease_token"?: string | null,"next_attempt_at"?: string,"payload": NonNullable<Json>,"sent_at"?: string | null,"status"?: Database["ops"]['Enums']["outbox_status"],"workspace_id"?: string | null
                  }
                  Update: {
                    "attempts"?: number,"created_at"?: string,"delivery_mode"?: string | null,"event_type"?: string,"id"?: never,"last_error"?: string | null,"last_http_status"?: number | null,"lease_expires_at"?: string | null,"lease_token"?: string | null,"next_attempt_at"?: string,"payload"?: NonNullable<Json>,"sent_at"?: string | null,"status"?: Database["ops"]['Enums']["outbox_status"],"workspace_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"request_notes": {
                  Row: {
                    "author_id": string | null,"body": string,"created_at": string,"id": string,"request_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"body": string,"created_at"?: string,"id"?: string,"request_id": string,"workspace_id": string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"created_at"?: string,"id"?: string,"request_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "request_notes_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "request_notes_request_fk"
      columns: ["request_id","workspace_id"]
isOneToOne: false
      referencedRelation: "client_requests"
      referencedColumns: ["id","workspace_id"]
    }
                  ]
                },"task_comments": {
                  Row: {
                    "author_id": string | null,"body": string,"created_at": string,"id": string,"task_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "author_id"?: string | null,"body": string,"created_at"?: string,"id"?: string,"task_id": string,"workspace_id": string
                  }
                  Update: {
                    "author_id"?: string | null,"body"?: string,"created_at"?: string,"id"?: string,"task_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "task_comments_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "task_comments_task_fk"
      columns: ["task_id","workspace_id"]
isOneToOne: false
      referencedRelation: "tasks"
      referencedColumns: ["id","workspace_id"]
    }
                  ]
                },"tasks": {
                  Row: {
                    "assignee_id": string | null,"completed_at": string | null,"created_at": string,"created_by": string | null,"description": string,"due_date": string | null,"id": string,"priority": Database["ops"]['Enums']["priority"],"status": Database["ops"]['Enums']["task_status"],"title": string,"updated_at": string,"version": number,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignee_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string,"due_date"?: string | null,"id"?: string,"priority"?: Database["ops"]['Enums']["priority"],"status"?: Database["ops"]['Enums']["task_status"],"title": string,"updated_at"?: string,"version"?: number,"workspace_id": string
                  }
                  Update: {
                    "assignee_id"?: string | null,"completed_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"description"?: string,"due_date"?: string | null,"id"?: string,"priority"?: Database["ops"]['Enums']["priority"],"status"?: Database["ops"]['Enums']["task_status"],"title"?: string,"updated_at"?: string,"version"?: number,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tasks_assignee_id_fkey"
      columns: ["assignee_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tasks_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspace_members": {
                  Row: {
                    "added_at": string,"member_id": string,"workspace_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "added_at"?: string,"member_id": string,"workspace_id": string
                  }
                  Update: {
                    "added_at"?: string,"member_id"?: string,"workspace_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspace_members_member_id_fkey"
      columns: ["member_id"]
isOneToOne: false
      referencedRelation: "members"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "workspace_members_workspace_id_fkey"
      columns: ["workspace_id"]
isOneToOne: false
      referencedRelation: "workspaces"
      referencedColumns: ["id"]
    }
                  ]
                },"workspaces": {
                  Row: {
                    "archived_at": string | null,"client_id": string | null,"created_at": string,"id": string,"name": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"client_id"?: string | null,"created_at"?: string,"id"?: string,"name": string
                  }
                  Update: {
                    "archived_at"?: string | null,"client_id"?: string | null,"created_at"?: string,"id"?: string,"name"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "workspaces_client_id_fkey"
      columns: ["client_id"]
isOneToOne: false
      referencedRelation: "clients"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "claim_notifications":
{ Args: { "p_limit"?: number }; Returns: {
              "attempts": number,"event_type": string,"id": number,"lease_token": string,"payload": Json
            }[]
                           },
"complete_notification":
{ Args: { "p_error"?: string,"p_http_status"?: number,"p_id": number,"p_lease": string,"p_mode"?: string,"p_outcome": string,"p_retry_after_seconds"?: number }; Returns: undefined
                           },
"enqueue_test_notification":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"reset_demo":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"retry_notification":
{ Args: { "p_id": number }; Returns: undefined
                           },
"task_summary":
{ Args: { "p_today": string }; Returns: Json
                           }
          }
          Enums: {
            "kb_visibility": "all_staff"|"admins"|"workspace","member_role": "admin"|"staff","outbox_status": "pending"|"sending"|"sent"|"rate_limited"|"failed","priority": "low"|"medium"|"high"|"urgent","request_status": "new"|"triaged"|"in_progress"|"waiting_on_client"|"resolved"|"closed","task_status": "todo"|"in_progress"|"blocked"|"done"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "ops">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "ops": {
          Enums: {
            "kb_visibility": ["all_staff", "admins", "workspace"],"member_role": ["admin", "staff"],"outbox_status": ["pending", "sending", "sent", "rate_limited", "failed"],"priority": ["low", "medium", "high", "urgent"],"request_status": ["new", "triaged", "in_progress", "waiting_on_client", "resolved", "closed"],"task_status": ["todo", "in_progress", "blocked", "done"]
          }
        }
} as const
