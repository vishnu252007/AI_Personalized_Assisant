export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          avatar_url: string | null;
          subject: string | null;
          level: string;
          onboarded: boolean;
          preferred_style: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          subject?: string | null;
          level?: string;
          onboarded?: boolean;
          preferred_style?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          full_name?: string | null;
          avatar_url?: string | null;
          subject?: string | null;
          level?: string;
          onboarded?: boolean;
          preferred_style?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      topics: {
        Row: {
          id: string;
          slug: string;
          name: string;
          description: string | null;
          subject: string;
          domain: string;
          difficulty_level: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          name: string;
          description?: string | null;
          subject?: string;
          domain?: string;
          difficulty_level?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          name?: string;
          description?: string | null;
          subject?: string;
          domain?: string;
          difficulty_level?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      learner_topic_state: {
        Row: {
          id: string;
          user_id: string;
          topic_id: string;
          mastery_score: number;
          half_life_days: number;
          attempts_count: number;
          last_reviewed_at: string;
          misconceptions: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          topic_id: string;
          mastery_score?: number;
          half_life_days?: number;
          attempts_count?: number;
          last_reviewed_at?: string;
          misconceptions?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          topic_id?: string;
          mastery_score?: number;
          half_life_days?: number;
          attempts_count?: number;
          last_reviewed_at?: string;
          misconceptions?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "learner_topic_state_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          }
        ];
      };
      style_stats: {
        Row: {
          user_id: string;
          style: string;
          alpha: number;
          beta: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          style: string;
          alpha?: number;
          beta?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          style?: string;
          alpha?: number;
          beta?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          topic_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title?: string;
          topic_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          topic_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          }
        ];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: "user" | "assistant" | "system";
          style: string | null;
          content: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: "user" | "assistant" | "system";
          style?: string | null;
          content: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          role?: "user" | "assistant" | "system";
          style?: string | null;
          content?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          }
        ];
      };
      quizzes: {
        Row: {
          id: string;
          user_id: string;
          topic_id: string | null;
          difficulty_level: number;
          status: "in_progress" | "completed" | "abandoned";
          score: number;
          total_questions: number;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          topic_id?: string | null;
          difficulty_level?: number;
          status?: "in_progress" | "completed" | "abandoned";
          score?: number;
          total_questions?: number;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          topic_id?: string | null;
          difficulty_level?: number;
          status?: "in_progress" | "completed" | "abandoned";
          score?: number;
          total_questions?: number;
          created_at?: string;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "quizzes_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          }
        ];
      };
      questions: {
        Row: {
          id: string;
          quiz_id: string;
          topic_id: string | null;
          difficulty: number;
          question_text: string;
          options: Json;
          order_index: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          quiz_id: string;
          topic_id?: string | null;
          difficulty?: number;
          question_text: string;
          options: Json;
          order_index?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          quiz_id?: string;
          topic_id?: string | null;
          difficulty?: number;
          question_text?: string;
          options?: Json;
          order_index?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "questions_quiz_id_fkey";
            columns: ["quiz_id"];
            isOneToOne: false;
            referencedRelation: "quizzes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "questions_topic_id_fkey";
            columns: ["topic_id"];
            isOneToOne: false;
            referencedRelation: "topics";
            referencedColumns: ["id"];
          }
        ];
      };
      question_keys: {
        Row: {
          question_id: string;
          correct_index: number;
          rationales: Json;
          misconception_tags: Json;
          created_at: string;
        };
        Insert: {
          question_id: string;
          correct_index: number;
          rationales: Json;
          misconception_tags?: Json;
          created_at?: string;
        };
        Update: {
          question_id?: string;
          correct_index?: number;
          rationales?: Json;
          misconception_tags?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "question_keys_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: true;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          }
        ];
      };
      attempts: {
        Row: {
          id: string;
          quiz_id: string;
          question_id: string;
          user_id: string;
          selected_index: number;
          is_correct: boolean;
          response_time_ms: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          quiz_id: string;
          question_id: string;
          user_id: string;
          selected_index: number;
          is_correct: boolean;
          response_time_ms?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          quiz_id?: string;
          question_id?: string;
          user_id?: string;
          selected_index?: number;
          is_correct?: boolean;
          response_time_ms?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attempts_quiz_id_fkey";
            columns: ["quiz_id"];
            isOneToOne: false;
            referencedRelation: "quizzes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attempts_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "questions";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}
