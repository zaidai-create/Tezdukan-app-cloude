export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      addresses: {
        Row: {
          area_id: string | null;
          city: string;
          created_at: string;
          created_by: string | null;
          id: string;
          is_default: boolean;
          label: string;
          landmark: string | null;
          lat: number | null;
          line1: string;
          line2: string | null;
          lng: number | null;
          location: unknown;
          phone: string | null;
          recipient_name: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          area_id?: string | null;
          city?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_default?: boolean;
          label?: string;
          landmark?: string | null;
          lat?: number | null;
          line1: string;
          line2?: string | null;
          lng?: number | null;
          location?: never;
          phone?: string | null;
          recipient_name?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          area_id?: string | null;
          city?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_default?: boolean;
          label?: string;
          landmark?: string | null;
          lat?: number | null;
          line1?: string;
          line2?: string | null;
          lng?: number | null;
          location?: never;
          phone?: string | null;
          recipient_name?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "addresses_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "service_areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "addresses_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "addresses_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_actions: {
        Row: {
          args: NonNullable<Json>;
          confirmed_at: string | null;
          conversation_id: string | null;
          cost_micro_usd: number | null;
          created_at: string;
          created_by: string | null;
          error: string | null;
          executed_at: string | null;
          id: string;
          latency_ms: number | null;
          message_id: string | null;
          model: string | null;
          org_id: string | null;
          result: Json | null;
          role: Database["public"]["Enums"]["app_role"];
          shop_id: string | null;
          status: Database["public"]["Enums"]["ai_action_status"];
          tool: string;
          transcript: string | null;
          undone_at: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          args?: NonNullable<Json>;
          confirmed_at?: string | null;
          conversation_id?: string | null;
          cost_micro_usd?: number | null;
          created_at?: string;
          created_by?: string | null;
          error?: string | null;
          executed_at?: string | null;
          id?: string;
          latency_ms?: number | null;
          message_id?: string | null;
          model?: string | null;
          org_id?: string | null;
          result?: Json | null;
          role: Database["public"]["Enums"]["app_role"];
          shop_id?: string | null;
          status?: Database["public"]["Enums"]["ai_action_status"];
          tool: string;
          transcript?: string | null;
          undone_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          args?: NonNullable<Json>;
          confirmed_at?: string | null;
          conversation_id?: string | null;
          cost_micro_usd?: number | null;
          created_at?: string;
          created_by?: string | null;
          error?: string | null;
          executed_at?: string | null;
          id?: string;
          latency_ms?: number | null;
          message_id?: string | null;
          model?: string | null;
          org_id?: string | null;
          result?: Json | null;
          role?: Database["public"]["Enums"]["app_role"];
          shop_id?: string | null;
          status?: Database["public"]["Enums"]["ai_action_status"];
          tool?: string;
          transcript?: string | null;
          undone_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_actions_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "ai_conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_actions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_actions_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "ai_messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_actions_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_actions_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_actions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_conversations: {
        Row: {
          channel: string;
          created_at: string;
          created_by: string | null;
          id: string;
          last_message_at: string | null;
          locale: Database["public"]["Enums"]["app_locale"];
          org_id: string | null;
          role: Database["public"]["Enums"]["app_role"];
          shop_id: string | null;
          title: string | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          channel?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          last_message_at?: string | null;
          locale?: Database["public"]["Enums"]["app_locale"];
          org_id?: string | null;
          role: Database["public"]["Enums"]["app_role"];
          shop_id?: string | null;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          channel?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          last_message_at?: string | null;
          locale?: Database["public"]["Enums"]["app_locale"];
          org_id?: string | null;
          role?: Database["public"]["Enums"]["app_role"];
          shop_id?: string | null;
          title?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_conversations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_conversations_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_conversations_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_conversations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_messages: {
        Row: {
          content: string | null;
          content_json: Json | null;
          conversation_id: string;
          cost_micro_usd: number | null;
          created_at: string;
          created_by: string | null;
          id: string;
          latency_ms: number | null;
          model: string | null;
          role: Database["public"]["Enums"]["ai_message_role"];
          tokens_in: number | null;
          tokens_out: number | null;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          content?: string | null;
          content_json?: Json | null;
          conversation_id: string;
          cost_micro_usd?: number | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          latency_ms?: number | null;
          model?: string | null;
          role: Database["public"]["Enums"]["ai_message_role"];
          tokens_in?: number | null;
          tokens_out?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          content?: string | null;
          content_json?: Json | null;
          conversation_id?: string;
          cost_micro_usd?: number | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          latency_ms?: number | null;
          model?: string | null;
          role?: Database["public"]["Enums"]["ai_message_role"];
          tokens_in?: number | null;
          tokens_out?: number | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "ai_conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_messages_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_messages_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      api_keys: {
        Row: {
          created_at: string;
          created_by: string | null;
          expires_at: string | null;
          id: string;
          key_hash: string;
          last_used_at: string | null;
          name: string;
          org_id: string;
          prefix: string;
          revoked_at: string | null;
          scopes: string[];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          key_hash: string;
          last_used_at?: string | null;
          name: string;
          org_id: string;
          prefix: string;
          revoked_at?: string | null;
          scopes?: string[];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          expires_at?: string | null;
          id?: string;
          key_hash?: string;
          last_used_at?: string | null;
          name?: string;
          org_id?: string;
          prefix?: string;
          revoked_at?: string | null;
          scopes?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "api_keys_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "api_keys_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          after: Json | null;
          before: Json | null;
          created_at: string;
          created_by: string | null;
          entity_id: string | null;
          entity_type: string;
          id: string;
          metadata: NonNullable<Json>;
          org_id: string | null;
          shop_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          actor_id?: string | null;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          created_by?: string | null;
          entity_id?: string | null;
          entity_type: string;
          id?: string;
          metadata?: NonNullable<Json>;
          org_id?: string | null;
          shop_id?: string | null;
          updated_at?: string;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          created_by?: string | null;
          entity_id?: string | null;
          entity_type?: string;
          id?: string;
          metadata?: NonNullable<Json>;
          org_id?: string | null;
          shop_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      banners: {
        Row: {
          area_ids: string[] | null;
          created_at: string;
          created_by: string | null;
          ends_at: string | null;
          id: string;
          image_path: string;
          is_active: boolean;
          link: string | null;
          org_id: string | null;
          owner_type: Database["public"]["Enums"]["content_owner_type"];
          placement: Database["public"]["Enums"]["banner_placement"];
          segments: Database["public"]["Enums"]["shop_tier"][] | null;
          sort_order: number;
          starts_at: string;
          subtitle: string | null;
          title: string;
          title_ur: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          area_ids?: string[] | null;
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          id?: string;
          image_path: string;
          is_active?: boolean;
          link?: string | null;
          org_id?: string | null;
          owner_type?: Database["public"]["Enums"]["content_owner_type"];
          placement: Database["public"]["Enums"]["banner_placement"];
          segments?: Database["public"]["Enums"]["shop_tier"][] | null;
          sort_order?: number;
          starts_at?: string;
          subtitle?: string | null;
          title: string;
          title_ur?: string | null;
          updated_at?: string;
        };
        Update: {
          area_ids?: string[] | null;
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          id?: string;
          image_path?: string;
          is_active?: boolean;
          link?: string | null;
          org_id?: string | null;
          owner_type?: Database["public"]["Enums"]["content_owner_type"];
          placement?: Database["public"]["Enums"]["banner_placement"];
          segments?: Database["public"]["Enums"]["shop_tier"][] | null;
          sort_order?: number;
          starts_at?: string;
          subtitle?: string | null;
          title?: string;
          title_ur?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "banners_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "banners_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      beat_shops: {
        Row: {
          beat_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          notes: string | null;
          org_id: string;
          sequence: number;
          shop_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          beat_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          org_id: string;
          sequence?: number;
          shop_id: string;
          updated_at?: string;
        };
        Update: {
          beat_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          org_id?: string;
          sequence?: number;
          shop_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "beat_shops_beat_id_fkey";
            columns: ["beat_id"];
            isOneToOne: false;
            referencedRelation: "beats";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "beat_shops_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "beat_shops_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "beat_shops_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      beats: {
        Row: {
          area_id: string | null;
          booker_id: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          name: string;
          notes: string | null;
          org_id: string;
          updated_at: string;
          weekday: number;
        };
        ComputedFields: never;
        Insert: {
          area_id?: string | null;
          booker_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          notes?: string | null;
          org_id: string;
          updated_at?: string;
          weekday: number;
        };
        Update: {
          area_id?: string | null;
          booker_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          notes?: string | null;
          org_id?: string;
          updated_at?: string;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: "beats_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "service_areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "beats_booker_id_fkey";
            columns: ["booker_id"];
            isOneToOne: false;
            referencedRelation: "org_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "beats_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "beats_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      brands: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          logo_path: string | null;
          manufacturer: string | null;
          name: string;
          name_ur: string | null;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          logo_path?: string | null;
          manufacturer?: string | null;
          name: string;
          name_ur?: string | null;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          logo_path?: string | null;
          manufacturer?: string | null;
          name?: string;
          name_ur?: string | null;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "brands_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      campaigns: {
        Row: {
          audience: NonNullable<Json>;
          channel: Database["public"]["Enums"]["campaign_channel"];
          created_at: string;
          created_by: string | null;
          id: string;
          message: string;
          message_ur: string | null;
          name: string;
          org_id: string | null;
          owner_type: Database["public"]["Enums"]["content_owner_type"];
          scheduled_at: string | null;
          sent_at: string | null;
          stats: NonNullable<Json>;
          status: Database["public"]["Enums"]["campaign_status"];
          title: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          audience?: NonNullable<Json>;
          channel: Database["public"]["Enums"]["campaign_channel"];
          created_at?: string;
          created_by?: string | null;
          id?: string;
          message: string;
          message_ur?: string | null;
          name: string;
          org_id?: string | null;
          owner_type?: Database["public"]["Enums"]["content_owner_type"];
          scheduled_at?: string | null;
          sent_at?: string | null;
          stats?: NonNullable<Json>;
          status?: Database["public"]["Enums"]["campaign_status"];
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          audience?: NonNullable<Json>;
          channel?: Database["public"]["Enums"]["campaign_channel"];
          created_at?: string;
          created_by?: string | null;
          id?: string;
          message?: string;
          message_ur?: string | null;
          name?: string;
          org_id?: string | null;
          owner_type?: Database["public"]["Enums"]["content_owner_type"];
          scheduled_at?: string | null;
          sent_at?: string | null;
          stats?: NonNullable<Json>;
          status?: Database["public"]["Enums"]["campaign_status"];
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaigns_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      cart_items: {
        Row: {
          added_via: Database["public"]["Enums"]["cart_item_source"];
          cart_id: string;
          created_at: string;
          created_by: string | null;
          distributor_product_id: string;
          id: string;
          org_id: string;
          pack_unit_id: string;
          quantity: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          added_via?: Database["public"]["Enums"]["cart_item_source"];
          cart_id: string;
          created_at?: string;
          created_by?: string | null;
          distributor_product_id: string;
          id?: string;
          org_id: string;
          pack_unit_id: string;
          quantity: number;
          updated_at?: string;
        };
        Update: {
          added_via?: Database["public"]["Enums"]["cart_item_source"];
          cart_id?: string;
          created_at?: string;
          created_by?: string | null;
          distributor_product_id?: string;
          id?: string;
          org_id?: string;
          pack_unit_id?: string;
          quantity?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cart_items_cart_id_fkey";
            columns: ["cart_id"];
            isOneToOne: false;
            referencedRelation: "carts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_items_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_items_distributor_product_id_fkey";
            columns: ["distributor_product_id"];
            isOneToOne: false;
            referencedRelation: "distributor_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_items_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cart_items_pack_unit_id_fkey";
            columns: ["pack_unit_id"];
            isOneToOne: false;
            referencedRelation: "pack_units";
            referencedColumns: ["id"];
          },
        ];
      };
      carts: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          notes: string | null;
          shop_id: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          shop_id: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          shop_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "carts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carts_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "carts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      cash_book: {
        Row: {
          amount_paisa: number;
          client_id: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          entry_date: string;
          entry_type: Database["public"]["Enums"]["cash_book_entry_type"];
          id: string;
          note: string | null;
          recorded_by: string | null;
          reference_id: string | null;
          reference_type: string | null;
          shop_id: string;
          updated_at: string;
          void_reason: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount_paisa: number;
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          entry_date?: string;
          entry_type: Database["public"]["Enums"]["cash_book_entry_type"];
          id?: string;
          note?: string | null;
          recorded_by?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          shop_id: string;
          updated_at?: string;
          void_reason?: string | null;
        };
        Update: {
          amount_paisa?: number;
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          entry_date?: string;
          entry_type?: Database["public"]["Enums"]["cash_book_entry_type"];
          id?: string;
          note?: string | null;
          recorded_by?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          shop_id?: string;
          updated_at?: string;
          void_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "cash_book_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cash_book_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cash_book_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      cash_settlements: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          client_id: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          expected_paisa: number;
          id: string;
          journal_id: string | null;
          member_id: string;
          notes: string | null;
          org_id: string;
          received_paisa: number;
          settlement_date: string;
          status: Database["public"]["Enums"]["cash_settlement_status"];
          trip_id: string | null;
          updated_at: string;
          variance_paisa: number | null;
        };
        ComputedFields: never;
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          expected_paisa: number;
          id?: string;
          journal_id?: string | null;
          member_id: string;
          notes?: string | null;
          org_id: string;
          received_paisa: number;
          settlement_date?: string;
          status?: Database["public"]["Enums"]["cash_settlement_status"];
          trip_id?: string | null;
          updated_at?: string;
          variance_paisa?: never;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          expected_paisa?: number;
          id?: string;
          journal_id?: string | null;
          member_id?: string;
          notes?: string | null;
          org_id?: string;
          received_paisa?: number;
          settlement_date?: string;
          status?: Database["public"]["Enums"]["cash_settlement_status"];
          trip_id?: string | null;
          updated_at?: string;
          variance_paisa?: never;
        };
        Relationships: [
          {
            foreignKeyName: "cash_settlements_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cash_settlements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cash_settlements_journal_id_fkey";
            columns: ["journal_id"];
            isOneToOne: false;
            referencedRelation: "ledger_journals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cash_settlements_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "org_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cash_settlements_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cash_settlements_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          image_path: string | null;
          is_active: boolean;
          name: string;
          name_ur: string | null;
          parent_id: string | null;
          slug: string;
          sort_order: number;
          tint: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          image_path?: string | null;
          is_active?: boolean;
          name: string;
          name_ur?: string | null;
          parent_id?: string | null;
          slug: string;
          sort_order?: number;
          tint?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          image_path?: string | null;
          is_active?: boolean;
          name?: string;
          name_ur?: string | null;
          parent_id?: string | null;
          slug?: string;
          sort_order?: number;
          tint?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_messages: {
        Row: {
          body: string;
          conversation_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          order_id: string | null;
          sender_id: string | null;
          sender_name: string | null;
          sender_side: Database["public"]["Enums"]["chat_side"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          body: string;
          conversation_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          order_id?: string | null;
          sender_id?: string | null;
          sender_name?: string | null;
          sender_side: Database["public"]["Enums"]["chat_side"];
          updated_at?: string;
        };
        Update: {
          body?: string;
          conversation_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          order_id?: string | null;
          sender_id?: string | null;
          sender_name?: string | null;
          sender_side?: Database["public"]["Enums"]["chat_side"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_messages_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_messages_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "open_invoices";
            referencedColumns: ["order_id"];
          },
          {
            foreignKeyName: "chat_messages_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      content_pages: {
        Row: {
          body_md: string;
          created_at: string;
          created_by: string | null;
          id: string;
          is_published: boolean;
          locale: Database["public"]["Enums"]["app_locale"];
          published_at: string | null;
          slug: string;
          title: string;
          updated_at: string;
          version: number;
        };
        ComputedFields: never;
        Insert: {
          body_md?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_published?: boolean;
          locale: Database["public"]["Enums"]["app_locale"];
          published_at?: string | null;
          slug: string;
          title: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          body_md?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_published?: boolean;
          locale?: Database["public"]["Enums"]["app_locale"];
          published_at?: string | null;
          slug?: string;
          title?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "content_pages_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      conversation_reads: {
        Row: {
          conversation_id: string;
          created_at: string;
          created_by: string | null;
          id: string;
          last_read_at: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          conversation_id: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          last_read_at?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          conversation_id?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          last_read_at?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "conversation_reads_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_reads_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversation_reads_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      conversations: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          kind: Database["public"]["Enums"]["conversation_kind"];
          last_message_at: string | null;
          last_message_preview: string | null;
          last_sender_side: Database["public"]["Enums"]["chat_side"] | null;
          org_id: string | null;
          shop_id: string | null;
          status: string;
          updated_at: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["conversation_kind"];
          last_message_at?: string | null;
          last_message_preview?: string | null;
          last_sender_side?: Database["public"]["Enums"]["chat_side"] | null;
          org_id?: string | null;
          shop_id?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["conversation_kind"];
          last_message_at?: string | null;
          last_message_preview?: string | null;
          last_sender_side?: Database["public"]["Enums"]["chat_side"] | null;
          org_id?: string | null;
          shop_id?: string | null;
          status?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "conversations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "conversations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      counters: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          scope: string;
          updated_at: string;
          value: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          scope: string;
          updated_at?: string;
          value?: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          scope?: string;
          updated_at?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "counters_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      credit_notes: {
        Row: {
          amount_paisa: number;
          created_at: string;
          created_by: string | null;
          credit_note_number: string;
          deleted_at: string | null;
          id: string;
          issued_at: string;
          issued_by: string | null;
          journal_id: string | null;
          order_id: string | null;
          org_id: string;
          reason: string | null;
          return_id: string | null;
          shop_id: string;
          status: Database["public"]["Enums"]["credit_note_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount_paisa: number;
          created_at?: string;
          created_by?: string | null;
          credit_note_number: string;
          deleted_at?: string | null;
          id?: string;
          issued_at?: string;
          issued_by?: string | null;
          journal_id?: string | null;
          order_id?: string | null;
          org_id: string;
          reason?: string | null;
          return_id?: string | null;
          shop_id: string;
          status?: Database["public"]["Enums"]["credit_note_status"];
          updated_at?: string;
        };
        Update: {
          amount_paisa?: number;
          created_at?: string;
          created_by?: string | null;
          credit_note_number?: string;
          deleted_at?: string | null;
          id?: string;
          issued_at?: string;
          issued_by?: string | null;
          journal_id?: string | null;
          order_id?: string | null;
          org_id?: string;
          reason?: string | null;
          return_id?: string | null;
          shop_id?: string;
          status?: Database["public"]["Enums"]["credit_note_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "credit_notes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_notes_issued_by_fkey";
            columns: ["issued_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_notes_journal_id_fkey";
            columns: ["journal_id"];
            isOneToOne: false;
            referencedRelation: "ledger_journals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_notes_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "open_invoices";
            referencedColumns: ["order_id"];
          },
          {
            foreignKeyName: "credit_notes_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_notes_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_notes_return_id_fkey";
            columns: ["return_id"];
            isOneToOne: false;
            referencedRelation: "returns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_notes_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_order_items: {
        Row: {
          created_at: string;
          created_by: string | null;
          customer_id: string | null;
          customer_order_id: string;
          id: string;
          image_path: string | null;
          inventory_id: string | null;
          line_total_paisa: number;
          mrp_paisa: number | null;
          name: string;
          name_ur: string | null;
          qty: number;
          shop_id: string;
          unit: Database["public"]["Enums"]["measure_unit"];
          unit_price_paisa: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          customer_order_id: string;
          id?: string;
          image_path?: string | null;
          inventory_id?: string | null;
          line_total_paisa: number;
          mrp_paisa?: number | null;
          name: string;
          name_ur?: string | null;
          qty: number;
          shop_id: string;
          unit?: Database["public"]["Enums"]["measure_unit"];
          unit_price_paisa: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          customer_order_id?: string;
          id?: string;
          image_path?: string | null;
          inventory_id?: string | null;
          line_total_paisa?: number;
          mrp_paisa?: number | null;
          name?: string;
          name_ur?: string | null;
          qty?: number;
          shop_id?: string;
          unit?: Database["public"]["Enums"]["measure_unit"];
          unit_price_paisa?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_order_items_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_order_items_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_order_items_customer_order_id_fkey";
            columns: ["customer_order_id"];
            isOneToOne: false;
            referencedRelation: "customer_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_order_items_inventory_id_fkey";
            columns: ["inventory_id"];
            isOneToOne: false;
            referencedRelation: "shop_inventory";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_order_items_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_orders: {
        Row: {
          accepted_at: string | null;
          address_id: string | null;
          cancel_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          client_request_id: string | null;
          created_at: string;
          created_by: string | null;
          customer_id: string | null;
          customer_name: string | null;
          customer_phone: string | null;
          deleted_at: string | null;
          delivered_at: string | null;
          delivery_address: Json | null;
          delivery_fee_paisa: number;
          discount_paisa: number;
          fulfilment: Database["public"]["Enums"]["fulfilment_type"];
          id: string;
          items_count: number;
          notes: string | null;
          order_number: string;
          out_for_delivery_at: string | null;
          packed_at: string | null;
          payment_method: Database["public"]["Enums"]["customer_payment_method"];
          payment_status: Database["public"]["Enums"]["order_payment_status"];
          pos_bill_id: string | null;
          rejected_reason: string | null;
          shop_id: string;
          shop_name: string;
          status: Database["public"]["Enums"]["customer_order_status"];
          subtotal_paisa: number;
          total_paisa: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          accepted_at?: string | null;
          address_id?: string | null;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          client_request_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          deleted_at?: string | null;
          delivered_at?: string | null;
          delivery_address?: Json | null;
          delivery_fee_paisa?: number;
          discount_paisa?: number;
          fulfilment?: Database["public"]["Enums"]["fulfilment_type"];
          id?: string;
          items_count?: number;
          notes?: string | null;
          order_number: string;
          out_for_delivery_at?: string | null;
          packed_at?: string | null;
          payment_method?: Database["public"]["Enums"]["customer_payment_method"];
          payment_status?: Database["public"]["Enums"]["order_payment_status"];
          pos_bill_id?: string | null;
          rejected_reason?: string | null;
          shop_id: string;
          shop_name: string;
          status?: Database["public"]["Enums"]["customer_order_status"];
          subtotal_paisa?: number;
          total_paisa?: number;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          address_id?: string | null;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          client_request_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          deleted_at?: string | null;
          delivered_at?: string | null;
          delivery_address?: Json | null;
          delivery_fee_paisa?: number;
          discount_paisa?: number;
          fulfilment?: Database["public"]["Enums"]["fulfilment_type"];
          id?: string;
          items_count?: number;
          notes?: string | null;
          order_number?: string;
          out_for_delivery_at?: string | null;
          packed_at?: string | null;
          payment_method?: Database["public"]["Enums"]["customer_payment_method"];
          payment_status?: Database["public"]["Enums"]["order_payment_status"];
          pos_bill_id?: string | null;
          rejected_reason?: string | null;
          shop_id?: string;
          shop_name?: string;
          status?: Database["public"]["Enums"]["customer_order_status"];
          subtotal_paisa?: number;
          total_paisa?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_orders_address_id_fkey";
            columns: ["address_id"];
            isOneToOne: false;
            referencedRelation: "addresses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_orders_cancelled_by_fkey";
            columns: ["cancelled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_orders_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_orders_pos_bill_id_fkey";
            columns: ["pos_bill_id"];
            isOneToOne: false;
            referencedRelation: "pos_bills";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_orders_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      data_deletion_requests: {
        Row: {
          created_at: string;
          created_by: string | null;
          full_name: string | null;
          handled_at: string | null;
          handled_by: string | null;
          id: string;
          phone: string | null;
          reason: string | null;
          resolution_notes: string | null;
          status: Database["public"]["Enums"]["deletion_request_status"];
          updated_at: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          full_name?: string | null;
          handled_at?: string | null;
          handled_by?: string | null;
          id?: string;
          phone?: string | null;
          reason?: string | null;
          resolution_notes?: string | null;
          status?: Database["public"]["Enums"]["deletion_request_status"];
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          full_name?: string | null;
          handled_at?: string | null;
          handled_by?: string | null;
          id?: string;
          phone?: string | null;
          reason?: string | null;
          resolution_notes?: string | null;
          status?: Database["public"]["Enums"]["deletion_request_status"];
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "data_deletion_requests_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "data_deletion_requests_handled_by_fkey";
            columns: ["handled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "data_deletion_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      delivery_otps: {
        Row: {
          attempts: number;
          code: string;
          created_at: string;
          created_by: string | null;
          id: string;
          order_id: string;
          shop_id: string;
          updated_at: string;
          verified_at: string | null;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          code: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          order_id: string;
          shop_id: string;
          updated_at?: string;
          verified_at?: string | null;
        };
        Update: {
          attempts?: number;
          code?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          order_id?: string;
          shop_id?: string;
          updated_at?: string;
          verified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "delivery_otps_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "delivery_otps_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "open_invoices";
            referencedColumns: ["order_id"];
          },
          {
            foreignKeyName: "delivery_otps_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "delivery_otps_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      distributor_products: {
        Row: {
          barcode: string | null;
          brand_id: string | null;
          category_id: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          image_path: string | null;
          is_active: boolean;
          master_product_id: string | null;
          moq_base_qty: number;
          mrp_paisa: number;
          name: string;
          name_ur: string | null;
          org_id: string;
          pack_size_label: string | null;
          search_text: string | null;
          sku: string;
          trade_price_paisa: number;
          updated_at: string;
          visible_area_ids: string[] | null;
        };
        ComputedFields: never;
        Insert: {
          barcode?: string | null;
          brand_id?: string | null;
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          image_path?: string | null;
          is_active?: boolean;
          master_product_id?: string | null;
          moq_base_qty?: number;
          mrp_paisa?: number;
          name: string;
          name_ur?: string | null;
          org_id: string;
          pack_size_label?: string | null;
          search_text?: never;
          sku: string;
          trade_price_paisa: number;
          updated_at?: string;
          visible_area_ids?: string[] | null;
        };
        Update: {
          barcode?: string | null;
          brand_id?: string | null;
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          image_path?: string | null;
          is_active?: boolean;
          master_product_id?: string | null;
          moq_base_qty?: number;
          mrp_paisa?: number;
          name?: string;
          name_ur?: string | null;
          org_id?: string;
          pack_size_label?: string | null;
          search_text?: never;
          sku?: string;
          trade_price_paisa?: number;
          updated_at?: string;
          visible_area_ids?: string[] | null;
        };
        Relationships: [
          {
            foreignKeyName: "distributor_products_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "distributor_products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "distributor_products_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "distributor_products_master_product_id_fkey";
            columns: ["master_product_id"];
            isOneToOne: false;
            referencedRelation: "master_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "distributor_products_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      events: {
        Row: {
          anonymous_id: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          occurred_at: string;
          org_id: string | null;
          path: string | null;
          properties: NonNullable<Json>;
          session_id: string | null;
          shop_id: string | null;
          updated_at: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          anonymous_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          occurred_at?: string;
          org_id?: string | null;
          path?: string | null;
          properties?: NonNullable<Json>;
          session_id?: string | null;
          shop_id?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          anonymous_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          occurred_at?: string;
          org_id?: string | null;
          path?: string | null;
          properties?: NonNullable<Json>;
          session_id?: string | null;
          shop_id?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "events_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      expenses: {
        Row: {
          amount_paisa: number;
          category: Database["public"]["Enums"]["expense_category"];
          client_id: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          expense_date: string;
          id: string;
          notes: string | null;
          paid_from: Database["public"]["Enums"]["payment_method"];
          receipt_path: string | null;
          recorded_by: string | null;
          shop_id: string;
          updated_at: string;
          void_reason: string | null;
        };
        ComputedFields: never;
        Insert: {
          amount_paisa: number;
          category: Database["public"]["Enums"]["expense_category"];
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          expense_date?: string;
          id?: string;
          notes?: string | null;
          paid_from?: Database["public"]["Enums"]["payment_method"];
          receipt_path?: string | null;
          recorded_by?: string | null;
          shop_id: string;
          updated_at?: string;
          void_reason?: string | null;
        };
        Update: {
          amount_paisa?: number;
          category?: Database["public"]["Enums"]["expense_category"];
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          expense_date?: string;
          id?: string;
          notes?: string | null;
          paid_from?: Database["public"]["Enums"]["payment_method"];
          receipt_path?: string | null;
          recorded_by?: string | null;
          shop_id?: string;
          updated_at?: string;
          void_reason?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "expenses_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      feature_flags: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          enabled: boolean;
          id: string;
          key: string;
          rules: NonNullable<Json>;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          enabled?: boolean;
          id?: string;
          key: string;
          rules?: NonNullable<Json>;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          enabled?: boolean;
          id?: string;
          key?: string;
          rules?: NonNullable<Json>;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "feature_flags_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      field_targets: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          member_id: string;
          metric: Database["public"]["Enums"]["target_metric"];
          org_id: string;
          period_end: string;
          period_start: string;
          target_value: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          member_id: string;
          metric: Database["public"]["Enums"]["target_metric"];
          org_id: string;
          period_end: string;
          period_start: string;
          target_value: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          member_id?: string;
          metric?: Database["public"]["Enums"]["target_metric"];
          org_id?: string;
          period_end?: string;
          period_start?: string;
          target_value?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "field_targets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "field_targets_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: false;
            referencedRelation: "org_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "field_targets_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      integration_settings: {
        Row: {
          config: NonNullable<Json>;
          created_at: string;
          created_by: string | null;
          id: string;
          kind: Database["public"]["Enums"]["integration_kind"];
          last_error: string | null;
          last_tested_at: string | null;
          org_id: string | null;
          owner_type: Database["public"]["Enums"]["content_owner_type"];
          shop_id: string | null;
          status: Database["public"]["Enums"]["integration_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          config?: NonNullable<Json>;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["integration_kind"];
          last_error?: string | null;
          last_tested_at?: string | null;
          org_id?: string | null;
          owner_type: Database["public"]["Enums"]["content_owner_type"];
          shop_id?: string | null;
          status?: Database["public"]["Enums"]["integration_status"];
          updated_at?: string;
        };
        Update: {
          config?: NonNullable<Json>;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["integration_kind"];
          last_error?: string | null;
          last_tested_at?: string | null;
          org_id?: string | null;
          owner_type?: Database["public"]["Enums"]["content_owner_type"];
          shop_id?: string | null;
          status?: Database["public"]["Enums"]["integration_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "integration_settings_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "integration_settings_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "integration_settings_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      ledger_accounts: {
        Row: {
          book_id: string | null;
          book_type: Database["public"]["Enums"]["ledger_book_type"];
          code: Database["public"]["Enums"]["ledger_account_code"];
          counterparty_customer_id: string | null;
          counterparty_id: string | null;
          counterparty_shop_id: string | null;
          counterparty_type: Database["public"]["Enums"]["counterparty_type"] | null;
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          name: string;
          org_id: string | null;
          shop_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          book_id?: never;
          book_type: Database["public"]["Enums"]["ledger_book_type"];
          code: Database["public"]["Enums"]["ledger_account_code"];
          counterparty_customer_id?: string | null;
          counterparty_id?: never;
          counterparty_shop_id?: string | null;
          counterparty_type?: Database["public"]["Enums"]["counterparty_type"] | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          org_id?: string | null;
          shop_id?: string | null;
          updated_at?: string;
        };
        Update: {
          book_id?: never;
          book_type?: Database["public"]["Enums"]["ledger_book_type"];
          code?: Database["public"]["Enums"]["ledger_account_code"];
          counterparty_customer_id?: string | null;
          counterparty_id?: never;
          counterparty_shop_id?: string | null;
          counterparty_type?: Database["public"]["Enums"]["counterparty_type"] | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          org_id?: string | null;
          shop_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ledger_accounts_counterparty_customer_id_fkey";
            columns: ["counterparty_customer_id"];
            isOneToOne: false;
            referencedRelation: "shop_customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_accounts_counterparty_shop_id_fkey";
            columns: ["counterparty_shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_accounts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_accounts_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_accounts_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      ledger_entries: {
        Row: {
          account_id: string;
          book_id: string | null;
          book_type: Database["public"]["Enums"]["ledger_book_type"];
          counterparty_customer_id: string | null;
          counterparty_shop_id: string | null;
          created_at: string;
          created_by: string | null;
          credit_paisa: number;
          debit_paisa: number;
          deleted_at: string | null;
          due_date: string | null;
          entry_date: string;
          id: string;
          journal_id: string;
          memo: string | null;
          org_id: string | null;
          reference_id: string | null;
          reference_type: string | null;
          reversal_of: string | null;
          shop_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          account_id: string;
          book_id?: never;
          book_type: Database["public"]["Enums"]["ledger_book_type"];
          counterparty_customer_id?: string | null;
          counterparty_shop_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          credit_paisa?: number;
          debit_paisa?: number;
          deleted_at?: string | null;
          due_date?: string | null;
          entry_date?: string;
          id?: string;
          journal_id: string;
          memo?: string | null;
          org_id?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          reversal_of?: string | null;
          shop_id?: string | null;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          book_id?: never;
          book_type?: Database["public"]["Enums"]["ledger_book_type"];
          counterparty_customer_id?: string | null;
          counterparty_shop_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          credit_paisa?: number;
          debit_paisa?: number;
          deleted_at?: string | null;
          due_date?: string | null;
          entry_date?: string;
          id?: string;
          journal_id?: string;
          memo?: string | null;
          org_id?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          reversal_of?: string | null;
          shop_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ledger_entries_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "ledger_account_balances";
            referencedColumns: ["account_id"];
          },
          {
            foreignKeyName: "ledger_entries_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "ledger_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_counterparty_customer_id_fkey";
            columns: ["counterparty_customer_id"];
            isOneToOne: false;
            referencedRelation: "shop_customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_counterparty_shop_id_fkey";
            columns: ["counterparty_shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_journal_id_fkey";
            columns: ["journal_id"];
            isOneToOne: false;
            referencedRelation: "ledger_journals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_reversal_of_fkey";
            columns: ["reversal_of"];
            isOneToOne: false;
            referencedRelation: "ledger_entries";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_entries_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      ledger_journals: {
        Row: {
          book_id: string | null;
          book_type: Database["public"]["Enums"]["ledger_book_type"];
          client_id: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          entry_date: string;
          id: string;
          memo: string | null;
          org_id: string | null;
          posted_by: string | null;
          reference_id: string | null;
          reference_type: string | null;
          reversal_of: string | null;
          shop_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          book_id?: never;
          book_type: Database["public"]["Enums"]["ledger_book_type"];
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          entry_date?: string;
          id?: string;
          memo?: string | null;
          org_id?: string | null;
          posted_by?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          reversal_of?: string | null;
          shop_id?: string | null;
          updated_at?: string;
        };
        Update: {
          book_id?: never;
          book_type?: Database["public"]["Enums"]["ledger_book_type"];
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          entry_date?: string;
          id?: string;
          memo?: string | null;
          org_id?: string | null;
          posted_by?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          reversal_of?: string | null;
          shop_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ledger_journals_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_journals_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_journals_posted_by_fkey";
            columns: ["posted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_journals_reversal_of_fkey";
            columns: ["reversal_of"];
            isOneToOne: false;
            referencedRelation: "ledger_journals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_journals_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      master_products: {
        Row: {
          barcode: string | null;
          brand_id: string | null;
          category_id: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          image_path: string | null;
          is_active: boolean;
          mrp_paisa: number | null;
          name: string;
          name_ur: string | null;
          net_quantity: number | null;
          net_unit: Database["public"]["Enums"]["measure_unit"] | null;
          pack_size_label: string | null;
          search_text: string | null;
          sku: string | null;
          units_per_carton: number | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          barcode?: string | null;
          brand_id?: string | null;
          category_id: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          image_path?: string | null;
          is_active?: boolean;
          mrp_paisa?: number | null;
          name: string;
          name_ur?: string | null;
          net_quantity?: number | null;
          net_unit?: Database["public"]["Enums"]["measure_unit"] | null;
          pack_size_label?: string | null;
          search_text?: never;
          sku?: string | null;
          units_per_carton?: number | null;
          updated_at?: string;
        };
        Update: {
          barcode?: string | null;
          brand_id?: string | null;
          category_id?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          image_path?: string | null;
          is_active?: boolean;
          mrp_paisa?: number | null;
          name?: string;
          name_ur?: string | null;
          net_quantity?: number | null;
          net_unit?: Database["public"]["Enums"]["measure_unit"] | null;
          pack_size_label?: string | null;
          search_text?: never;
          sku?: string | null;
          units_per_carton?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "master_products_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "master_products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "master_products_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      message_outbox: {
        Row: {
          attempts: number;
          body: string | null;
          channel: Database["public"]["Enums"]["message_channel"];
          created_at: string;
          created_by: string | null;
          dedupe_key: string | null;
          error: string | null;
          id: string;
          kind: Database["public"]["Enums"]["message_kind"];
          org_id: string | null;
          payload: NonNullable<Json>;
          provider: string | null;
          provider_message_id: string | null;
          scheduled_at: string;
          sent_at: string | null;
          shop_id: string | null;
          status: Database["public"]["Enums"]["message_status"];
          template: string | null;
          to_phone: string | null;
          to_user_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          body?: string | null;
          channel: Database["public"]["Enums"]["message_channel"];
          created_at?: string;
          created_by?: string | null;
          dedupe_key?: string | null;
          error?: string | null;
          id?: string;
          kind: Database["public"]["Enums"]["message_kind"];
          org_id?: string | null;
          payload?: NonNullable<Json>;
          provider?: string | null;
          provider_message_id?: string | null;
          scheduled_at?: string;
          sent_at?: string | null;
          shop_id?: string | null;
          status?: Database["public"]["Enums"]["message_status"];
          template?: string | null;
          to_phone?: string | null;
          to_user_id?: string | null;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          body?: string | null;
          channel?: Database["public"]["Enums"]["message_channel"];
          created_at?: string;
          created_by?: string | null;
          dedupe_key?: string | null;
          error?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["message_kind"];
          org_id?: string | null;
          payload?: NonNullable<Json>;
          provider?: string | null;
          provider_message_id?: string | null;
          scheduled_at?: string;
          sent_at?: string | null;
          shop_id?: string | null;
          status?: Database["public"]["Enums"]["message_status"];
          template?: string | null;
          to_phone?: string | null;
          to_user_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_outbox_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_outbox_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_outbox_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          created_by: string | null;
          data: NonNullable<Json>;
          id: string;
          kind: Database["public"]["Enums"]["notification_kind"];
          link: string | null;
          org_id: string | null;
          read_at: string | null;
          shop_id: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          body?: string | null;
          created_at?: string;
          created_by?: string | null;
          data?: NonNullable<Json>;
          id?: string;
          kind: Database["public"]["Enums"]["notification_kind"];
          link?: string | null;
          org_id?: string | null;
          read_at?: string | null;
          shop_id?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          created_by?: string | null;
          data?: NonNullable<Json>;
          id?: string;
          kind?: Database["public"]["Enums"]["notification_kind"];
          link?: string | null;
          org_id?: string | null;
          read_at?: string | null;
          shop_id?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          barcode: string | null;
          base_qty: number | null;
          base_qty_per_unit: number;
          category_id: string | null;
          created_at: string;
          created_by: string | null;
          damaged_base_qty: number;
          deleted_at: string | null;
          delivered_base_qty: number | null;
          distributor_product_id: string;
          free_base_qty: number;
          free_delivered_base_qty: number | null;
          id: string;
          image_path: string | null;
          invoiced_total_paisa: number | null;
          line_discount_paisa: number;
          line_total_paisa: number;
          master_product_id: string | null;
          mrp_paisa: number;
          name: string;
          name_ur: string | null;
          order_id: string;
          org_id: string;
          pack_label: string | null;
          pack_unit: Database["public"]["Enums"]["pack_unit_kind"];
          pack_unit_id: string | null;
          piece_price_paisa: number;
          quantity: number;
          received_base_qty: number | null;
          scheme_id: string | null;
          shop_id: string;
          short_base_qty: number;
          sku: string | null;
          substitution_of_item_id: string | null;
          substitution_status: Database["public"]["Enums"]["substitution_status"] | null;
          unit_price_paisa: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          barcode?: string | null;
          base_qty?: never;
          base_qty_per_unit: number;
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          damaged_base_qty?: number;
          deleted_at?: string | null;
          delivered_base_qty?: number | null;
          distributor_product_id: string;
          free_base_qty?: number;
          free_delivered_base_qty?: number | null;
          id?: string;
          image_path?: string | null;
          invoiced_total_paisa?: number | null;
          line_discount_paisa?: number;
          line_total_paisa: number;
          master_product_id?: string | null;
          mrp_paisa?: number;
          name: string;
          name_ur?: string | null;
          order_id: string;
          org_id: string;
          pack_label?: string | null;
          pack_unit: Database["public"]["Enums"]["pack_unit_kind"];
          pack_unit_id?: string | null;
          piece_price_paisa: number;
          quantity: number;
          received_base_qty?: number | null;
          scheme_id?: string | null;
          shop_id: string;
          short_base_qty?: number;
          sku?: string | null;
          substitution_of_item_id?: string | null;
          substitution_status?: Database["public"]["Enums"]["substitution_status"] | null;
          unit_price_paisa: number;
          updated_at?: string;
        };
        Update: {
          barcode?: string | null;
          base_qty?: never;
          base_qty_per_unit?: number;
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          damaged_base_qty?: number;
          deleted_at?: string | null;
          delivered_base_qty?: number | null;
          distributor_product_id?: string;
          free_base_qty?: number;
          free_delivered_base_qty?: number | null;
          id?: string;
          image_path?: string | null;
          invoiced_total_paisa?: number | null;
          line_discount_paisa?: number;
          line_total_paisa?: number;
          master_product_id?: string | null;
          mrp_paisa?: number;
          name?: string;
          name_ur?: string | null;
          order_id?: string;
          org_id?: string;
          pack_label?: string | null;
          pack_unit?: Database["public"]["Enums"]["pack_unit_kind"];
          pack_unit_id?: string | null;
          piece_price_paisa?: number;
          quantity?: number;
          received_base_qty?: number | null;
          scheme_id?: string | null;
          shop_id?: string;
          short_base_qty?: number;
          sku?: string | null;
          substitution_of_item_id?: string | null;
          substitution_status?: Database["public"]["Enums"]["substitution_status"] | null;
          unit_price_paisa?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_distributor_product_id_fkey";
            columns: ["distributor_product_id"];
            isOneToOne: false;
            referencedRelation: "distributor_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_master_product_id_fkey";
            columns: ["master_product_id"];
            isOneToOne: false;
            referencedRelation: "master_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "open_invoices";
            referencedColumns: ["order_id"];
          },
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_pack_unit_id_fkey";
            columns: ["pack_unit_id"];
            isOneToOne: false;
            referencedRelation: "pack_units";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_scheme_id_fkey";
            columns: ["scheme_id"];
            isOneToOne: false;
            referencedRelation: "schemes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_substitution_of_item_id_fkey";
            columns: ["substitution_of_item_id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
        ];
      };
      order_status_history: {
        Row: {
          changed_by: string | null;
          changed_by_name: string | null;
          created_at: string;
          created_by: string | null;
          from_status: Database["public"]["Enums"]["order_status"] | null;
          id: string;
          note: string | null;
          order_id: string;
          org_id: string;
          shop_id: string;
          to_status: Database["public"]["Enums"]["order_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          changed_by?: string | null;
          changed_by_name?: string | null;
          created_at?: string;
          created_by?: string | null;
          from_status?: Database["public"]["Enums"]["order_status"] | null;
          id?: string;
          note?: string | null;
          order_id: string;
          org_id: string;
          shop_id: string;
          to_status: Database["public"]["Enums"]["order_status"];
          updated_at?: string;
        };
        Update: {
          changed_by?: string | null;
          changed_by_name?: string | null;
          created_at?: string;
          created_by?: string | null;
          from_status?: Database["public"]["Enums"]["order_status"] | null;
          id?: string;
          note?: string | null;
          order_id?: string;
          org_id?: string;
          shop_id?: string;
          to_status?: Database["public"]["Enums"]["order_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "order_status_history_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_status_history_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "open_invoices";
            referencedColumns: ["order_id"];
          },
          {
            foreignKeyName: "order_status_history_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_status_history_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_status_history_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          booker_id: string | null;
          cancel_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          client_request_id: string | null;
          confirmation_reasons: string[];
          confirmed_at: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          delivered_at: string | null;
          delivery_address: Json | null;
          delivery_fee_paisa: number;
          delivery_slot_end: string | null;
          delivery_slot_start: string | null;
          discount_paisa: number;
          dispatched_at: string | null;
          due_date: string | null;
          id: string;
          invoice_number: string | null;
          invoice_path: string | null;
          invoiced_at: string | null;
          needs_confirmation: boolean;
          notes: string | null;
          order_number: string;
          ordered_total_paisa: number;
          org_id: string;
          packed_at: string | null;
          paid_paisa: number;
          payment_method: Database["public"]["Enums"]["order_payment_method"];
          payment_status: Database["public"]["Enums"]["order_payment_status"];
          phone_confirmed_at: string | null;
          phone_confirmed_by: string | null;
          picking_at: string | null;
          placed_by: string | null;
          placed_by_name: string | null;
          rating: number | null;
          received_at: string | null;
          received_by: string | null;
          returned_at: string | null;
          scheme_discount_paisa: number;
          shop_confirm_requested_at: string | null;
          shop_confirmed_at: string | null;
          shop_confirmed_by: string | null;
          shop_id: string;
          source: Database["public"]["Enums"]["order_source"];
          status: Database["public"]["Enums"]["order_status"];
          subtotal_paisa: number;
          total_paisa: number;
          trip_id: string | null;
          updated_at: string;
          warehouse_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          booker_id?: string | null;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          client_request_id?: string | null;
          confirmation_reasons?: string[];
          confirmed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          delivered_at?: string | null;
          delivery_address?: Json | null;
          delivery_fee_paisa?: number;
          delivery_slot_end?: string | null;
          delivery_slot_start?: string | null;
          discount_paisa?: number;
          dispatched_at?: string | null;
          due_date?: string | null;
          id?: string;
          invoice_number?: string | null;
          invoice_path?: string | null;
          invoiced_at?: string | null;
          needs_confirmation?: boolean;
          notes?: string | null;
          order_number: string;
          ordered_total_paisa?: number;
          org_id: string;
          packed_at?: string | null;
          paid_paisa?: number;
          payment_method: Database["public"]["Enums"]["order_payment_method"];
          payment_status?: Database["public"]["Enums"]["order_payment_status"];
          phone_confirmed_at?: string | null;
          phone_confirmed_by?: string | null;
          picking_at?: string | null;
          placed_by?: string | null;
          placed_by_name?: string | null;
          rating?: number | null;
          received_at?: string | null;
          received_by?: string | null;
          returned_at?: string | null;
          scheme_discount_paisa?: number;
          shop_confirm_requested_at?: string | null;
          shop_confirmed_at?: string | null;
          shop_confirmed_by?: string | null;
          shop_id: string;
          source?: Database["public"]["Enums"]["order_source"];
          status?: Database["public"]["Enums"]["order_status"];
          subtotal_paisa?: number;
          total_paisa?: number;
          trip_id?: string | null;
          updated_at?: string;
          warehouse_id?: string | null;
        };
        Update: {
          booker_id?: string | null;
          cancel_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          client_request_id?: string | null;
          confirmation_reasons?: string[];
          confirmed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          delivered_at?: string | null;
          delivery_address?: Json | null;
          delivery_fee_paisa?: number;
          delivery_slot_end?: string | null;
          delivery_slot_start?: string | null;
          discount_paisa?: number;
          dispatched_at?: string | null;
          due_date?: string | null;
          id?: string;
          invoice_number?: string | null;
          invoice_path?: string | null;
          invoiced_at?: string | null;
          needs_confirmation?: boolean;
          notes?: string | null;
          order_number?: string;
          ordered_total_paisa?: number;
          org_id?: string;
          packed_at?: string | null;
          paid_paisa?: number;
          payment_method?: Database["public"]["Enums"]["order_payment_method"];
          payment_status?: Database["public"]["Enums"]["order_payment_status"];
          phone_confirmed_at?: string | null;
          phone_confirmed_by?: string | null;
          picking_at?: string | null;
          placed_by?: string | null;
          placed_by_name?: string | null;
          rating?: number | null;
          received_at?: string | null;
          received_by?: string | null;
          returned_at?: string | null;
          scheme_discount_paisa?: number;
          shop_confirm_requested_at?: string | null;
          shop_confirmed_at?: string | null;
          shop_confirmed_by?: string | null;
          shop_id?: string;
          source?: Database["public"]["Enums"]["order_source"];
          status?: Database["public"]["Enums"]["order_status"];
          subtotal_paisa?: number;
          total_paisa?: number;
          trip_id?: string | null;
          updated_at?: string;
          warehouse_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "orders_booker_id_fkey";
            columns: ["booker_id"];
            isOneToOne: false;
            referencedRelation: "org_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_cancelled_by_fkey";
            columns: ["cancelled_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_phone_confirmed_by_fkey";
            columns: ["phone_confirmed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_placed_by_fkey";
            columns: ["placed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_received_by_fkey";
            columns: ["received_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_shop_confirmed_by_fkey";
            columns: ["shop_confirmed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
        ];
      };
      org_members: {
        Row: {
          created_at: string;
          created_by: string | null;
          display_name: string | null;
          id: string;
          invited_by: string | null;
          joined_at: string | null;
          org_id: string;
          permissions: string[];
          phone: string | null;
          role: Database["public"]["Enums"]["org_member_role"];
          status: Database["public"]["Enums"]["member_status"];
          updated_at: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          display_name?: string | null;
          id?: string;
          invited_by?: string | null;
          joined_at?: string | null;
          org_id: string;
          permissions?: string[];
          phone?: string | null;
          role: Database["public"]["Enums"]["org_member_role"];
          status?: Database["public"]["Enums"]["member_status"];
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          display_name?: string | null;
          id?: string;
          invited_by?: string | null;
          joined_at?: string | null;
          org_id?: string;
          permissions?: string[];
          phone?: string | null;
          role?: Database["public"]["Enums"]["org_member_role"];
          status?: Database["public"]["Enums"]["member_status"];
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "org_members_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "org_members_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "org_members_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "org_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          address_line: string | null;
          approved_at: string | null;
          approved_by: string | null;
          area_id: string | null;
          cover_path: string | null;
          created_at: string;
          created_by: string | null;
          delivery_fee_paisa: number;
          description: string | null;
          email: string | null;
          free_delivery_above_paisa: number | null;
          id: string;
          lat: number | null;
          legal_name: string | null;
          lng: number | null;
          location: unknown;
          logo_path: string | null;
          min_order_paisa: number;
          name: string;
          ntn: string | null;
          phone: string | null;
          rejection_reason: string | null;
          served_area_ids: string[] | null;
          settings: NonNullable<Json>;
          slug: string;
          status: Database["public"]["Enums"]["approval_status"];
          strn: string | null;
          submitted_at: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address_line?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          area_id?: string | null;
          cover_path?: string | null;
          created_at?: string;
          created_by?: string | null;
          delivery_fee_paisa?: number;
          description?: string | null;
          email?: string | null;
          free_delivery_above_paisa?: number | null;
          id?: string;
          lat?: number | null;
          legal_name?: string | null;
          lng?: number | null;
          location?: never;
          logo_path?: string | null;
          min_order_paisa?: number;
          name: string;
          ntn?: string | null;
          phone?: string | null;
          rejection_reason?: string | null;
          served_area_ids?: string[] | null;
          settings?: NonNullable<Json>;
          slug: string;
          status?: Database["public"]["Enums"]["approval_status"];
          strn?: string | null;
          submitted_at?: string | null;
          updated_at?: string;
        };
        Update: {
          address_line?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          area_id?: string | null;
          cover_path?: string | null;
          created_at?: string;
          created_by?: string | null;
          delivery_fee_paisa?: number;
          description?: string | null;
          email?: string | null;
          free_delivery_above_paisa?: number | null;
          id?: string;
          lat?: number | null;
          legal_name?: string | null;
          lng?: number | null;
          location?: never;
          logo_path?: string | null;
          min_order_paisa?: number;
          name?: string;
          ntn?: string | null;
          phone?: string | null;
          rejection_reason?: string | null;
          served_area_ids?: string[] | null;
          settings?: NonNullable<Json>;
          slug?: string;
          status?: Database["public"]["Enums"]["approval_status"];
          strn?: string | null;
          submitted_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organizations_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organizations_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "service_areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organizations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      pack_units: {
        Row: {
          barcode: string | null;
          base_qty: number;
          created_at: string;
          created_by: string | null;
          distributor_product_id: string;
          id: string;
          is_default: boolean;
          label: string;
          org_id: string;
          unit: Database["public"]["Enums"]["pack_unit_kind"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          barcode?: string | null;
          base_qty: number;
          created_at?: string;
          created_by?: string | null;
          distributor_product_id: string;
          id?: string;
          is_default?: boolean;
          label: string;
          org_id: string;
          unit: Database["public"]["Enums"]["pack_unit_kind"];
          updated_at?: string;
        };
        Update: {
          barcode?: string | null;
          base_qty?: number;
          created_at?: string;
          created_by?: string | null;
          distributor_product_id?: string;
          id?: string;
          is_default?: boolean;
          label?: string;
          org_id?: string;
          unit?: Database["public"]["Enums"]["pack_unit_kind"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pack_units_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pack_units_distributor_product_id_fkey";
            columns: ["distributor_product_id"];
            isOneToOne: false;
            referencedRelation: "distributor_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pack_units_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_allocations: {
        Row: {
          amount_paisa: number;
          book_type: Database["public"]["Enums"]["ledger_book_type"];
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          order_id: string | null;
          org_id: string | null;
          payment_id: string;
          pos_bill_id: string | null;
          shop_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount_paisa: number;
          book_type: Database["public"]["Enums"]["ledger_book_type"];
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          order_id?: string | null;
          org_id?: string | null;
          payment_id: string;
          pos_bill_id?: string | null;
          shop_id?: string | null;
          updated_at?: string;
        };
        Update: {
          amount_paisa?: number;
          book_type?: Database["public"]["Enums"]["ledger_book_type"];
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          order_id?: string | null;
          org_id?: string | null;
          payment_id?: string;
          pos_bill_id?: string | null;
          shop_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_allocations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_allocations_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "open_invoices";
            referencedColumns: ["order_id"];
          },
          {
            foreignKeyName: "payment_allocations_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_allocations_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_allocations_payment_id_fkey";
            columns: ["payment_id"];
            isOneToOne: false;
            referencedRelation: "payments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_allocations_pos_bill_id_fkey";
            columns: ["pos_bill_id"];
            isOneToOne: false;
            referencedRelation: "pos_bills";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payment_allocations_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          allocated_paisa: number;
          amount_paisa: number;
          book_id: string | null;
          book_type: Database["public"]["Enums"]["ledger_book_type"];
          client_id: string | null;
          collected_by: string | null;
          collected_by_member_id: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          journal_id: string | null;
          method: Database["public"]["Enums"]["payment_method"];
          notes: string | null;
          org_id: string | null;
          payer_customer_id: string | null;
          payer_id: string | null;
          payer_shop_id: string | null;
          payer_type: Database["public"]["Enums"]["counterparty_type"];
          receipt_path: string | null;
          received_at: string;
          reference_no: string | null;
          rejection_reason: string | null;
          settlement_id: string | null;
          shop_id: string | null;
          status: Database["public"]["Enums"]["payment_status"];
          trip_id: string | null;
          updated_at: string;
          verified_at: string | null;
          verified_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          allocated_paisa?: number;
          amount_paisa: number;
          book_id?: never;
          book_type: Database["public"]["Enums"]["ledger_book_type"];
          client_id?: string | null;
          collected_by?: string | null;
          collected_by_member_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          journal_id?: string | null;
          method: Database["public"]["Enums"]["payment_method"];
          notes?: string | null;
          org_id?: string | null;
          payer_customer_id?: string | null;
          payer_id?: never;
          payer_shop_id?: string | null;
          payer_type: Database["public"]["Enums"]["counterparty_type"];
          receipt_path?: string | null;
          received_at?: string;
          reference_no?: string | null;
          rejection_reason?: string | null;
          settlement_id?: string | null;
          shop_id?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          trip_id?: string | null;
          updated_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Update: {
          allocated_paisa?: number;
          amount_paisa?: number;
          book_id?: never;
          book_type?: Database["public"]["Enums"]["ledger_book_type"];
          client_id?: string | null;
          collected_by?: string | null;
          collected_by_member_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          journal_id?: string | null;
          method?: Database["public"]["Enums"]["payment_method"];
          notes?: string | null;
          org_id?: string | null;
          payer_customer_id?: string | null;
          payer_id?: never;
          payer_shop_id?: string | null;
          payer_type?: Database["public"]["Enums"]["counterparty_type"];
          receipt_path?: string | null;
          received_at?: string;
          reference_no?: string | null;
          rejection_reason?: string | null;
          settlement_id?: string | null;
          shop_id?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          trip_id?: string | null;
          updated_at?: string;
          verified_at?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "payments_collected_by_fkey";
            columns: ["collected_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_collected_by_member_id_fkey";
            columns: ["collected_by_member_id"];
            isOneToOne: false;
            referencedRelation: "org_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_journal_id_fkey";
            columns: ["journal_id"];
            isOneToOne: false;
            referencedRelation: "ledger_journals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_payer_customer_id_fkey";
            columns: ["payer_customer_id"];
            isOneToOne: false;
            referencedRelation: "shop_customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_payer_shop_id_fkey";
            columns: ["payer_shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_settlement_id_fkey";
            columns: ["settlement_id"];
            isOneToOne: false;
            referencedRelation: "cash_settlements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_verified_by_fkey";
            columns: ["verified_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      plans: {
        Row: {
          billing_interval: Database["public"]["Enums"]["billing_interval"];
          code: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          features: string[];
          id: string;
          is_active: boolean;
          limits: NonNullable<Json>;
          name: string;
          name_ur: string | null;
          price_paisa: number;
          sort_order: number;
          trial_days: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          billing_interval?: Database["public"]["Enums"]["billing_interval"];
          code: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          features?: string[];
          id?: string;
          is_active?: boolean;
          limits?: NonNullable<Json>;
          name: string;
          name_ur?: string | null;
          price_paisa: number;
          sort_order?: number;
          trial_days?: number;
          updated_at?: string;
        };
        Update: {
          billing_interval?: Database["public"]["Enums"]["billing_interval"];
          code?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          features?: string[];
          id?: string;
          is_active?: boolean;
          limits?: NonNullable<Json>;
          name?: string;
          name_ur?: string | null;
          price_paisa?: number;
          sort_order?: number;
          trial_days?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "plans_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      pos_bill_items: {
        Row: {
          barcode: string | null;
          bill_id: string;
          category_id: string | null;
          cost_price_paisa: number;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          discount_paisa: number;
          id: string;
          inventory_id: string | null;
          line_total_paisa: number;
          mrp_paisa: number | null;
          name: string;
          qty: number;
          shop_id: string;
          unit: Database["public"]["Enums"]["measure_unit"];
          unit_price_paisa: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          barcode?: string | null;
          bill_id: string;
          category_id?: string | null;
          cost_price_paisa?: number;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          discount_paisa?: number;
          id?: string;
          inventory_id?: string | null;
          line_total_paisa: number;
          mrp_paisa?: number | null;
          name: string;
          qty: number;
          shop_id: string;
          unit?: Database["public"]["Enums"]["measure_unit"];
          unit_price_paisa: number;
          updated_at?: string;
        };
        Update: {
          barcode?: string | null;
          bill_id?: string;
          category_id?: string | null;
          cost_price_paisa?: number;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          discount_paisa?: number;
          id?: string;
          inventory_id?: string | null;
          line_total_paisa?: number;
          mrp_paisa?: number | null;
          name?: string;
          qty?: number;
          shop_id?: string;
          unit?: Database["public"]["Enums"]["measure_unit"];
          unit_price_paisa?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pos_bill_items_bill_id_fkey";
            columns: ["bill_id"];
            isOneToOne: false;
            referencedRelation: "pos_bills";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_bill_items_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_bill_items_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_bill_items_inventory_id_fkey";
            columns: ["inventory_id"];
            isOneToOne: false;
            referencedRelation: "shop_inventory";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_bill_items_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      pos_bills: {
        Row: {
          bill_discount_paisa: number;
          bill_number: number;
          billed_at: string;
          cashier_id: string | null;
          change_paisa: number;
          channel: Database["public"]["Enums"]["sale_channel"];
          client_id: string;
          cost_total_paisa: number;
          created_at: string;
          created_by: string | null;
          created_offline: boolean;
          customer_id: string | null;
          customer_order_id: string | null;
          deleted_at: string | null;
          device_id: string | null;
          digital_method: Database["public"]["Enums"]["payment_method"] | null;
          digital_reference: string | null;
          id: string;
          item_discount_paisa: number;
          journal_id: string | null;
          notes: string | null;
          paid_cash_paisa: number;
          paid_digital_paisa: number;
          shop_id: string;
          status: Database["public"]["Enums"]["pos_bill_status"];
          subtotal_paisa: number;
          synced_at: string | null;
          total_paisa: number;
          udhaar_paid_paisa: number;
          udhaar_paisa: number;
          updated_at: string;
          void_reason: string | null;
          voided_at: string | null;
          voided_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          bill_discount_paisa?: number;
          bill_number: number;
          billed_at?: string;
          cashier_id?: string | null;
          change_paisa?: number;
          channel?: Database["public"]["Enums"]["sale_channel"];
          client_id: string;
          cost_total_paisa?: number;
          created_at?: string;
          created_by?: string | null;
          created_offline?: boolean;
          customer_id?: string | null;
          customer_order_id?: string | null;
          deleted_at?: string | null;
          device_id?: string | null;
          digital_method?: Database["public"]["Enums"]["payment_method"] | null;
          digital_reference?: string | null;
          id?: string;
          item_discount_paisa?: number;
          journal_id?: string | null;
          notes?: string | null;
          paid_cash_paisa?: number;
          paid_digital_paisa?: number;
          shop_id: string;
          status?: Database["public"]["Enums"]["pos_bill_status"];
          subtotal_paisa?: number;
          synced_at?: string | null;
          total_paisa?: number;
          udhaar_paid_paisa?: number;
          udhaar_paisa?: number;
          updated_at?: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Update: {
          bill_discount_paisa?: number;
          bill_number?: number;
          billed_at?: string;
          cashier_id?: string | null;
          change_paisa?: number;
          channel?: Database["public"]["Enums"]["sale_channel"];
          client_id?: string;
          cost_total_paisa?: number;
          created_at?: string;
          created_by?: string | null;
          created_offline?: boolean;
          customer_id?: string | null;
          customer_order_id?: string | null;
          deleted_at?: string | null;
          device_id?: string | null;
          digital_method?: Database["public"]["Enums"]["payment_method"] | null;
          digital_reference?: string | null;
          id?: string;
          item_discount_paisa?: number;
          journal_id?: string | null;
          notes?: string | null;
          paid_cash_paisa?: number;
          paid_digital_paisa?: number;
          shop_id?: string;
          status?: Database["public"]["Enums"]["pos_bill_status"];
          subtotal_paisa?: number;
          synced_at?: string | null;
          total_paisa?: number;
          udhaar_paid_paisa?: number;
          udhaar_paisa?: number;
          updated_at?: string;
          void_reason?: string | null;
          voided_at?: string | null;
          voided_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "pos_bills_cashier_id_fkey";
            columns: ["cashier_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_bills_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_bills_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "shop_customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_bills_customer_order_id_fkey";
            columns: ["customer_order_id"];
            isOneToOne: false;
            referencedRelation: "customer_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_bills_journal_id_fkey";
            columns: ["journal_id"];
            isOneToOne: false;
            referencedRelation: "ledger_journals";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_bills_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "pos_bills_voided_by_fkey";
            columns: ["voided_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      price_tier_items: {
        Row: {
          created_at: string;
          created_by: string | null;
          distributor_product_id: string;
          id: string;
          org_id: string;
          price_paisa: number;
          price_tier_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          distributor_product_id: string;
          id?: string;
          org_id: string;
          price_paisa: number;
          price_tier_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          distributor_product_id?: string;
          id?: string;
          org_id?: string;
          price_paisa?: number;
          price_tier_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "price_tier_items_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_tier_items_distributor_product_id_fkey";
            columns: ["distributor_product_id"];
            isOneToOne: false;
            referencedRelation: "distributor_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_tier_items_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_tier_items_price_tier_id_fkey";
            columns: ["price_tier_id"];
            isOneToOne: false;
            referencedRelation: "price_tiers";
            referencedColumns: ["id"];
          },
        ];
      };
      price_tiers: {
        Row: {
          area_id: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          is_active: boolean;
          kind: Database["public"]["Enums"]["price_tier_kind"];
          name: string;
          org_id: string;
          priority: number;
          segment: Database["public"]["Enums"]["shop_tier"] | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          area_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          kind: Database["public"]["Enums"]["price_tier_kind"];
          name: string;
          org_id: string;
          priority?: number;
          segment?: Database["public"]["Enums"]["shop_tier"] | null;
          updated_at?: string;
        };
        Update: {
          area_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          kind?: Database["public"]["Enums"]["price_tier_kind"];
          name?: string;
          org_id?: string;
          priority?: number;
          segment?: Database["public"]["Enums"]["shop_tier"] | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "price_tiers_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "service_areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_tiers_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "price_tiers_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      product_aliases: {
        Row: {
          alias: string;
          alias_normalized: string | null;
          brand_id: string | null;
          category_id: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          kind: Database["public"]["Enums"]["alias_kind"];
          language: Database["public"]["Enums"]["app_locale"];
          master_product_id: string | null;
          target_id: string | null;
          target_type: Database["public"]["Enums"]["alias_target_type"];
          updated_at: string;
          weight: number;
        };
        ComputedFields: never;
        Insert: {
          alias: string;
          alias_normalized?: never;
          brand_id?: string | null;
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["alias_kind"];
          language?: Database["public"]["Enums"]["app_locale"];
          master_product_id?: string | null;
          target_id?: never;
          target_type: Database["public"]["Enums"]["alias_target_type"];
          updated_at?: string;
          weight?: number;
        };
        Update: {
          alias?: string;
          alias_normalized?: never;
          brand_id?: string | null;
          category_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["alias_kind"];
          language?: Database["public"]["Enums"]["app_locale"];
          master_product_id?: string | null;
          target_id?: never;
          target_type?: Database["public"]["Enums"]["alias_target_type"];
          updated_at?: string;
          weight?: number;
        };
        Relationships: [
          {
            foreignKeyName: "product_aliases_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_aliases_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_aliases_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_aliases_master_product_id_fkey";
            columns: ["master_product_id"];
            isOneToOne: false;
            referencedRelation: "master_products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_embeddings: {
        Row: {
          content: string;
          created_at: string;
          created_by: string | null;
          distributor_product_id: string | null;
          embedding: string;
          id: string;
          master_product_id: string | null;
          model: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          content: string;
          created_at?: string;
          created_by?: string | null;
          distributor_product_id?: string | null;
          embedding: string;
          id?: string;
          master_product_id?: string | null;
          model: string;
          updated_at?: string;
        };
        Update: {
          content?: string;
          created_at?: string;
          created_by?: string | null;
          distributor_product_id?: string | null;
          embedding?: string;
          id?: string;
          master_product_id?: string | null;
          model?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_embeddings_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_embeddings_distributor_product_id_fkey";
            columns: ["distributor_product_id"];
            isOneToOne: false;
            referencedRelation: "distributor_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_embeddings_master_product_id_fkey";
            columns: ["master_product_id"];
            isOneToOne: false;
            referencedRelation: "master_products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_images: {
        Row: {
          alt: string | null;
          created_at: string;
          created_by: string | null;
          distributor_product_id: string | null;
          id: string;
          master_product_id: string | null;
          org_id: string | null;
          path: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          alt?: string | null;
          created_at?: string;
          created_by?: string | null;
          distributor_product_id?: string | null;
          id?: string;
          master_product_id?: string | null;
          org_id?: string | null;
          path: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          alt?: string | null;
          created_at?: string;
          created_by?: string | null;
          distributor_product_id?: string | null;
          id?: string;
          master_product_id?: string | null;
          org_id?: string | null;
          path?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_images_distributor_product_id_fkey";
            columns: ["distributor_product_id"];
            isOneToOne: false;
            referencedRelation: "distributor_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_images_master_product_id_fkey";
            columns: ["master_product_id"];
            isOneToOne: false;
            referencedRelation: "master_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_images_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      product_rating_stats: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          rating_count: number;
          rating_sum: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id: string;
          rating_count?: number;
          rating_sum?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          rating_count?: number;
          rating_sum?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_rating_stats_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      product_ratings: {
        Row: {
          created_at: string;
          created_by: string | null;
          customer_id: string | null;
          customer_order_id: string;
          customer_order_item_id: string;
          id: string;
          inventory_id: string | null;
          master_product_id: string | null;
          product_key: string;
          rating: number;
          shop_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          customer_order_id: string;
          customer_order_item_id: string;
          id?: string;
          inventory_id?: string | null;
          master_product_id?: string | null;
          product_key: string;
          rating: number;
          shop_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          customer_id?: string | null;
          customer_order_id?: string;
          customer_order_item_id?: string;
          id?: string;
          inventory_id?: string | null;
          master_product_id?: string | null;
          product_key?: string;
          rating?: number;
          shop_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_ratings_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_ratings_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_ratings_customer_order_id_fkey";
            columns: ["customer_order_id"];
            isOneToOne: false;
            referencedRelation: "customer_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_ratings_customer_order_item_id_fkey";
            columns: ["customer_order_item_id"];
            isOneToOne: true;
            referencedRelation: "customer_order_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_ratings_inventory_id_fkey";
            columns: ["inventory_id"];
            isOneToOne: false;
            referencedRelation: "shop_inventory";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_ratings_master_product_id_fkey";
            columns: ["master_product_id"];
            isOneToOne: false;
            referencedRelation: "master_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_ratings_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          active_org_id: string | null;
          active_role: Database["public"]["Enums"]["app_role"];
          active_shop_id: string | null;
          avatar_path: string | null;
          created_at: string;
          created_by: string | null;
          data_saver: boolean;
          deleted_at: string | null;
          full_name: string;
          id: string;
          last_seen_at: string | null;
          locale: Database["public"]["Enums"]["app_locale"];
          phone: string | null;
          theme: Database["public"]["Enums"]["theme_pref"];
          tts_enabled: boolean;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          active_org_id?: string | null;
          active_role?: Database["public"]["Enums"]["app_role"];
          active_shop_id?: string | null;
          avatar_path?: string | null;
          created_at?: string;
          created_by?: string | null;
          data_saver?: boolean;
          deleted_at?: string | null;
          full_name?: string;
          id: string;
          last_seen_at?: string | null;
          locale?: Database["public"]["Enums"]["app_locale"];
          phone?: string | null;
          theme?: Database["public"]["Enums"]["theme_pref"];
          tts_enabled?: boolean;
          updated_at?: string;
        };
        Update: {
          active_org_id?: string | null;
          active_role?: Database["public"]["Enums"]["app_role"];
          active_shop_id?: string | null;
          avatar_path?: string | null;
          created_at?: string;
          created_by?: string | null;
          data_saver?: boolean;
          deleted_at?: string | null;
          full_name?: string;
          id?: string;
          last_seen_at?: string | null;
          locale?: Database["public"]["Enums"]["app_locale"];
          phone?: string | null;
          theme?: Database["public"]["Enums"]["theme_pref"];
          tts_enabled?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_active_org_id_fkey";
            columns: ["active_org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_active_shop_id_fkey";
            columns: ["active_shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "profiles_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      proof_of_delivery: {
        Row: {
          captured_at: string;
          captured_by: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          lat: number | null;
          lng: number | null;
          location: unknown;
          order_id: string;
          org_id: string;
          otp_verified: boolean;
          photo_path: string | null;
          received_by_name: string | null;
          shop_id: string;
          trip_stop_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          captured_at?: string;
          captured_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          location?: never;
          order_id: string;
          org_id: string;
          otp_verified?: boolean;
          photo_path?: string | null;
          received_by_name?: string | null;
          shop_id: string;
          trip_stop_id?: string | null;
          updated_at?: string;
        };
        Update: {
          captured_at?: string;
          captured_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          lat?: number | null;
          lng?: number | null;
          location?: never;
          order_id?: string;
          org_id?: string;
          otp_verified?: boolean;
          photo_path?: string | null;
          received_by_name?: string | null;
          shop_id?: string;
          trip_stop_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "proof_of_delivery_captured_by_fkey";
            columns: ["captured_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "proof_of_delivery_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "proof_of_delivery_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "open_invoices";
            referencedColumns: ["order_id"];
          },
          {
            foreignKeyName: "proof_of_delivery_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "proof_of_delivery_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "proof_of_delivery_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "proof_of_delivery_trip_stop_id_fkey";
            columns: ["trip_stop_id"];
            isOneToOne: false;
            referencedRelation: "trip_stops";
            referencedColumns: ["id"];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          created_by: string | null;
          endpoint: string;
          id: string;
          is_active: boolean;
          last_used_at: string | null;
          p256dh: string;
          updated_at: string;
          user_agent: string | null;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          auth: string;
          created_at?: string;
          created_by?: string | null;
          endpoint: string;
          id?: string;
          is_active?: boolean;
          last_used_at?: string | null;
          p256dh: string;
          updated_at?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          created_by?: string | null;
          endpoint?: string;
          id?: string;
          is_active?: boolean;
          last_used_at?: string | null;
          p256dh?: string;
          updated_at?: string;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "push_subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      rate_limits: {
        Row: {
          count: number;
          created_at: string;
          created_by: string | null;
          id: string;
          key: string;
          updated_at: string;
          window_start: string;
        };
        ComputedFields: never;
        Insert: {
          count?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          key: string;
          updated_at?: string;
          window_start: string;
        };
        Update: {
          count?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          key?: string;
          updated_at?: string;
          window_start?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rate_limits_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      retailer_accounts: {
        Row: {
          assigned_booker_id: string | null;
          created_at: string;
          created_by: string | null;
          credit_limit_paisa: number;
          hold_override_until: string | null;
          hold_reason: string | null;
          id: string;
          last_order_at: string | null;
          notes: string | null;
          org_id: string;
          payment_terms_days: number;
          price_tier_id: string | null;
          segment: string | null;
          shop_id: string;
          status: Database["public"]["Enums"]["retailer_account_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          assigned_booker_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          credit_limit_paisa?: number;
          hold_override_until?: string | null;
          hold_reason?: string | null;
          id?: string;
          last_order_at?: string | null;
          notes?: string | null;
          org_id: string;
          payment_terms_days?: number;
          price_tier_id?: string | null;
          segment?: string | null;
          shop_id: string;
          status?: Database["public"]["Enums"]["retailer_account_status"];
          updated_at?: string;
        };
        Update: {
          assigned_booker_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          credit_limit_paisa?: number;
          hold_override_until?: string | null;
          hold_reason?: string | null;
          id?: string;
          last_order_at?: string | null;
          notes?: string | null;
          org_id?: string;
          payment_terms_days?: number;
          price_tier_id?: string | null;
          segment?: string | null;
          shop_id?: string;
          status?: Database["public"]["Enums"]["retailer_account_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "retailer_accounts_assigned_booker_id_fkey";
            columns: ["assigned_booker_id"];
            isOneToOne: false;
            referencedRelation: "org_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "retailer_accounts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "retailer_accounts_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "retailer_accounts_price_tier_id_fkey";
            columns: ["price_tier_id"];
            isOneToOne: false;
            referencedRelation: "price_tiers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "retailer_accounts_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      return_items: {
        Row: {
          amount_paisa: number;
          base_qty: number;
          created_at: string;
          created_by: string | null;
          distributor_product_id: string;
          id: string;
          order_item_id: string;
          org_id: string;
          photo_path: string | null;
          reason: Database["public"]["Enums"]["return_reason"];
          return_id: string;
          shop_id: string;
          unit_price_paisa: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount_paisa: number;
          base_qty: number;
          created_at?: string;
          created_by?: string | null;
          distributor_product_id: string;
          id?: string;
          order_item_id: string;
          org_id: string;
          photo_path?: string | null;
          reason: Database["public"]["Enums"]["return_reason"];
          return_id: string;
          shop_id: string;
          unit_price_paisa: number;
          updated_at?: string;
        };
        Update: {
          amount_paisa?: number;
          base_qty?: number;
          created_at?: string;
          created_by?: string | null;
          distributor_product_id?: string;
          id?: string;
          order_item_id?: string;
          org_id?: string;
          photo_path?: string | null;
          reason?: Database["public"]["Enums"]["return_reason"];
          return_id?: string;
          shop_id?: string;
          unit_price_paisa?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "return_items_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "return_items_distributor_product_id_fkey";
            columns: ["distributor_product_id"];
            isOneToOne: false;
            referencedRelation: "distributor_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "return_items_order_item_id_fkey";
            columns: ["order_item_id"];
            isOneToOne: false;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "return_items_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "return_items_return_id_fkey";
            columns: ["return_id"];
            isOneToOne: false;
            referencedRelation: "returns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "return_items_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      returns: {
        Row: {
          claim_total_paisa: number;
          created_at: string;
          created_by: string | null;
          credit_note_id: string | null;
          credited_at: string | null;
          id: string;
          notes: string | null;
          order_id: string;
          org_id: string;
          photo_paths: string[];
          reason: Database["public"]["Enums"]["return_reason"];
          received_at: string | null;
          requested_by: string | null;
          return_number: string;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          shop_id: string;
          status: Database["public"]["Enums"]["return_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          claim_total_paisa?: number;
          created_at?: string;
          created_by?: string | null;
          credit_note_id?: string | null;
          credited_at?: string | null;
          id?: string;
          notes?: string | null;
          order_id: string;
          org_id: string;
          photo_paths?: string[];
          reason: Database["public"]["Enums"]["return_reason"];
          received_at?: string | null;
          requested_by?: string | null;
          return_number: string;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          shop_id: string;
          status?: Database["public"]["Enums"]["return_status"];
          updated_at?: string;
        };
        Update: {
          claim_total_paisa?: number;
          created_at?: string;
          created_by?: string | null;
          credit_note_id?: string | null;
          credited_at?: string | null;
          id?: string;
          notes?: string | null;
          order_id?: string;
          org_id?: string;
          photo_paths?: string[];
          reason?: Database["public"]["Enums"]["return_reason"];
          received_at?: string | null;
          requested_by?: string | null;
          return_number?: string;
          review_note?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          shop_id?: string;
          status?: Database["public"]["Enums"]["return_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "returns_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "returns_credit_note_id_fkey";
            columns: ["credit_note_id"];
            isOneToOne: false;
            referencedRelation: "credit_notes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "returns_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "open_invoices";
            referencedColumns: ["order_id"];
          },
          {
            foreignKeyName: "returns_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "returns_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "returns_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "returns_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "returns_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      reviews: {
        Row: {
          comment: string | null;
          created_at: string;
          created_by: string | null;
          customer_order_id: string | null;
          id: string;
          is_published: boolean;
          order_id: string | null;
          org_id: string | null;
          rating: number;
          responded_at: string | null;
          responded_by: string | null;
          response: string | null;
          reviewer_id: string | null;
          reviewer_shop_id: string | null;
          shop_id: string | null;
          target_type: Database["public"]["Enums"]["review_target_type"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          comment?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_order_id?: string | null;
          id?: string;
          is_published?: boolean;
          order_id?: string | null;
          org_id?: string | null;
          rating: number;
          responded_at?: string | null;
          responded_by?: string | null;
          response?: string | null;
          reviewer_id?: string | null;
          reviewer_shop_id?: string | null;
          shop_id?: string | null;
          target_type: Database["public"]["Enums"]["review_target_type"];
          updated_at?: string;
        };
        Update: {
          comment?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_order_id?: string | null;
          id?: string;
          is_published?: boolean;
          order_id?: string | null;
          org_id?: string | null;
          rating?: number;
          responded_at?: string | null;
          responded_by?: string | null;
          response?: string | null;
          reviewer_id?: string | null;
          reviewer_shop_id?: string | null;
          shop_id?: string | null;
          target_type?: Database["public"]["Enums"]["review_target_type"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reviews_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_customer_order_id_fkey";
            columns: ["customer_order_id"];
            isOneToOne: true;
            referencedRelation: "customer_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "open_invoices";
            referencedColumns: ["order_id"];
          },
          {
            foreignKeyName: "reviews_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: true;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_responded_by_fkey";
            columns: ["responded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_reviewer_id_fkey";
            columns: ["reviewer_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_reviewer_shop_id_fkey";
            columns: ["reviewer_shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reviews_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      reward_points: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          note: string | null;
          points: number;
          reason: Database["public"]["Enums"]["reward_reason"];
          reference_id: string | null;
          reference_type: string | null;
          shop_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          note?: string | null;
          points: number;
          reason: Database["public"]["Enums"]["reward_reason"];
          reference_id?: string | null;
          reference_type?: string | null;
          shop_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          note?: string | null;
          points?: number;
          reason?: Database["public"]["Enums"]["reward_reason"];
          reference_id?: string | null;
          reference_type?: string | null;
          shop_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reward_points_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reward_points_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      rider_locations: {
        Row: {
          accuracy_m: number | null;
          created_at: string;
          created_by: string | null;
          heading: number | null;
          id: string;
          lat: number;
          lng: number;
          location: unknown;
          org_id: string;
          recorded_at: string;
          rider_id: string;
          speed_mps: number | null;
          trip_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          accuracy_m?: number | null;
          created_at?: string;
          created_by?: string | null;
          heading?: number | null;
          id?: string;
          lat: number;
          lng: number;
          location?: never;
          org_id: string;
          recorded_at?: string;
          rider_id: string;
          speed_mps?: number | null;
          trip_id?: string | null;
          updated_at?: string;
        };
        Update: {
          accuracy_m?: number | null;
          created_at?: string;
          created_by?: string | null;
          heading?: number | null;
          id?: string;
          lat?: number;
          lng?: number;
          location?: never;
          org_id?: string;
          recorded_at?: string;
          rider_id?: string;
          speed_mps?: number | null;
          trip_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rider_locations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rider_locations_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rider_locations_rider_id_fkey";
            columns: ["rider_id"];
            isOneToOne: true;
            referencedRelation: "riders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rider_locations_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      riders: {
        Row: {
          cnic_last4: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          member_id: string;
          org_id: string;
          updated_at: string;
          vehicle_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          cnic_last4?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          member_id: string;
          org_id: string;
          updated_at?: string;
          vehicle_id?: string | null;
        };
        Update: {
          cnic_last4?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          member_id?: string;
          org_id?: string;
          updated_at?: string;
          vehicle_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "riders_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "riders_member_id_fkey";
            columns: ["member_id"];
            isOneToOne: true;
            referencedRelation: "org_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "riders_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "riders_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
        ];
      };
      scheme_products: {
        Row: {
          created_at: string;
          created_by: string | null;
          distributor_product_id: string;
          id: string;
          org_id: string;
          role: Database["public"]["Enums"]["scheme_product_role"];
          scheme_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          distributor_product_id: string;
          id?: string;
          org_id: string;
          role?: Database["public"]["Enums"]["scheme_product_role"];
          scheme_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          distributor_product_id?: string;
          id?: string;
          org_id?: string;
          role?: Database["public"]["Enums"]["scheme_product_role"];
          scheme_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scheme_products_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scheme_products_distributor_product_id_fkey";
            columns: ["distributor_product_id"];
            isOneToOne: false;
            referencedRelation: "distributor_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scheme_products_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scheme_products_scheme_id_fkey";
            columns: ["scheme_id"];
            isOneToOne: false;
            referencedRelation: "schemes";
            referencedColumns: ["id"];
          },
        ];
      };
      schemes: {
        Row: {
          area_ids: string[] | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          ends_at: string | null;
          id: string;
          is_active: boolean;
          kind: Database["public"]["Enums"]["scheme_kind"];
          name: string;
          name_ur: string | null;
          org_id: string;
          priority: number;
          rules: NonNullable<Json>;
          segments: Database["public"]["Enums"]["shop_tier"][] | null;
          starts_at: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          area_ids?: string[] | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          ends_at?: string | null;
          id?: string;
          is_active?: boolean;
          kind: Database["public"]["Enums"]["scheme_kind"];
          name: string;
          name_ur?: string | null;
          org_id: string;
          priority?: number;
          rules: NonNullable<Json>;
          segments?: Database["public"]["Enums"]["shop_tier"][] | null;
          starts_at?: string;
          updated_at?: string;
        };
        Update: {
          area_ids?: string[] | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          ends_at?: string | null;
          id?: string;
          is_active?: boolean;
          kind?: Database["public"]["Enums"]["scheme_kind"];
          name?: string;
          name_ur?: string | null;
          org_id?: string;
          priority?: number;
          rules?: NonNullable<Json>;
          segments?: Database["public"]["Enums"]["shop_tier"][] | null;
          starts_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "schemes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "schemes_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      seed_registry: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          row_id: string;
          seq: number;
          table_name: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          row_id: string;
          seq?: never;
          table_name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          row_id?: string;
          seq?: never;
          table_name?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "seed_registry_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      service_areas: {
        Row: {
          boundary: unknown;
          center: unknown;
          center_lat: number | null;
          center_lng: number | null;
          city: string;
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          kind: Database["public"]["Enums"]["area_kind"];
          name: string;
          name_ur: string | null;
          parent_id: string | null;
          radius_m: number | null;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          boundary?: unknown;
          center?: never;
          center_lat?: number | null;
          center_lng?: number | null;
          city?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          kind?: Database["public"]["Enums"]["area_kind"];
          name: string;
          name_ur?: string | null;
          parent_id?: string | null;
          radius_m?: number | null;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          boundary?: unknown;
          center?: never;
          center_lat?: number | null;
          center_lng?: number | null;
          city?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          kind?: Database["public"]["Enums"]["area_kind"];
          name?: string;
          name_ur?: string | null;
          parent_id?: string | null;
          radius_m?: number | null;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_areas_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "service_areas_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "service_areas";
            referencedColumns: ["id"];
          },
        ];
      };
      shop_customers: {
        Row: {
          address_line: string | null;
          created_at: string;
          created_by: string | null;
          credit_limit_paisa: number | null;
          deleted_at: string | null;
          id: string;
          name: string;
          notes: string | null;
          phone: string | null;
          profile_id: string | null;
          search_text: string | null;
          shop_id: string;
          terms_days: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address_line?: string | null;
          created_at?: string;
          created_by?: string | null;
          credit_limit_paisa?: number | null;
          deleted_at?: string | null;
          id?: string;
          name: string;
          notes?: string | null;
          phone?: string | null;
          profile_id?: string | null;
          search_text?: never;
          shop_id: string;
          terms_days?: number;
          updated_at?: string;
        };
        Update: {
          address_line?: string | null;
          created_at?: string;
          created_by?: string | null;
          credit_limit_paisa?: number | null;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          profile_id?: string | null;
          search_text?: never;
          shop_id?: string;
          terms_days?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shop_customers_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shop_customers_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shop_customers_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      shop_inventory: {
        Row: {
          barcode: string | null;
          brand_id: string | null;
          category_id: string | null;
          cost_price_paisa: number;
          created_at: string;
          created_by: string | null;
          distributor_product_id: string | null;
          id: string;
          image_path: string | null;
          is_active: boolean;
          is_favourite: boolean;
          is_loose: boolean;
          is_visible_online: boolean;
          low_stock_threshold: number;
          master_product_id: string | null;
          mrp_paisa: number | null;
          name: string;
          name_ur: string | null;
          pack_size_label: string | null;
          qty_on_hand: number;
          search_text: string | null;
          selling_price_paisa: number;
          shop_id: string;
          sku: string | null;
          unit: Database["public"]["Enums"]["measure_unit"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          barcode?: string | null;
          brand_id?: string | null;
          category_id?: string | null;
          cost_price_paisa?: number;
          created_at?: string;
          created_by?: string | null;
          distributor_product_id?: string | null;
          id?: string;
          image_path?: string | null;
          is_active?: boolean;
          is_favourite?: boolean;
          is_loose?: boolean;
          is_visible_online?: boolean;
          low_stock_threshold?: number;
          master_product_id?: string | null;
          mrp_paisa?: number | null;
          name: string;
          name_ur?: string | null;
          pack_size_label?: string | null;
          qty_on_hand?: number;
          search_text?: never;
          selling_price_paisa: number;
          shop_id: string;
          sku?: string | null;
          unit?: Database["public"]["Enums"]["measure_unit"];
          updated_at?: string;
        };
        Update: {
          barcode?: string | null;
          brand_id?: string | null;
          category_id?: string | null;
          cost_price_paisa?: number;
          created_at?: string;
          created_by?: string | null;
          distributor_product_id?: string | null;
          id?: string;
          image_path?: string | null;
          is_active?: boolean;
          is_favourite?: boolean;
          is_loose?: boolean;
          is_visible_online?: boolean;
          low_stock_threshold?: number;
          master_product_id?: string | null;
          mrp_paisa?: number | null;
          name?: string;
          name_ur?: string | null;
          pack_size_label?: string | null;
          qty_on_hand?: number;
          search_text?: never;
          selling_price_paisa?: number;
          shop_id?: string;
          sku?: string | null;
          unit?: Database["public"]["Enums"]["measure_unit"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shop_inventory_brand_id_fkey";
            columns: ["brand_id"];
            isOneToOne: false;
            referencedRelation: "brands";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shop_inventory_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shop_inventory_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shop_inventory_distributor_product_id_fkey";
            columns: ["distributor_product_id"];
            isOneToOne: false;
            referencedRelation: "distributor_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shop_inventory_master_product_id_fkey";
            columns: ["master_product_id"];
            isOneToOne: false;
            referencedRelation: "master_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shop_inventory_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      shop_staff: {
        Row: {
          created_at: string;
          created_by: string | null;
          display_name: string | null;
          id: string;
          invited_by: string | null;
          joined_at: string | null;
          permissions: string[];
          phone: string | null;
          role: Database["public"]["Enums"]["shop_member_role"];
          shop_id: string;
          status: Database["public"]["Enums"]["member_status"];
          updated_at: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          display_name?: string | null;
          id?: string;
          invited_by?: string | null;
          joined_at?: string | null;
          permissions?: string[];
          phone?: string | null;
          role: Database["public"]["Enums"]["shop_member_role"];
          shop_id: string;
          status?: Database["public"]["Enums"]["member_status"];
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          display_name?: string | null;
          id?: string;
          invited_by?: string | null;
          joined_at?: string | null;
          permissions?: string[];
          phone?: string | null;
          role?: Database["public"]["Enums"]["shop_member_role"];
          shop_id?: string;
          status?: Database["public"]["Enums"]["member_status"];
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "shop_staff_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shop_staff_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shop_staff_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shop_staff_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      shop_stock_batches: {
        Row: {
          batch_no: string | null;
          created_at: string;
          created_by: string | null;
          expiry_date: string | null;
          id: string;
          inventory_id: string;
          qty: number;
          received_at: string;
          shop_id: string;
          source_order_id: string | null;
          unit_cost_paisa: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          batch_no?: string | null;
          created_at?: string;
          created_by?: string | null;
          expiry_date?: string | null;
          id?: string;
          inventory_id: string;
          qty?: number;
          received_at?: string;
          shop_id: string;
          source_order_id?: string | null;
          unit_cost_paisa?: number;
          updated_at?: string;
        };
        Update: {
          batch_no?: string | null;
          created_at?: string;
          created_by?: string | null;
          expiry_date?: string | null;
          id?: string;
          inventory_id?: string;
          qty?: number;
          received_at?: string;
          shop_id?: string;
          source_order_id?: string | null;
          unit_cost_paisa?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shop_stock_batches_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shop_stock_batches_inventory_id_fkey";
            columns: ["inventory_id"];
            isOneToOne: false;
            referencedRelation: "shop_inventory";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shop_stock_batches_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shop_stock_batches_source_order_id_fkey";
            columns: ["source_order_id"];
            isOneToOne: false;
            referencedRelation: "open_invoices";
            referencedColumns: ["order_id"];
          },
          {
            foreignKeyName: "shop_stock_batches_source_order_id_fkey";
            columns: ["source_order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      shop_stock_movements: {
        Row: {
          balance_after: number;
          batch_id: string | null;
          client_id: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          inventory_id: string;
          movement_type: Database["public"]["Enums"]["shop_stock_movement_type"];
          qty: number;
          reason: string | null;
          reference_id: string | null;
          reference_type: string | null;
          shop_id: string;
          unit_cost_paisa: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          balance_after: number;
          batch_id?: string | null;
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          inventory_id: string;
          movement_type: Database["public"]["Enums"]["shop_stock_movement_type"];
          qty: number;
          reason?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          shop_id: string;
          unit_cost_paisa?: number;
          updated_at?: string;
        };
        Update: {
          balance_after?: number;
          batch_id?: string | null;
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          inventory_id?: string;
          movement_type?: Database["public"]["Enums"]["shop_stock_movement_type"];
          qty?: number;
          reason?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          shop_id?: string;
          unit_cost_paisa?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shop_stock_movements_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "shop_stock_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shop_stock_movements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shop_stock_movements_inventory_id_fkey";
            columns: ["inventory_id"];
            isOneToOne: false;
            referencedRelation: "shop_inventory";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shop_stock_movements_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      shops: {
        Row: {
          address_line: string | null;
          approved_at: string | null;
          approved_by: string | null;
          area_id: string | null;
          cover_path: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          kind: Database["public"]["Enums"]["shop_kind"];
          lat: number | null;
          lng: number | null;
          location: unknown;
          name: string;
          ntn: string | null;
          onboarded_by_member_id: string | null;
          onboarded_by_org_id: string | null;
          owner_id: string | null;
          phone: string | null;
          photo_path: string | null;
          rejection_reason: string | null;
          slug: string;
          status: Database["public"]["Enums"]["approval_status"];
          strn: string | null;
          submitted_at: string | null;
          tier: Database["public"]["Enums"]["shop_tier"];
          updated_at: string;
          whatsapp: string | null;
        };
        ComputedFields: never;
        Insert: {
          address_line?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          area_id?: string | null;
          cover_path?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["shop_kind"];
          lat?: number | null;
          lng?: number | null;
          location?: never;
          name: string;
          ntn?: string | null;
          onboarded_by_member_id?: string | null;
          onboarded_by_org_id?: string | null;
          owner_id?: string | null;
          phone?: string | null;
          photo_path?: string | null;
          rejection_reason?: string | null;
          slug: string;
          status?: Database["public"]["Enums"]["approval_status"];
          strn?: string | null;
          submitted_at?: string | null;
          tier?: Database["public"]["Enums"]["shop_tier"];
          updated_at?: string;
          whatsapp?: string | null;
        };
        Update: {
          address_line?: string | null;
          approved_at?: string | null;
          approved_by?: string | null;
          area_id?: string | null;
          cover_path?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["shop_kind"];
          lat?: number | null;
          lng?: number | null;
          location?: never;
          name?: string;
          ntn?: string | null;
          onboarded_by_member_id?: string | null;
          onboarded_by_org_id?: string | null;
          owner_id?: string | null;
          phone?: string | null;
          photo_path?: string | null;
          rejection_reason?: string | null;
          slug?: string;
          status?: Database["public"]["Enums"]["approval_status"];
          strn?: string | null;
          submitted_at?: string | null;
          tier?: Database["public"]["Enums"]["shop_tier"];
          updated_at?: string;
          whatsapp?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "shops_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shops_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "service_areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shops_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shops_onboarded_by_member_id_fkey";
            columns: ["onboarded_by_member_id"];
            isOneToOne: false;
            referencedRelation: "org_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shops_onboarded_by_org_id_fkey";
            columns: ["onboarded_by_org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shops_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_batches: {
        Row: {
          batch_no: string | null;
          bin_location: string | null;
          created_at: string;
          created_by: string | null;
          distributor_product_id: string;
          expiry_date: string | null;
          id: string;
          org_id: string;
          qty_on_hand: number;
          qty_reserved: number;
          receipt_id: string | null;
          received_at: string;
          unit_cost_paisa: number;
          updated_at: string;
          warehouse_id: string;
        };
        ComputedFields: never;
        Insert: {
          batch_no?: string | null;
          bin_location?: string | null;
          created_at?: string;
          created_by?: string | null;
          distributor_product_id: string;
          expiry_date?: string | null;
          id?: string;
          org_id: string;
          qty_on_hand?: number;
          qty_reserved?: number;
          receipt_id?: string | null;
          received_at?: string;
          unit_cost_paisa?: number;
          updated_at?: string;
          warehouse_id: string;
        };
        Update: {
          batch_no?: string | null;
          bin_location?: string | null;
          created_at?: string;
          created_by?: string | null;
          distributor_product_id?: string;
          expiry_date?: string | null;
          id?: string;
          org_id?: string;
          qty_on_hand?: number;
          qty_reserved?: number;
          receipt_id?: string | null;
          received_at?: string;
          unit_cost_paisa?: number;
          updated_at?: string;
          warehouse_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_batches_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_batches_distributor_product_id_fkey";
            columns: ["distributor_product_id"];
            isOneToOne: false;
            referencedRelation: "distributor_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_batches_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_batches_receipt_id_fkey";
            columns: ["receipt_id"];
            isOneToOne: false;
            referencedRelation: "stock_receipts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_batches_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_movements: {
        Row: {
          batch_id: string;
          created_at: string;
          created_by: string | null;
          distributor_product_id: string;
          id: string;
          movement_type: Database["public"]["Enums"]["stock_movement_type"];
          org_id: string;
          quantity: number;
          reason: string | null;
          receipt_id: string | null;
          reference_id: string | null;
          reference_type: string | null;
          transfer_id: string | null;
          unit_cost_paisa: number;
          updated_at: string;
          warehouse_id: string;
        };
        ComputedFields: never;
        Insert: {
          batch_id: string;
          created_at?: string;
          created_by?: string | null;
          distributor_product_id: string;
          id?: string;
          movement_type: Database["public"]["Enums"]["stock_movement_type"];
          org_id: string;
          quantity: number;
          reason?: string | null;
          receipt_id?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          transfer_id?: string | null;
          unit_cost_paisa?: number;
          updated_at?: string;
          warehouse_id: string;
        };
        Update: {
          batch_id?: string;
          created_at?: string;
          created_by?: string | null;
          distributor_product_id?: string;
          id?: string;
          movement_type?: Database["public"]["Enums"]["stock_movement_type"];
          org_id?: string;
          quantity?: number;
          reason?: string | null;
          receipt_id?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          transfer_id?: string | null;
          unit_cost_paisa?: number;
          updated_at?: string;
          warehouse_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_batch_id_fkey";
            columns: ["batch_id"];
            isOneToOne: false;
            referencedRelation: "stock_batches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_distributor_product_id_fkey";
            columns: ["distributor_product_id"];
            isOneToOne: false;
            referencedRelation: "distributor_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_receipt_id_fkey";
            columns: ["receipt_id"];
            isOneToOne: false;
            referencedRelation: "stock_receipts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_transfer_id_fkey";
            columns: ["transfer_id"];
            isOneToOne: false;
            referencedRelation: "stock_transfers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_receipts: {
        Row: {
          client_id: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          notes: string | null;
          org_id: string;
          receipt_number: string;
          received_at: string;
          received_by: string | null;
          reference_no: string | null;
          supplier_id: string | null;
          total_cost_paisa: number;
          updated_at: string;
          warehouse_id: string;
        };
        ComputedFields: never;
        Insert: {
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          notes?: string | null;
          org_id: string;
          receipt_number: string;
          received_at?: string;
          received_by?: string | null;
          reference_no?: string | null;
          supplier_id?: string | null;
          total_cost_paisa?: number;
          updated_at?: string;
          warehouse_id: string;
        };
        Update: {
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          notes?: string | null;
          org_id?: string;
          receipt_number?: string;
          received_at?: string;
          received_by?: string | null;
          reference_no?: string | null;
          supplier_id?: string | null;
          total_cost_paisa?: number;
          updated_at?: string;
          warehouse_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_receipts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_receipts_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_receipts_received_by_fkey";
            columns: ["received_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_receipts_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_receipts_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_transfers: {
        Row: {
          created_at: string;
          created_by: string | null;
          from_warehouse_id: string;
          id: string;
          notes: string | null;
          org_id: string;
          received_at: string | null;
          shipped_at: string | null;
          status: Database["public"]["Enums"]["stock_transfer_status"];
          to_warehouse_id: string;
          transfer_number: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          from_warehouse_id: string;
          id?: string;
          notes?: string | null;
          org_id: string;
          received_at?: string | null;
          shipped_at?: string | null;
          status?: Database["public"]["Enums"]["stock_transfer_status"];
          to_warehouse_id: string;
          transfer_number: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          from_warehouse_id?: string;
          id?: string;
          notes?: string | null;
          org_id?: string;
          received_at?: string | null;
          shipped_at?: string | null;
          status?: Database["public"]["Enums"]["stock_transfer_status"];
          to_warehouse_id?: string;
          transfer_number?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_transfers_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_transfers_from_warehouse_id_fkey";
            columns: ["from_warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_transfers_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_transfers_to_warehouse_id_fkey";
            columns: ["to_warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
        ];
      };
      storefront_settings: {
        Row: {
          about: string | null;
          accept_orders_when_closed: boolean;
          announcement: string | null;
          created_at: string;
          created_by: string | null;
          delivery_fee_paisa: number;
          delivery_radius_m: number;
          eta_minutes: number;
          free_delivery_above_paisa: number | null;
          gallery_paths: string[];
          id: string;
          is_live: boolean;
          min_order_paisa: number;
          payment_options: Database["public"]["Enums"]["customer_payment_method"][];
          pickup_enabled: boolean;
          serves_all_city: boolean;
          shop_id: string;
          tagline: string | null;
          timings: NonNullable<Json>;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          about?: string | null;
          accept_orders_when_closed?: boolean;
          announcement?: string | null;
          created_at?: string;
          created_by?: string | null;
          delivery_fee_paisa?: number;
          delivery_radius_m?: number;
          eta_minutes?: number;
          free_delivery_above_paisa?: number | null;
          gallery_paths?: string[];
          id?: string;
          is_live?: boolean;
          min_order_paisa?: number;
          payment_options?: Database["public"]["Enums"]["customer_payment_method"][];
          pickup_enabled?: boolean;
          serves_all_city?: boolean;
          shop_id: string;
          tagline?: string | null;
          timings?: NonNullable<Json>;
          updated_at?: string;
        };
        Update: {
          about?: string | null;
          accept_orders_when_closed?: boolean;
          announcement?: string | null;
          created_at?: string;
          created_by?: string | null;
          delivery_fee_paisa?: number;
          delivery_radius_m?: number;
          eta_minutes?: number;
          free_delivery_above_paisa?: number | null;
          gallery_paths?: string[];
          id?: string;
          is_live?: boolean;
          min_order_paisa?: number;
          payment_options?: Database["public"]["Enums"]["customer_payment_method"][];
          pickup_enabled?: boolean;
          serves_all_city?: boolean;
          shop_id?: string;
          tagline?: string | null;
          timings?: NonNullable<Json>;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "storefront_settings_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "storefront_settings_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: true;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_invoices: {
        Row: {
          amount_paisa: number;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          due_date: string;
          id: string;
          invoice_number: string;
          issued_at: string;
          org_id: string;
          paid_at: string | null;
          payment_reference: string | null;
          pdf_path: string | null;
          period_end: string;
          period_start: string;
          plan_id: string;
          status: Database["public"]["Enums"]["invoice_status"];
          subscription_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount_paisa: number;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          due_date: string;
          id?: string;
          invoice_number: string;
          issued_at?: string;
          org_id: string;
          paid_at?: string | null;
          payment_reference?: string | null;
          pdf_path?: string | null;
          period_end: string;
          period_start: string;
          plan_id: string;
          status?: Database["public"]["Enums"]["invoice_status"];
          subscription_id: string;
          updated_at?: string;
        };
        Update: {
          amount_paisa?: number;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          due_date?: string;
          id?: string;
          invoice_number?: string;
          issued_at?: string;
          org_id?: string;
          paid_at?: string | null;
          payment_reference?: string | null;
          pdf_path?: string | null;
          period_end?: string;
          period_start?: string;
          plan_id?: string;
          status?: Database["public"]["Enums"]["invoice_status"];
          subscription_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_invoices_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_invoices_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_invoices_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscription_invoices_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean;
          cancelled_at: string | null;
          created_at: string;
          created_by: string | null;
          current_period_end: string;
          current_period_start: string;
          deleted_at: string | null;
          id: string;
          org_id: string;
          plan_id: string;
          price_paisa: number;
          status: Database["public"]["Enums"]["subscription_status"];
          trial_ends_at: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          cancel_at_period_end?: boolean;
          cancelled_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          current_period_end: string;
          current_period_start?: string;
          deleted_at?: string | null;
          id?: string;
          org_id: string;
          plan_id: string;
          price_paisa: number;
          status?: Database["public"]["Enums"]["subscription_status"];
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Update: {
          cancel_at_period_end?: boolean;
          cancelled_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          current_period_end?: string;
          current_period_start?: string;
          deleted_at?: string | null;
          id?: string;
          org_id?: string;
          plan_id?: string;
          price_paisa?: number;
          status?: Database["public"]["Enums"]["subscription_status"];
          trial_ends_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "plans";
            referencedColumns: ["id"];
          },
        ];
      };
      suppliers: {
        Row: {
          address_line: string | null;
          contact_name: string | null;
          created_at: string;
          created_by: string | null;
          email: string | null;
          id: string;
          is_active: boolean;
          name: string;
          notes: string | null;
          ntn: string | null;
          org_id: string;
          phone: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address_line?: string | null;
          contact_name?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          notes?: string | null;
          ntn?: string | null;
          org_id: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          address_line?: string | null;
          contact_name?: string | null;
          created_at?: string;
          created_by?: string | null;
          email?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          notes?: string | null;
          ntn?: string | null;
          org_id?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "suppliers_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "suppliers_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      support_messages: {
        Row: {
          attachments: string[];
          author_id: string | null;
          body: string;
          created_at: string;
          created_by: string | null;
          id: string;
          is_internal: boolean;
          ticket_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          attachments?: string[];
          author_id?: string | null;
          body: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_internal?: boolean;
          ticket_id: string;
          updated_at?: string;
        };
        Update: {
          attachments?: string[];
          author_id?: string | null;
          body?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_internal?: boolean;
          ticket_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "support_messages_author_id_fkey";
            columns: ["author_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "support_messages_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "support_messages_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "support_tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      support_tickets: {
        Row: {
          assigned_to: string | null;
          closed_at: string | null;
          created_at: string;
          created_by: string | null;
          customer_order_id: string | null;
          id: string;
          kind: Database["public"]["Enums"]["ticket_kind"];
          opened_by: string | null;
          order_id: string | null;
          org_id: string | null;
          priority: Database["public"]["Enums"]["ticket_priority"];
          resolved_at: string | null;
          shop_id: string | null;
          status: Database["public"]["Enums"]["ticket_status"];
          subject: string;
          ticket_number: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          assigned_to?: string | null;
          closed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_order_id?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["ticket_kind"];
          opened_by?: string | null;
          order_id?: string | null;
          org_id?: string | null;
          priority?: Database["public"]["Enums"]["ticket_priority"];
          resolved_at?: string | null;
          shop_id?: string | null;
          status?: Database["public"]["Enums"]["ticket_status"];
          subject: string;
          ticket_number?: string;
          updated_at?: string;
        };
        Update: {
          assigned_to?: string | null;
          closed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_order_id?: string | null;
          id?: string;
          kind?: Database["public"]["Enums"]["ticket_kind"];
          opened_by?: string | null;
          order_id?: string | null;
          org_id?: string | null;
          priority?: Database["public"]["Enums"]["ticket_priority"];
          resolved_at?: string | null;
          shop_id?: string | null;
          status?: Database["public"]["Enums"]["ticket_status"];
          subject?: string;
          ticket_number?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "support_tickets_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "support_tickets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "support_tickets_customer_order_id_fkey";
            columns: ["customer_order_id"];
            isOneToOne: false;
            referencedRelation: "customer_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "support_tickets_opened_by_fkey";
            columns: ["opened_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "support_tickets_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "open_invoices";
            referencedColumns: ["order_id"];
          },
          {
            foreignKeyName: "support_tickets_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "support_tickets_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "support_tickets_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      trip_stops: {
        Row: {
          arrived_at: string | null;
          cash_collected_paisa: number;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          eta: string | null;
          failure_reason: string | null;
          id: string;
          notes: string | null;
          order_id: string;
          org_id: string;
          sequence: number;
          shop_id: string;
          status: Database["public"]["Enums"]["trip_stop_status"];
          trip_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          arrived_at?: string | null;
          cash_collected_paisa?: number;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          eta?: string | null;
          failure_reason?: string | null;
          id?: string;
          notes?: string | null;
          order_id: string;
          org_id: string;
          sequence: number;
          shop_id: string;
          status?: Database["public"]["Enums"]["trip_stop_status"];
          trip_id: string;
          updated_at?: string;
        };
        Update: {
          arrived_at?: string | null;
          cash_collected_paisa?: number;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          eta?: string | null;
          failure_reason?: string | null;
          id?: string;
          notes?: string | null;
          order_id?: string;
          org_id?: string;
          sequence?: number;
          shop_id?: string;
          status?: Database["public"]["Enums"]["trip_stop_status"];
          trip_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "trip_stops_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_stops_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "open_invoices";
            referencedColumns: ["order_id"];
          },
          {
            foreignKeyName: "trip_stops_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_stops_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_stops_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trip_stops_trip_id_fkey";
            columns: ["trip_id"];
            isOneToOne: false;
            referencedRelation: "trips";
            referencedColumns: ["id"];
          },
        ];
      };
      trips: {
        Row: {
          cash_collected_paisa: number;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          notes: string | null;
          org_id: string;
          rider_id: string;
          started_at: string | null;
          status: Database["public"]["Enums"]["trip_status"];
          trip_date: string;
          trip_number: string;
          updated_at: string;
          vehicle_id: string | null;
          warehouse_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          cash_collected_paisa?: number;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          org_id: string;
          rider_id: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["trip_status"];
          trip_date?: string;
          trip_number: string;
          updated_at?: string;
          vehicle_id?: string | null;
          warehouse_id?: string | null;
        };
        Update: {
          cash_collected_paisa?: number;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          notes?: string | null;
          org_id?: string;
          rider_id?: string;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["trip_status"];
          trip_date?: string;
          trip_number?: string;
          updated_at?: string;
          vehicle_id?: string | null;
          warehouse_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "trips_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trips_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trips_rider_id_fkey";
            columns: ["rider_id"];
            isOneToOne: false;
            referencedRelation: "riders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trips_vehicle_id_fkey";
            columns: ["vehicle_id"];
            isOneToOne: false;
            referencedRelation: "vehicles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "trips_warehouse_id_fkey";
            columns: ["warehouse_id"];
            isOneToOne: false;
            referencedRelation: "warehouses";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          created_by: string | null;
          granted_by: string | null;
          id: string;
          role: Database["public"]["Enums"]["platform_role"];
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          granted_by?: string | null;
          id?: string;
          role: Database["public"]["Enums"]["platform_role"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          granted_by?: string | null;
          id?: string;
          role?: Database["public"]["Enums"]["platform_role"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_roles_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_roles_granted_by_fkey";
            columns: ["granted_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_roles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      vehicles: {
        Row: {
          capacity_kg: number | null;
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          kind: Database["public"]["Enums"]["vehicle_kind"];
          notes: string | null;
          org_id: string;
          registration_no: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          capacity_kg?: number | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          kind: Database["public"]["Enums"]["vehicle_kind"];
          notes?: string | null;
          org_id: string;
          registration_no: string;
          updated_at?: string;
        };
        Update: {
          capacity_kg?: number | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          kind?: Database["public"]["Enums"]["vehicle_kind"];
          notes?: string | null;
          org_id?: string;
          registration_no?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "vehicles_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "vehicles_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      visits: {
        Row: {
          beat_id: string | null;
          booker_id: string;
          check_in_lat: number | null;
          check_in_lng: number | null;
          check_in_location: unknown;
          checked_in_at: string;
          checked_out_at: string | null;
          client_id: string | null;
          created_at: string;
          created_by: string | null;
          distance_m: number | null;
          id: string;
          notes: string | null;
          order_id: string | null;
          org_id: string;
          outcome: Database["public"]["Enums"]["visit_outcome"] | null;
          shop_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          beat_id?: string | null;
          booker_id: string;
          check_in_lat?: number | null;
          check_in_lng?: number | null;
          check_in_location?: never;
          checked_in_at?: string;
          checked_out_at?: string | null;
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          distance_m?: number | null;
          id?: string;
          notes?: string | null;
          order_id?: string | null;
          org_id: string;
          outcome?: Database["public"]["Enums"]["visit_outcome"] | null;
          shop_id: string;
          updated_at?: string;
        };
        Update: {
          beat_id?: string | null;
          booker_id?: string;
          check_in_lat?: number | null;
          check_in_lng?: number | null;
          check_in_location?: never;
          checked_in_at?: string;
          checked_out_at?: string | null;
          client_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          distance_m?: number | null;
          id?: string;
          notes?: string | null;
          order_id?: string | null;
          org_id?: string;
          outcome?: Database["public"]["Enums"]["visit_outcome"] | null;
          shop_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "visits_beat_id_fkey";
            columns: ["beat_id"];
            isOneToOne: false;
            referencedRelation: "beats";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visits_booker_id_fkey";
            columns: ["booker_id"];
            isOneToOne: false;
            referencedRelation: "org_members";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visits_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visits_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "open_invoices";
            referencedColumns: ["order_id"];
          },
          {
            foreignKeyName: "visits_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visits_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "visits_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      warehouses: {
        Row: {
          address_line: string | null;
          area_id: string | null;
          code: string;
          created_at: string;
          created_by: string | null;
          id: string;
          is_active: boolean;
          is_default: boolean;
          lat: number | null;
          lng: number | null;
          location: unknown;
          name: string;
          org_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address_line?: string | null;
          area_id?: string | null;
          code: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          lat?: number | null;
          lng?: number | null;
          location?: never;
          name: string;
          org_id: string;
          updated_at?: string;
        };
        Update: {
          address_line?: string | null;
          area_id?: string | null;
          code?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          lat?: number | null;
          lng?: number | null;
          location?: never;
          name?: string;
          org_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "warehouses_area_id_fkey";
            columns: ["area_id"];
            isOneToOne: false;
            referencedRelation: "service_areas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouses_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouses_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      webhook_deliveries: {
        Row: {
          attempts: number;
          created_at: string;
          created_by: string | null;
          delivered_at: string | null;
          endpoint_id: string;
          event: string;
          id: string;
          next_attempt_at: string | null;
          org_id: string;
          payload: NonNullable<Json>;
          response_body: string | null;
          response_status: number | null;
          status: Database["public"]["Enums"]["webhook_delivery_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          created_at?: string;
          created_by?: string | null;
          delivered_at?: string | null;
          endpoint_id: string;
          event: string;
          id?: string;
          next_attempt_at?: string | null;
          org_id: string;
          payload: NonNullable<Json>;
          response_body?: string | null;
          response_status?: number | null;
          status?: Database["public"]["Enums"]["webhook_delivery_status"];
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          created_at?: string;
          created_by?: string | null;
          delivered_at?: string | null;
          endpoint_id?: string;
          event?: string;
          id?: string;
          next_attempt_at?: string | null;
          org_id?: string;
          payload?: NonNullable<Json>;
          response_body?: string | null;
          response_status?: number | null;
          status?: Database["public"]["Enums"]["webhook_delivery_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "webhook_deliveries_endpoint_id_fkey";
            columns: ["endpoint_id"];
            isOneToOne: false;
            referencedRelation: "webhook_endpoints";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "webhook_deliveries_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      webhook_endpoints: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          events: string[];
          failure_count: number;
          id: string;
          is_active: boolean;
          last_delivery_at: string | null;
          org_id: string;
          secret: string;
          updated_at: string;
          url: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          events: string[];
          failure_count?: number;
          id?: string;
          is_active?: boolean;
          last_delivery_at?: string | null;
          org_id: string;
          secret: string;
          updated_at?: string;
          url: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          events?: string[];
          failure_count?: number;
          id?: string;
          is_active?: boolean;
          last_delivery_at?: string | null;
          org_id?: string;
          secret?: string;
          updated_at?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "webhook_endpoints_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      ledger_account_balances: {
        Row: {
          account_id: string;
          balance_paisa: number | null;
          book_id: string | null;
          book_type: Database["public"]["Enums"]["ledger_book_type"];
          code: Database["public"]["Enums"]["ledger_account_code"];
          counterparty_customer_id: string | null;
          counterparty_shop_id: string | null;
          counterparty_type: Database["public"]["Enums"]["counterparty_type"] | null;
          credit_paisa: number | null;
          debit_paisa: number | null;
          last_entry_date: string | null;
          name: string;
          org_id: string | null;
          shop_id: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "ledger_accounts_counterparty_customer_id_fkey";
            columns: ["counterparty_customer_id"];
            isOneToOne: false;
            referencedRelation: "shop_customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_accounts_counterparty_shop_id_fkey";
            columns: ["counterparty_shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_accounts_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ledger_accounts_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
      open_invoices: {
        Row: {
          days_overdue: number | null;
          delivered_at: string | null;
          due_date: string | null;
          invoice_number: string | null;
          order_id: string;
          order_number: string;
          org_id: string;
          outstanding_paisa: number | null;
          paid_paisa: number;
          shop_id: string;
          total_paisa: number;
        };
        ComputedFields: never;
        Insert: {
          days_overdue?: never;
          delivered_at?: string | null;
          due_date?: string | null;
          invoice_number?: string | null;
          order_id?: string | null;
          order_number?: string | null;
          org_id?: string | null;
          outstanding_paisa?: never;
          paid_paisa?: number | null;
          shop_id?: string | null;
          total_paisa?: number | null;
        };
        Update: {
          days_overdue?: never;
          delivered_at?: string | null;
          due_date?: string | null;
          invoice_number?: string | null;
          order_id?: string | null;
          order_number?: string | null;
          org_id?: string | null;
          outstanding_paisa?: never;
          paid_paisa?: number | null;
          shop_id?: string | null;
          total_paisa?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "orders_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_shop_id_fkey";
            columns: ["shop_id"];
            isOneToOne: false;
            referencedRelation: "shops";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      add_shop_products: { Args: { p_items: Json; p_shop_id: string }; Returns: Json };
      admin_approvals: { Args: Record<PropertyKey, never>; Returns: Json };
      admin_audit: { Args: { p_before?: string; p_limit?: number }; Returns: Json };
      admin_flags: { Args: Record<PropertyKey, never>; Returns: Json };
      admin_orders: {
        Args: { p_kind?: string; p_limit?: number; p_query?: string; p_status?: string };
        Returns: Json;
      };
      admin_organizations: {
        Args: { p_limit?: number; p_query?: string; p_status?: string };
        Returns: Json;
      };
      admin_overview: { Args: { p_range?: string }; Returns: Json };
      admin_set_flag: { Args: { p_enabled: boolean; p_key: string }; Returns: Json };
      admin_set_org_status: {
        Args: { p_org_id: string; p_reason?: string; p_status: string };
        Returns: Json;
      };
      admin_set_shop_delivery: {
        Args: { p_all_city: boolean; p_radius_m: number; p_shop_id: string };
        Returns: Json;
      };
      admin_set_shop_status: {
        Args: { p_reason?: string; p_shop_id: string; p_status: string };
        Returns: Json;
      };
      admin_shops: {
        Args: { p_limit?: number; p_query?: string; p_status?: string };
        Returns: Json;
      };
      admin_users: { Args: { p_limit?: number; p_query?: string }; Returns: Json };
      approve_organization: {
        Args: { p_org_id: string };
        Returns: {
          address_line: string | null;
          approved_at: string | null;
          approved_by: string | null;
          area_id: string | null;
          cover_path: string | null;
          created_at: string;
          created_by: string | null;
          delivery_fee_paisa: number;
          description: string | null;
          email: string | null;
          free_delivery_above_paisa: number | null;
          id: string;
          lat: number | null;
          legal_name: string | null;
          lng: number | null;
          location: unknown;
          logo_path: string | null;
          min_order_paisa: number;
          name: string;
          ntn: string | null;
          phone: string | null;
          rejection_reason: string | null;
          served_area_ids: string[] | null;
          settings: NonNullable<Json>;
          slug: string;
          status: Database["public"]["Enums"]["approval_status"];
          strn: string | null;
          submitted_at: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "organizations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      approve_shop: {
        Args: { p_shop_id: string };
        Returns: {
          address_line: string | null;
          approved_at: string | null;
          approved_by: string | null;
          area_id: string | null;
          cover_path: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          kind: Database["public"]["Enums"]["shop_kind"];
          lat: number | null;
          lng: number | null;
          location: unknown;
          name: string;
          ntn: string | null;
          onboarded_by_member_id: string | null;
          onboarded_by_org_id: string | null;
          owner_id: string | null;
          phone: string | null;
          photo_path: string | null;
          rejection_reason: string | null;
          slug: string;
          status: Database["public"]["Enums"]["approval_status"];
          strn: string | null;
          submitted_at: string | null;
          tier: Database["public"]["Enums"]["shop_tier"];
          updated_at: string;
          whatsapp: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "shops";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      browse_catalog: {
        Args: {
          p_brand_id?: string;
          p_category_id?: string;
          p_filters?: Json;
          p_limit?: number;
          p_offset?: number;
          p_org_id?: string;
          p_shop_id: string;
          p_sort?: string;
        };
        Returns: Database["public"]["CompositeTypes"]["catalog_item"][];
        SetofOptions: {
          from: "*";
          to: "catalog_item";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      cancel_order: {
        Args: { p_order_id: string; p_reason: string };
        Returns: {
          booker_id: string | null;
          cancel_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          client_request_id: string | null;
          confirmation_reasons: string[];
          confirmed_at: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          delivered_at: string | null;
          delivery_address: Json | null;
          delivery_fee_paisa: number;
          delivery_slot_end: string | null;
          delivery_slot_start: string | null;
          discount_paisa: number;
          dispatched_at: string | null;
          due_date: string | null;
          id: string;
          invoice_number: string | null;
          invoice_path: string | null;
          invoiced_at: string | null;
          needs_confirmation: boolean;
          notes: string | null;
          order_number: string;
          ordered_total_paisa: number;
          org_id: string;
          packed_at: string | null;
          paid_paisa: number;
          payment_method: Database["public"]["Enums"]["order_payment_method"];
          payment_status: Database["public"]["Enums"]["order_payment_status"];
          phone_confirmed_at: string | null;
          phone_confirmed_by: string | null;
          picking_at: string | null;
          placed_by: string | null;
          placed_by_name: string | null;
          rating: number | null;
          received_at: string | null;
          received_by: string | null;
          returned_at: string | null;
          scheme_discount_paisa: number;
          shop_confirm_requested_at: string | null;
          shop_confirmed_at: string | null;
          shop_confirmed_by: string | null;
          shop_id: string;
          source: Database["public"]["Enums"]["order_source"];
          status: Database["public"]["Enums"]["order_status"];
          subtotal_paisa: number;
          total_paisa: number;
          trip_id: string | null;
          updated_at: string;
          warehouse_id: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "orders";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      cart_summary: { Args: { p_shop_id: string }; Returns: Json };
      catalog_facets: { Args: { p_category_id?: string; p_shop_id: string }; Returns: Json };
      chat_unread_count: { Args: { p_org_id?: string; p_shop_id?: string }; Returns: number };
      check_rate_limit: {
        Args: { p_key: string; p_max: number; p_window_s: number };
        Returns: boolean;
      };
      claim_push_messages: {
        Args: { p_limit?: number };
        Returns: {
          attempts: number;
          body: string | null;
          channel: Database["public"]["Enums"]["message_channel"];
          created_at: string;
          created_by: string | null;
          dedupe_key: string | null;
          error: string | null;
          id: string;
          kind: Database["public"]["Enums"]["message_kind"];
          org_id: string | null;
          payload: NonNullable<Json>;
          provider: string | null;
          provider_message_id: string | null;
          scheduled_at: string;
          sent_at: string | null;
          shop_id: string | null;
          status: Database["public"]["Enums"]["message_status"];
          template: string | null;
          to_phone: string | null;
          to_user_id: string | null;
          updated_at: string;
        }[];
        SetofOptions: {
          from: "*";
          to: "message_outbox";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      clear_cart: { Args: { p_org_id?: string; p_shop_id: string }; Returns: undefined };
      confirm_delivery: {
        Args: {
          p_cash_collected_paisa?: number;
          p_lines?: Json;
          p_order_id: string;
          p_otp: string;
        };
        Returns: Json;
      };
      confirm_order_as_shop: { Args: { p_order_id: string }; Returns: Json };
      conversation_detail: {
        Args: {
          p_as?: Database["public"]["Enums"]["chat_side"];
          p_before?: string;
          p_conversation_id: string;
          p_limit?: number;
        };
        Returns: Json;
      };
      delivery_slots: {
        Args: { p_days?: number; p_org_id: string; p_shop_id: string };
        Returns: {
          slot_end: string;
          slot_start: string;
        }[];
      };
      delivery_zones: { Args: Record<PropertyKey, never>; Returns: Json };
      mark_conversation_read: { Args: { p_conversation_id: string }; Returns: undefined };
      my_account_deletion: { Args: Record<PropertyKey, never>; Returns: Json };
      my_buy_again: { Args: { p_lat?: number; p_limit?: number; p_lng?: number }; Returns: Json };
      my_conversations: {
        Args: { p_org_id?: string; p_shop_id?: string; p_support_queue?: boolean };
        Returns: Json;
      };
      my_role_contexts: {
        Args: Record<PropertyKey, never>;
        Returns: {
          context_id: string;
          context_name: string;
          image_path: string;
          member_role: string;
          role: Database["public"]["Enums"]["app_role"];
          status: string;
        }[];
      };
      nearby_dukans: { Args: { p_lat?: number; p_limit?: number; p_lng?: number }; Returns: Json };
      next_counter: { Args: { p_scope: string }; Returns: number };
      open_conversation: {
        Args: {
          p_kind: Database["public"]["Enums"]["conversation_kind"];
          p_org_id?: string;
          p_shop_id?: string;
        };
        Returns: string;
      };
      order_delivery_code: { Args: { p_order_id: string }; Returns: string };
      org_catalog: {
        Args: {
          p_filter?: string;
          p_limit?: number;
          p_offset?: number;
          p_org_id: string;
          p_query?: string;
        };
        Returns: Json;
      };
      org_dashboard: { Args: { p_org_id: string }; Returns: Json };
      org_insights: { Args: { p_org_id: string }; Returns: Json };
      org_order_detail: { Args: { p_order_id: string }; Returns: Json };
      org_order_inbox: {
        Args: {
          p_limit?: number;
          p_offset?: number;
          p_org_id: string;
          p_query?: string;
          p_tab?: string;
        };
        Returns: Json;
      };
      org_starter_pack: { Args: { p_limit?: number; p_org_id: string }; Returns: Json };
      place_customer_order: {
        Args: {
          p_address_id: string;
          p_items: Json;
          p_note?: string;
          p_request_id?: string;
          p_shop_id: string;
        };
        Returns: Json;
      };
      place_order: {
        Args: {
          p_client_request_id: string;
          p_notes?: string;
          p_org_ids?: string[];
          p_payment_method: Database["public"]["Enums"]["order_payment_method"];
          p_shop_id: string;
          p_slots: Json;
        };
        Returns: Json;
      };
      product_detail: {
        Args: { p_distributor_product_id: string; p_shop_id: string };
        Returns: Json;
      };
      rate_customer_order: {
        Args: { p_comment?: string; p_order_id: string; p_rating: number };
        Returns: Json;
      };
      rate_order: {
        Args: { p_comment?: string; p_order_id: string; p_rating: number };
        Returns: undefined;
      };
      rate_order_items: { Args: { p_order_id: string; p_ratings: Json }; Returns: number };
      register_organization: {
        Args: {
          p_address_line: string;
          p_area_id: string;
          p_description?: string;
          p_email?: string;
          p_lat: number;
          p_legal_name?: string;
          p_lng: number;
          p_logo_path?: string;
          p_name: string;
          p_ntn?: string;
          p_phone: string;
          p_served_area_ids?: string[];
          p_strn?: string;
        };
        Returns: {
          address_line: string | null;
          approved_at: string | null;
          approved_by: string | null;
          area_id: string | null;
          cover_path: string | null;
          created_at: string;
          created_by: string | null;
          delivery_fee_paisa: number;
          description: string | null;
          email: string | null;
          free_delivery_above_paisa: number | null;
          id: string;
          lat: number | null;
          legal_name: string | null;
          lng: number | null;
          location: unknown;
          logo_path: string | null;
          min_order_paisa: number;
          name: string;
          ntn: string | null;
          phone: string | null;
          rejection_reason: string | null;
          served_area_ids: string[] | null;
          settings: NonNullable<Json>;
          slug: string;
          status: Database["public"]["Enums"]["approval_status"];
          strn: string | null;
          submitted_at: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "organizations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      register_push_subscription: {
        Args: { p_auth: string; p_endpoint: string; p_p256dh: string; p_user_agent?: string };
        Returns: string;
      };
      register_shop: {
        Args: {
          p_address_line: string;
          p_area_id: string;
          p_description?: string;
          p_kind?: Database["public"]["Enums"]["shop_kind"];
          p_lat: number;
          p_lng: number;
          p_name: string;
          p_ntn?: string;
          p_onboarded_by_org_id?: string;
          p_phone: string;
          p_photo_path?: string;
          p_strn?: string;
          p_whatsapp?: string;
        };
        Returns: {
          address_line: string | null;
          approved_at: string | null;
          approved_by: string | null;
          area_id: string | null;
          cover_path: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          kind: Database["public"]["Enums"]["shop_kind"];
          lat: number | null;
          lng: number | null;
          location: unknown;
          name: string;
          ntn: string | null;
          onboarded_by_member_id: string | null;
          onboarded_by_org_id: string | null;
          owner_id: string | null;
          phone: string | null;
          photo_path: string | null;
          rejection_reason: string | null;
          slug: string;
          status: Database["public"]["Enums"]["approval_status"];
          strn: string | null;
          submitted_at: string | null;
          tier: Database["public"]["Enums"]["shop_tier"];
          updated_at: string;
          whatsapp: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "shops";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      reject_organization: {
        Args: { p_org_id: string; p_reason: string };
        Returns: {
          address_line: string | null;
          approved_at: string | null;
          approved_by: string | null;
          area_id: string | null;
          cover_path: string | null;
          created_at: string;
          created_by: string | null;
          delivery_fee_paisa: number;
          description: string | null;
          email: string | null;
          free_delivery_above_paisa: number | null;
          id: string;
          lat: number | null;
          legal_name: string | null;
          lng: number | null;
          location: unknown;
          logo_path: string | null;
          min_order_paisa: number;
          name: string;
          ntn: string | null;
          phone: string | null;
          rejection_reason: string | null;
          served_area_ids: string[] | null;
          settings: NonNullable<Json>;
          slug: string;
          status: Database["public"]["Enums"]["approval_status"];
          strn: string | null;
          submitted_at: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "organizations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      reject_shop: {
        Args: { p_reason: string; p_shop_id: string };
        Returns: {
          address_line: string | null;
          approved_at: string | null;
          approved_by: string | null;
          area_id: string | null;
          cover_path: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          kind: Database["public"]["Enums"]["shop_kind"];
          lat: number | null;
          lng: number | null;
          location: unknown;
          name: string;
          ntn: string | null;
          onboarded_by_member_id: string | null;
          onboarded_by_org_id: string | null;
          owner_id: string | null;
          phone: string | null;
          photo_path: string | null;
          rejection_reason: string | null;
          slug: string;
          status: Database["public"]["Enums"]["approval_status"];
          strn: string | null;
          submitted_at: string | null;
          tier: Database["public"]["Enums"]["shop_tier"];
          updated_at: string;
          whatsapp: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "shops";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      reorder: { Args: { p_order_id: string }; Returns: Json };
      reorder_customer_order: { Args: { p_order_id: string }; Returns: Json };
      request_account_deletion: { Args: { p_reason?: string }; Returns: Json };
      request_return: {
        Args: { p_items: Json; p_notes?: string; p_order_id: string; p_photo_paths?: string[] };
        Returns: {
          claim_total_paisa: number;
          created_at: string;
          created_by: string | null;
          credit_note_id: string | null;
          credited_at: string | null;
          id: string;
          notes: string | null;
          order_id: string;
          org_id: string;
          photo_paths: string[];
          reason: Database["public"]["Enums"]["return_reason"];
          received_at: string | null;
          requested_by: string | null;
          return_number: string;
          review_note: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          shop_id: string;
          status: Database["public"]["Enums"]["return_status"];
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "returns";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      request_shop_confirmation: { Args: { p_order_id: string }; Returns: Json };
      resubmit_organization: {
        Args: { p_org_id: string };
        Returns: {
          address_line: string | null;
          approved_at: string | null;
          approved_by: string | null;
          area_id: string | null;
          cover_path: string | null;
          created_at: string;
          created_by: string | null;
          delivery_fee_paisa: number;
          description: string | null;
          email: string | null;
          free_delivery_above_paisa: number | null;
          id: string;
          lat: number | null;
          legal_name: string | null;
          lng: number | null;
          location: unknown;
          logo_path: string | null;
          min_order_paisa: number;
          name: string;
          ntn: string | null;
          phone: string | null;
          rejection_reason: string | null;
          served_area_ids: string[] | null;
          settings: NonNullable<Json>;
          slug: string;
          status: Database["public"]["Enums"]["approval_status"];
          strn: string | null;
          submitted_at: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "organizations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      resubmit_shop: {
        Args: { p_shop_id: string };
        Returns: {
          address_line: string | null;
          approved_at: string | null;
          approved_by: string | null;
          area_id: string | null;
          cover_path: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          kind: Database["public"]["Enums"]["shop_kind"];
          lat: number | null;
          lng: number | null;
          location: unknown;
          name: string;
          ntn: string | null;
          onboarded_by_member_id: string | null;
          onboarded_by_org_id: string | null;
          owner_id: string | null;
          phone: string | null;
          photo_path: string | null;
          rejection_reason: string | null;
          slug: string;
          status: Database["public"]["Enums"]["approval_status"];
          strn: string | null;
          submitted_at: string | null;
          tier: Database["public"]["Enums"]["shop_tier"];
          updated_at: string;
          whatsapp: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "shops";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      save_distributor_product: { Args: { p_org_id: string; p_product: Json }; Returns: string };
      search_catalog: {
        Args: { p_limit?: number; p_query: string; p_shop_id: string };
        Returns: Database["public"]["CompositeTypes"]["catalog_item"][];
        SetofOptions: {
          from: "*";
          to: "catalog_item";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      search_master_products: { Args: { p_limit?: number; p_query: string }; Returns: Json };
      seed_reset: { Args: Record<PropertyKey, never>; Returns: Json };
      send_chat_message: {
        Args: {
          p_as?: Database["public"]["Enums"]["chat_side"];
          p_body: string;
          p_conversation_id: string;
          p_order_id?: string;
        };
        Returns: Json;
      };
      set_cart_item: {
        Args: {
          p_distributor_product_id: string;
          p_pack_unit_id: string;
          p_quantity: number;
          p_shop_id: string;
          p_source?: Database["public"]["Enums"]["cart_item_source"];
        };
        Returns: Json;
      };
      set_organization_status: {
        Args: {
          p_org_id: string;
          p_reason?: string;
          p_status: Database["public"]["Enums"]["approval_status"];
        };
        Returns: {
          address_line: string | null;
          approved_at: string | null;
          approved_by: string | null;
          area_id: string | null;
          cover_path: string | null;
          created_at: string;
          created_by: string | null;
          delivery_fee_paisa: number;
          description: string | null;
          email: string | null;
          free_delivery_above_paisa: number | null;
          id: string;
          lat: number | null;
          legal_name: string | null;
          lng: number | null;
          location: unknown;
          logo_path: string | null;
          min_order_paisa: number;
          name: string;
          ntn: string | null;
          phone: string | null;
          rejection_reason: string | null;
          served_area_ids: string[] | null;
          settings: NonNullable<Json>;
          slug: string;
          status: Database["public"]["Enums"]["approval_status"];
          strn: string | null;
          submitted_at: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "organizations";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_shop_status: {
        Args: {
          p_reason?: string;
          p_shop_id: string;
          p_status: Database["public"]["Enums"]["approval_status"];
        };
        Returns: {
          address_line: string | null;
          approved_at: string | null;
          approved_by: string | null;
          area_id: string | null;
          cover_path: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          kind: Database["public"]["Enums"]["shop_kind"];
          lat: number | null;
          lng: number | null;
          location: unknown;
          name: string;
          ntn: string | null;
          onboarded_by_member_id: string | null;
          onboarded_by_org_id: string | null;
          owner_id: string | null;
          phone: string | null;
          photo_path: string | null;
          rejection_reason: string | null;
          slug: string;
          status: Database["public"]["Enums"]["approval_status"];
          strn: string | null;
          submitted_at: string | null;
          tier: Database["public"]["Enums"]["shop_tier"];
          updated_at: string;
          whatsapp: string | null;
        };
        SetofOptions: {
          from: "*";
          to: "shops";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      set_shop_stock: { Args: { p_inventory_id: string; p_qty: number }; Returns: number };
      shop_dashboard: { Args: { p_shop_id: string }; Returns: Json };
      shop_delivers_to: {
        Args: { p_lat: number; p_lng: number; p_shop_id: string };
        Returns: boolean;
      };
      shop_distributors: {
        Args: { p_shop_id: string };
        Returns: {
          account_status: string;
          area_name: string;
          balance_paisa: number;
          credit_limit_paisa: number;
          delivery_fee_paisa: number;
          free_delivery_above_paisa: number;
          logo_path: string;
          min_order_paisa: number;
          name: string;
          org_id: string;
          product_count: number;
          rating: number;
          rating_count: number;
        }[];
      };
      shop_home_feed: { Args: { p_shop_id: string }; Returns: Json };
      shop_ledger: {
        Args: { p_from?: string; p_org_id: string; p_shop_id: string; p_to?: string };
        Returns: Json;
      };
      shop_sales_report: { Args: { p_range?: string; p_shop_id: string }; Returns: Json };
      shop_starter_pack: { Args: { p_limit?: number; p_shop_id: string }; Returns: Json };
      shop_storefront: { Args: { p_shop_id: string }; Returns: Json };
      storefront_brands: { Args: { p_lat?: number; p_lng?: number }; Returns: Json };
      storefront_categories:
        | { Args: Record<PropertyKey, never>; Returns: Json }
        | { Args: { p_lat: number; p_lng: number }; Returns: Json };
      storefront_product: { Args: { p_id: string; p_lat?: number; p_lng?: number }; Returns: Json };
      storefront_products: {
        Args: {
          p_brand_id?: string;
          p_category_id?: string;
          p_lat?: number;
          p_limit?: number;
          p_lng?: number;
          p_query?: string;
          p_shop_id?: string;
          p_sort?: string;
        };
        Returns: Json;
      };
      storefront_shop: { Args: { p_slug: string }; Returns: Json };
      switch_active_context: {
        Args: { p_context_id?: string; p_role: Database["public"]["Enums"]["app_role"] };
        Returns: undefined;
      };
      unregister_push_subscription: { Args: { p_endpoint: string }; Returns: undefined };
      update_customer_order_status: {
        Args: {
          p_order_id: string;
          p_reason?: string;
          p_to: Database["public"]["Enums"]["customer_order_status"];
        };
        Returns: {
          accepted_at: string | null;
          address_id: string | null;
          cancel_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          client_request_id: string | null;
          created_at: string;
          created_by: string | null;
          customer_id: string | null;
          customer_name: string | null;
          customer_phone: string | null;
          deleted_at: string | null;
          delivered_at: string | null;
          delivery_address: Json | null;
          delivery_fee_paisa: number;
          discount_paisa: number;
          fulfilment: Database["public"]["Enums"]["fulfilment_type"];
          id: string;
          items_count: number;
          notes: string | null;
          order_number: string;
          out_for_delivery_at: string | null;
          packed_at: string | null;
          payment_method: Database["public"]["Enums"]["customer_payment_method"];
          payment_status: Database["public"]["Enums"]["order_payment_status"];
          pos_bill_id: string | null;
          rejected_reason: string | null;
          shop_id: string;
          shop_name: string;
          status: Database["public"]["Enums"]["customer_order_status"];
          subtotal_paisa: number;
          total_paisa: number;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "customer_orders";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      update_order_status: {
        Args: {
          p_note?: string;
          p_order_id: string;
          p_phone_confirmed?: boolean;
          p_to_status: Database["public"]["Enums"]["order_status"];
        };
        Returns: Json;
      };
      update_shop_location: {
        Args: { p_lat: number; p_lng: number; p_shop_id: string };
        Returns: Json;
      };
      update_shop_profile: {
        Args: {
          p_cover_path?: string;
          p_description?: string;
          p_photo_path?: string;
          p_shop_id: string;
        };
        Returns: Json;
      };
      update_shop_storefront: {
        Args: {
          p_delivery_fee_paisa?: number;
          p_delivery_radius_m?: number;
          p_eta_minutes?: number;
          p_free_delivery_above_paisa?: number;
          p_is_live: boolean;
          p_min_order_paisa?: number;
          p_shop_id: string;
          p_tagline?: string;
        };
        Returns: Json;
      };
    };
    Enums: {
      ai_action_status: "proposed" | "confirmed" | "executed" | "cancelled" | "failed" | "undone";
      ai_message_role: "system" | "user" | "assistant" | "tool";
      alias_kind: "name" | "spelling" | "mishearing" | "generic";
      alias_target_type: "product" | "brand" | "category";
      app_locale: "en" | "ur" | "ur-Latn" | "sd";
      app_role: "customer" | "dukandar" | "distributor" | "booker" | "rider" | "admin";
      approval_status: "draft" | "pending" | "approved" | "rejected" | "suspended";
      area_kind: "city" | "zone";
      banner_placement: "customer_home" | "dukan_home" | "distributor_dashboard" | "storefront";
      billing_interval: "monthly" | "yearly";
      campaign_channel: "whatsapp" | "sms" | "push" | "in_app";
      campaign_status: "draft" | "scheduled" | "sending" | "sent" | "cancelled";
      cart_item_source: "manual" | "munshi" | "parchi" | "reorder" | "booker";
      cash_book_entry_type: "opening" | "closing" | "cash_in" | "cash_out";
      cash_settlement_status: "pending" | "approved" | "disputed";
      chat_side: "shop" | "org" | "user" | "staff" | "system";
      content_owner_type: "platform" | "org" | "shop";
      conversation_kind: "trade" | "support";
      counterparty_type: "shop" | "shop_customer";
      credit_note_status: "issued" | "applied" | "void";
      customer_order_status:
        | "placed"
        | "accepted"
        | "packed"
        | "out_for_delivery"
        | "delivered"
        | "cancelled"
        | "rejected";
      customer_payment_method: "cod" | "jazzcash" | "easypaisa" | "raast" | "bank_transfer";
      deletion_request_status: "requested" | "in_review" | "completed" | "rejected";
      expense_category: "rent" | "bijli" | "salaries" | "gas" | "transport" | "other";
      fulfilment_type: "delivery" | "pickup";
      integration_kind:
        | "sms"
        | "whatsapp"
        | "jazzcash"
        | "easypaisa"
        | "bank_transfer"
        | "web_push"
        | "maps"
        | "printing"
        | "fbr_pos"
        | "ai"
        | "analytics"
        | "erp";
      integration_status: "connected" | "sandbox" | "error" | "disabled";
      invoice_status: "draft" | "issued" | "paid" | "overdue" | "void";
      ledger_account_code:
        | "cash"
        | "bank"
        | "wallet"
        | "sales"
        | "sales_returns"
        | "discounts"
        | "scheme_expense"
        | "receivable"
        | "write_off"
        | "opening_equity"
        | "cash_in_transit";
      ledger_book_type: "org" | "shop";
      measure_unit: "pc" | "g" | "kg" | "ml" | "l";
      member_status: "invited" | "active" | "suspended";
      message_channel: "sms" | "whatsapp" | "push";
      message_kind:
        "otp" | "reminder" | "order_update" | "brief" | "campaign" | "receipt" | "other";
      message_status: "queued" | "sending" | "sent" | "failed" | "sandbox" | "cancelled";
      notification_kind:
        | "order"
        | "payment"
        | "stock"
        | "khata"
        | "brief"
        | "approval"
        | "promotion"
        | "delivery"
        | "support"
        | "system"
        | "chat";
      order_payment_method: "cod" | "credit" | "jazzcash" | "easypaisa" | "raast" | "bank_transfer";
      order_payment_status: "unpaid" | "partially_paid" | "paid" | "refunded";
      order_source: "app" | "munshi" | "parchi" | "reorder" | "booker" | "api" | "whatsapp";
      order_status:
        | "new"
        | "confirmed"
        | "picking"
        | "packed"
        | "dispatched"
        | "delivered"
        | "partially_delivered"
        | "returned"
        | "cancelled";
      org_member_role: "owner" | "manager" | "accountant" | "warehouse" | "booker" | "rider";
      pack_unit_kind: "piece" | "dozen" | "inner" | "carton";
      payment_method:
        "cash" | "jazzcash" | "easypaisa" | "raast" | "bank_transfer" | "cheque" | "card";
      payment_status: "pending_verification" | "confirmed" | "rejected";
      platform_role: "admin" | "support";
      pos_bill_status: "completed" | "held" | "void" | "returned";
      price_tier_kind: "segment" | "area";
      retailer_account_status: "active" | "on_hold" | "blocked";
      return_reason: "damaged" | "short" | "expired" | "wrong_item" | "quality" | "other";
      return_status: "requested" | "approved" | "rejected" | "received" | "credited";
      review_target_type: "shop" | "organization";
      reward_reason:
        "order_delivered" | "on_time_payment" | "streak_bonus" | "adjustment" | "redeemed";
      sale_channel: "counter" | "online";
      scheme_kind: "buy_x_get_y" | "slab_discount" | "bundle" | "flat_discount";
      scheme_product_role: "trigger" | "reward" | "bundle_item";
      shop_kind:
        "kirana" | "general_store" | "mini_mart" | "wholesale" | "medical" | "bakery" | "other";
      shop_member_role: "owner" | "manager" | "cashier" | "staff";
      shop_stock_movement_type:
        | "receive"
        | "sale"
        | "sale_return"
        | "adjust_damage"
        | "adjust_expiry"
        | "self_use"
        | "count"
        | "opening";
      shop_tier: "silver" | "gold" | "platinum";
      stock_movement_type:
        | "stock_in"
        | "transfer_in"
        | "transfer_out"
        | "reserve"
        | "release"
        | "dispatch"
        | "return_in"
        | "adjust_damage"
        | "adjust_expiry"
        | "adjust_count";
      stock_transfer_status: "draft" | "in_transit" | "received" | "cancelled";
      subscription_status: "trialing" | "active" | "past_due" | "cancelled" | "expired";
      substitution_status: "proposed" | "accepted" | "rejected";
      target_metric:
        "sales_paisa" | "orders" | "new_shops" | "collections_paisa" | "visits" | "lines";
      theme_pref: "system" | "light" | "dark";
      ticket_kind: "dispute" | "refund" | "support" | "feedback";
      ticket_priority: "low" | "normal" | "high" | "urgent";
      ticket_status: "open" | "pending" | "resolved" | "closed";
      trip_status: "planned" | "in_progress" | "completed" | "cancelled";
      trip_stop_status:
        "pending" | "arrived" | "delivered" | "partially_delivered" | "failed" | "skipped";
      vehicle_kind: "bike" | "rickshaw" | "loader" | "van";
      visit_outcome:
        "ordered" | "no_order" | "shop_closed" | "payment_collected" | "follow_up" | "onboarded";
      webhook_delivery_status: "pending" | "succeeded" | "failed";
    };
    CompositeTypes: {
      catalog_item: {
        distributor_product_id: string | null;
        org_id: string | null;
        org_name: string | null;
        master_product_id: string | null;
        name: string | null;
        name_ur: string | null;
        brand_id: string | null;
        brand_name: string | null;
        brand_slug: string | null;
        category_id: string | null;
        category_slug: string | null;
        pack_size_label: string | null;
        image_path: string | null;
        mrp_paisa: number | null;
        price_paisa: number | null;
        moq_base_qty: number | null;
        pack_units: Json | null;
        scheme: Json | null;
        in_stock: boolean | null;
        available_base_qty: number | null;
        rank: number | null;
      };
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      ai_action_status: ["proposed", "confirmed", "executed", "cancelled", "failed", "undone"],
      ai_message_role: ["system", "user", "assistant", "tool"],
      alias_kind: ["name", "spelling", "mishearing", "generic"],
      alias_target_type: ["product", "brand", "category"],
      app_locale: ["en", "ur", "ur-Latn", "sd"],
      app_role: ["customer", "dukandar", "distributor", "booker", "rider", "admin"],
      approval_status: ["draft", "pending", "approved", "rejected", "suspended"],
      area_kind: ["city", "zone"],
      banner_placement: ["customer_home", "dukan_home", "distributor_dashboard", "storefront"],
      billing_interval: ["monthly", "yearly"],
      campaign_channel: ["whatsapp", "sms", "push", "in_app"],
      campaign_status: ["draft", "scheduled", "sending", "sent", "cancelled"],
      cart_item_source: ["manual", "munshi", "parchi", "reorder", "booker"],
      cash_book_entry_type: ["opening", "closing", "cash_in", "cash_out"],
      cash_settlement_status: ["pending", "approved", "disputed"],
      chat_side: ["shop", "org", "user", "staff", "system"],
      content_owner_type: ["platform", "org", "shop"],
      conversation_kind: ["trade", "support"],
      counterparty_type: ["shop", "shop_customer"],
      credit_note_status: ["issued", "applied", "void"],
      customer_order_status: [
        "placed",
        "accepted",
        "packed",
        "out_for_delivery",
        "delivered",
        "cancelled",
        "rejected",
      ],
      customer_payment_method: ["cod", "jazzcash", "easypaisa", "raast", "bank_transfer"],
      deletion_request_status: ["requested", "in_review", "completed", "rejected"],
      expense_category: ["rent", "bijli", "salaries", "gas", "transport", "other"],
      fulfilment_type: ["delivery", "pickup"],
      integration_kind: [
        "sms",
        "whatsapp",
        "jazzcash",
        "easypaisa",
        "bank_transfer",
        "web_push",
        "maps",
        "printing",
        "fbr_pos",
        "ai",
        "analytics",
        "erp",
      ],
      integration_status: ["connected", "sandbox", "error", "disabled"],
      invoice_status: ["draft", "issued", "paid", "overdue", "void"],
      ledger_account_code: [
        "cash",
        "bank",
        "wallet",
        "sales",
        "sales_returns",
        "discounts",
        "scheme_expense",
        "receivable",
        "write_off",
        "opening_equity",
        "cash_in_transit",
      ],
      ledger_book_type: ["org", "shop"],
      measure_unit: ["pc", "g", "kg", "ml", "l"],
      member_status: ["invited", "active", "suspended"],
      message_channel: ["sms", "whatsapp", "push"],
      message_kind: ["otp", "reminder", "order_update", "brief", "campaign", "receipt", "other"],
      message_status: ["queued", "sending", "sent", "failed", "sandbox", "cancelled"],
      notification_kind: [
        "order",
        "payment",
        "stock",
        "khata",
        "brief",
        "approval",
        "promotion",
        "delivery",
        "support",
        "system",
        "chat",
      ],
      order_payment_method: ["cod", "credit", "jazzcash", "easypaisa", "raast", "bank_transfer"],
      order_payment_status: ["unpaid", "partially_paid", "paid", "refunded"],
      order_source: ["app", "munshi", "parchi", "reorder", "booker", "api", "whatsapp"],
      order_status: [
        "new",
        "confirmed",
        "picking",
        "packed",
        "dispatched",
        "delivered",
        "partially_delivered",
        "returned",
        "cancelled",
      ],
      org_member_role: ["owner", "manager", "accountant", "warehouse", "booker", "rider"],
      pack_unit_kind: ["piece", "dozen", "inner", "carton"],
      payment_method: ["cash", "jazzcash", "easypaisa", "raast", "bank_transfer", "cheque", "card"],
      payment_status: ["pending_verification", "confirmed", "rejected"],
      platform_role: ["admin", "support"],
      pos_bill_status: ["completed", "held", "void", "returned"],
      price_tier_kind: ["segment", "area"],
      retailer_account_status: ["active", "on_hold", "blocked"],
      return_reason: ["damaged", "short", "expired", "wrong_item", "quality", "other"],
      return_status: ["requested", "approved", "rejected", "received", "credited"],
      review_target_type: ["shop", "organization"],
      reward_reason: [
        "order_delivered",
        "on_time_payment",
        "streak_bonus",
        "adjustment",
        "redeemed",
      ],
      sale_channel: ["counter", "online"],
      scheme_kind: ["buy_x_get_y", "slab_discount", "bundle", "flat_discount"],
      scheme_product_role: ["trigger", "reward", "bundle_item"],
      shop_kind: [
        "kirana",
        "general_store",
        "mini_mart",
        "wholesale",
        "medical",
        "bakery",
        "other",
      ],
      shop_member_role: ["owner", "manager", "cashier", "staff"],
      shop_stock_movement_type: [
        "receive",
        "sale",
        "sale_return",
        "adjust_damage",
        "adjust_expiry",
        "self_use",
        "count",
        "opening",
      ],
      shop_tier: ["silver", "gold", "platinum"],
      stock_movement_type: [
        "stock_in",
        "transfer_in",
        "transfer_out",
        "reserve",
        "release",
        "dispatch",
        "return_in",
        "adjust_damage",
        "adjust_expiry",
        "adjust_count",
      ],
      stock_transfer_status: ["draft", "in_transit", "received", "cancelled"],
      subscription_status: ["trialing", "active", "past_due", "cancelled", "expired"],
      substitution_status: ["proposed", "accepted", "rejected"],
      target_metric: ["sales_paisa", "orders", "new_shops", "collections_paisa", "visits", "lines"],
      theme_pref: ["system", "light", "dark"],
      ticket_kind: ["dispute", "refund", "support", "feedback"],
      ticket_priority: ["low", "normal", "high", "urgent"],
      ticket_status: ["open", "pending", "resolved", "closed"],
      trip_status: ["planned", "in_progress", "completed", "cancelled"],
      trip_stop_status: [
        "pending",
        "arrived",
        "delivered",
        "partially_delivered",
        "failed",
        "skipped",
      ],
      vehicle_kind: ["bike", "rickshaw", "loader", "van"],
      visit_outcome: [
        "ordered",
        "no_order",
        "shop_closed",
        "payment_collected",
        "follow_up",
        "onboarded",
      ],
      webhook_delivery_status: ["pending", "succeeded", "failed"],
    },
  },
} as const;
