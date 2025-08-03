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
      game_state: {
        Row: {
          user_id: string
          state: Json
        }
        Insert: {
          user_id: string
          state: Json
        }
        Update: {
          user_id?: string
          state?: Json
        }
        Relationships: []
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
