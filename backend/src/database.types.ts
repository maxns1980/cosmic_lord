export type Json = any;

export interface Database {
  public: {
    Tables: {
      player_states: {
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
          state: Json
        }
        Insert: {
          id?: number
          state: Json
        }
        Update: {
          id?: number
          state?: Json
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
