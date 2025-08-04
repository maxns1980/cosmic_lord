export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      player_states: {
        Row: {
          user_id: string
          state: any
        }
        Insert: {
          user_id: string
          state: any
        }
        Update: {
          user_id?: string
          state?: any
        }
        Relationships: [
          {
            foreignKeyName: "player_states_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["username"]
          }
        ]
      }
      users: {
        Row: {
          username: string
          password: string
        }
        Insert: {
          username: string
          password: string
        }
        Update: {
          username?: string
          password?: string
        }
        Relationships: []
      }
      world_state: {
        Row: {
          id: number
          state: any
        }
        Insert: {
          id?: number
          state: any
        }
        Update: {
          id?: number
          state?: any
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