CREATE TABLE "badges" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"icon" text NOT NULL,
	"category" text NOT NULL,
	"tier" text DEFAULT 'bronze' NOT NULL,
	"criteria" jsonb DEFAULT '{}'::jsonb,
	"color" text DEFAULT '#8B5CF6',
	"rarity" text DEFAULT 'common',
	"created_at" text DEFAULT '2026-03-22T13:20:47.564Z' NOT NULL,
	CONSTRAINT "badges_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "bulletin_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"post_type" text DEFAULT 'lfg' NOT NULL,
	"game_system" text DEFAULT 'D&D 5e',
	"players_needed" integer DEFAULT 1,
	"experience_level" text DEFAULT 'any',
	"play_style" text DEFAULT 'mixed',
	"preferred_time" text,
	"session_duration" text,
	"is_ongoing" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"response_count" integer DEFAULT 0,
	"created_at" text DEFAULT '2026-03-22T13:20:47.557Z' NOT NULL,
	"updated_at" text,
	"expires_at" text
);
--> statement-breakpoint
CREATE TABLE "bulletin_responses" (
	"id" serial PRIMARY KEY NOT NULL,
	"post_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"message" text NOT NULL,
	"contact_method" text,
	"contact_info" text,
	"created_at" text DEFAULT '2026-03-22T13:20:47.557Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_dungeon_maps" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"session_id" integer,
	"map_name" text NOT NULL,
	"map_data" jsonb NOT NULL,
	"explored_tiles" jsonb DEFAULT '[]'::jsonb,
	"entity_positions" jsonb DEFAULT '[]'::jsonb,
	"player_position" jsonb DEFAULT '{"x":0,"y":0}'::jsonb,
	"fog_of_war" jsonb DEFAULT '{}'::jsonb,
	"discovered_secrets" jsonb DEFAULT '[]'::jsonb,
	"looted_chests" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" text DEFAULT '2026-03-22T13:20:47.549Z' NOT NULL,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "campaign_exploration_hexes" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"q" integer NOT NULL,
	"r" integer NOT NULL,
	"terrain_type" text DEFAULT 'Unknown' NOT NULL,
	"location_name" text,
	"location_description" text,
	"hex_meta" jsonb,
	"is_explored" boolean DEFAULT false,
	"is_revealed" boolean DEFAULT false,
	"explored_at" text,
	"revealed_at" text,
	"narrative_context" text,
	"connected_directions" jsonb DEFAULT '[]'::jsonb,
	"created_at" text DEFAULT '2026-03-22T13:20:47.549Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_exploration_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"current_hex_q" integer DEFAULT 0,
	"current_hex_r" integer DEFAULT 0,
	"explored_hex_count" integer DEFAULT 1,
	"total_distance" integer DEFAULT 0,
	"last_movement_at" text,
	"created_at" text DEFAULT '2026-03-22T13:20:47.550Z' NOT NULL,
	"updated_at" text,
	CONSTRAINT "campaign_exploration_state_campaign_id_unique" UNIQUE("campaign_id")
);
--> statement-breakpoint
CREATE TABLE "campaign_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"invite_code" text NOT NULL,
	"email" text,
	"role" text DEFAULT 'player' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_by" integer NOT NULL,
	"created_at" text DEFAULT '2026-03-22T13:20:47.545Z' NOT NULL,
	"expires_at" text,
	"used_at" text,
	"max_uses" integer DEFAULT 1,
	"use_count" integer DEFAULT 0,
	"notes" text,
	CONSTRAINT "campaign_invitations_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
CREATE TABLE "campaign_quests" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"quest_type" text DEFAULT 'main' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"objectives" jsonb DEFAULT '[]'::jsonb,
	"xp_reward" integer DEFAULT 100,
	"gold_reward" integer DEFAULT 0,
	"silver_reward" integer DEFAULT 0,
	"loot_rewards" jsonb DEFAULT '[]'::jsonb,
	"completed_at" text,
	"created_at" text DEFAULT '2026-03-22T13:20:47.551Z' NOT NULL,
	"order" integer DEFAULT 0,
	"is_posted_to_board" boolean DEFAULT false,
	"posted_at" text,
	"accepted_by_character_id" integer,
	"accepted_by_user_id" integer,
	"accepted_at" text,
	"difficulty_rating" text DEFAULT 'moderate',
	"estimated_duration" text,
	"prerequisites" text,
	"discovered_by_ai" boolean DEFAULT false,
	"discovery_context" text,
	"quest_giver" text
);
--> statement-breakpoint
CREATE TABLE "campaign_srd_references" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"entity_type" text NOT NULL,
	"entity_slug" text NOT NULL,
	"entity_name" text NOT NULL,
	"entity_data" jsonb,
	"notes" text,
	"added_by" integer NOT NULL,
	"added_at" text DEFAULT '2026-03-22T13:20:47.568Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "campaign_trace_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"session_id" text,
	"eid" text NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"ts" text NOT NULL,
	"who" text,
	"location_ref" text,
	"note" text,
	"meta" jsonb
);
--> statement-breakpoint
CREATE TABLE "capital_exploration" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"world_location_id" integer NOT NULL,
	"current_q" integer DEFAULT 15 NOT NULL,
	"current_r" integer DEFAULT 2 NOT NULL,
	"revealed_hexes" jsonb DEFAULT '[]'::jsonb,
	"discovered_buildings" jsonb DEFAULT '[]'::jsonb,
	"hex_layout" jsonb,
	"created_at" text DEFAULT '2026-03-22T13:20:47.550Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_arc_insights" (
	"id" serial PRIMARY KEY NOT NULL,
	"character_id" integer NOT NULL,
	"campaign_id" integer NOT NULL,
	"insight_type" text NOT NULL,
	"teaser" text NOT NULL,
	"full_insight" text,
	"related_behaviors" jsonb DEFAULT '[]'::jsonb,
	"is_revealed" boolean DEFAULT false,
	"revealed_at" text,
	"created_at" text DEFAULT '2026-03-22T13:20:47.560Z' NOT NULL,
	"expires_at" text
);
--> statement-breakpoint
CREATE TABLE "character_inventory" (
	"id" serial PRIMARY KEY NOT NULL,
	"character_id" integer NOT NULL,
	"template_id" integer,
	"name" text NOT NULL,
	"description" text,
	"type" text NOT NULL,
	"rarity" text DEFAULT 'common',
	"is_bound" boolean DEFAULT false,
	"bound_at" text,
	"acquired_from" text,
	"acquired_at" text NOT NULL,
	"magic_bonus" integer DEFAULT 0,
	"damage_dice" text,
	"damage_type" text,
	"base_ac" integer,
	"properties" text[],
	"special_effect" text,
	"requires_attunement" boolean DEFAULT false,
	"is_attuned" boolean DEFAULT false,
	"is_equipped" boolean DEFAULT false,
	"equip_slot" text,
	"quantity" integer DEFAULT 1,
	"max_charges" integer,
	"current_charges" integer,
	"value" integer DEFAULT 0,
	"created_at" text DEFAULT '2026-03-22T13:20:47.566Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_reputation_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"character_id" integer NOT NULL,
	"faction_id" integer,
	"campaign_id" integer NOT NULL,
	"trust_descriptor" text,
	"trust_level" text DEFAULT 'unknown',
	"behavior_descriptor" text,
	"tendencies" jsonb DEFAULT '{}'::jsonb,
	"notable_deeds" jsonb DEFAULT '[]'::jsonb,
	"reputation_notes" text,
	"last_event_id" integer,
	"last_updated_at" text DEFAULT '2026-03-22T13:20:47.558Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "character_spell_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"character_id" integer NOT NULL,
	"slots_level_1_max" integer DEFAULT 0,
	"slots_level_2_max" integer DEFAULT 0,
	"slots_level_3_max" integer DEFAULT 0,
	"slots_level_4_max" integer DEFAULT 0,
	"slots_level_5_max" integer DEFAULT 0,
	"slots_level_6_max" integer DEFAULT 0,
	"slots_level_7_max" integer DEFAULT 0,
	"slots_level_8_max" integer DEFAULT 0,
	"slots_level_9_max" integer DEFAULT 0,
	"slots_level_1_used" integer DEFAULT 0,
	"slots_level_2_used" integer DEFAULT 0,
	"slots_level_3_used" integer DEFAULT 0,
	"slots_level_4_used" integer DEFAULT 0,
	"slots_level_5_used" integer DEFAULT 0,
	"slots_level_6_used" integer DEFAULT 0,
	"slots_level_7_used" integer DEFAULT 0,
	"slots_level_8_used" integer DEFAULT 0,
	"slots_level_9_used" integer DEFAULT 0,
	"last_long_rest" text,
	CONSTRAINT "character_spell_slots_character_id_unique" UNIQUE("character_id")
);
--> statement-breakpoint
CREATE TABLE "character_spells" (
	"id" serial PRIMARY KEY NOT NULL,
	"character_id" integer NOT NULL,
	"spell_id" integer NOT NULL,
	"source" text DEFAULT 'class',
	"is_prepared" boolean DEFAULT false,
	"in_spellbook" boolean DEFAULT true,
	"acquired_at" text NOT NULL,
	"acquired_level" integer DEFAULT 1,
	"acquisition_story" text
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"username" text NOT NULL,
	"display_name" text,
	"message" text NOT NULL,
	"message_type" text DEFAULT 'text' NOT NULL,
	"channel_type" text DEFAULT 'global' NOT NULL,
	"campaign_id" integer,
	"campaign_title" text,
	"dice_roll" jsonb,
	"is_edited" boolean DEFAULT false,
	"edited_at" text,
	"created_at" text DEFAULT '2026-03-22T13:20:47.548Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "city_maps" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"world_location_id" integer NOT NULL,
	"location_name" text NOT NULL,
	"seed" integer NOT NULL,
	"layout" jsonb NOT NULL,
	"discovered_buildings" jsonb DEFAULT '[]'::jsonb,
	"created_at" text DEFAULT '2026-03-22T13:20:47.550Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_stats_rollup" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" text NOT NULL,
	"active_users" integer DEFAULT 0,
	"new_users" integer DEFAULT 0,
	"total_sessions" integer DEFAULT 0,
	"avg_session_duration" integer DEFAULT 0,
	"total_dice_rolls" integer DEFAULT 0,
	"total_ai_requests" integer DEFAULT 0,
	"campaigns_started" integer DEFAULT 0,
	"campaigns_completed" integer DEFAULT 0,
	"characters_created" integer DEFAULT 0,
	"feature_breakdown" jsonb DEFAULT '{}'::jsonb,
	"top_pages" jsonb DEFAULT '[]'::jsonb
);
--> statement-breakpoint
CREATE TABLE "demo_analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" text NOT NULL,
	"event_type" text NOT NULL,
	"event_data" jsonb,
	"created_at" text DEFAULT '2026-03-22T13:20:47.568Z' NOT NULL,
	"user_agent" text,
	"referrer" text,
	"converted_user_id" integer
);
--> statement-breakpoint
CREATE TABLE "discord_connections" (
	"id" serial PRIMARY KEY NOT NULL,
	"discord_user_id" text NOT NULL,
	"discord_username" text NOT NULL,
	"connection_code" text NOT NULL,
	"expires_at" text NOT NULL,
	"created_at" text DEFAULT '2026-03-22T13:20:47.530Z' NOT NULL,
	CONSTRAINT "discord_connections_connection_code_unique" UNIQUE("connection_code")
);
--> statement-breakpoint
CREATE TABLE "dm_notes" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"is_private" boolean DEFAULT true NOT NULL,
	"related_entity_type" text,
	"related_entity_id" integer,
	"created_by" integer NOT NULL,
	"created_at" text DEFAULT '2026-03-22T13:20:47.546Z' NOT NULL,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "dm_session_states" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"session_id" integer,
	"presence" jsonb DEFAULT '[]'::jsonb,
	"initiative_order" jsonb DEFAULT '[]'::jsonb,
	"current_turn_index" integer DEFAULT 0,
	"round_number" integer DEFAULT 1,
	"pending_choices" jsonb DEFAULT '[]'::jsonb,
	"active_group_choices" jsonb DEFAULT '[]'::jsonb,
	"group_choice_votes" jsonb DEFAULT '[]'::jsonb,
	"group_choice_status" text DEFAULT 'none',
	"group_choice_threshold" integer DEFAULT 0,
	"group_choice_resolution" jsonb,
	"dm_messages" jsonb DEFAULT '[]'::jsonb,
	"table_chat" jsonb DEFAULT '[]'::jsonb,
	"session_artifacts" jsonb DEFAULT '[]'::jsonb,
	"caml_entity_sources" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true,
	"started_at" text DEFAULT '2026-03-22T13:20:47.558Z' NOT NULL,
	"last_updated_at" text
);
--> statement-breakpoint
CREATE TABLE "dungeon_definitions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"theme_tags" text[],
	"recommended_level_min" integer DEFAULT 1 NOT NULL,
	"recommended_level_max" integer DEFAULT 5 NOT NULL,
	"map_width" integer DEFAULT 9 NOT NULL,
	"map_height" integer DEFAULT 9 NOT NULL,
	"map_layout" jsonb NOT NULL,
	"node_table" jsonb NOT NULL,
	"reward_profile" jsonb,
	"completion_hooks" jsonb,
	"created_at" text DEFAULT '2026-03-22T13:20:47.588Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dungeon_node_states" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"node_id" text NOT NULL,
	"state" text DEFAULT 'hidden' NOT NULL,
	"resolution_payload" jsonb,
	"last_resolved_at" text
);
--> statement-breakpoint
CREATE TABLE "dungeon_rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"character_id" integer NOT NULL,
	"item_drops" jsonb,
	"knowledge_drops" jsonb,
	"unlock_drops" jsonb,
	"gold_value" integer DEFAULT 0 NOT NULL,
	"xp_value" integer DEFAULT 0 NOT NULL,
	"granted_at" text DEFAULT '2026-03-22T13:20:47.589Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dungeon_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"campaign_id" integer NOT NULL,
	"character_id" integer NOT NULL,
	"dungeon_id" integer NOT NULL,
	"current_q" integer DEFAULT 0 NOT NULL,
	"current_r" integer DEFAULT 0 NOT NULL,
	"revealed_coords" jsonb NOT NULL,
	"cleared_nodes" jsonb,
	"disarmed_traps" jsonb,
	"solved_puzzles" jsonb,
	"light_ticks" integer DEFAULT 20 NOT NULL,
	"supplies" integer DEFAULT 10 NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"flags" jsonb,
	"started_at" text DEFAULT '2026-03-22T13:20:47.588Z' NOT NULL,
	"ended_at" text
);
--> statement-breakpoint
CREATE TABLE "factions" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" text DEFAULT 'group' NOT NULL,
	"disposition" text DEFAULT 'neutral',
	"values" text[],
	"created_at" text DEFAULT '2026-03-22T13:20:47.558Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "group_invitations" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"inviter_id" integer NOT NULL,
	"invitee_id" integer NOT NULL,
	"message" text,
	"status" text DEFAULT 'pending',
	"created_at" text DEFAULT '2026-03-22T13:20:47.559Z' NOT NULL,
	"responded_at" text
);
--> statement-breakpoint
CREATE TABLE "group_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"author_id" integer NOT NULL,
	"title" text,
	"content" text NOT NULL,
	"is_pinned" boolean DEFAULT false,
	"is_announcement" boolean DEFAULT false,
	"created_at" text DEFAULT '2026-03-22T13:20:47.560Z' NOT NULL,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "hearth_board_posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"pinned" boolean DEFAULT false,
	"created_at" text DEFAULT '2026-03-22T13:20:47.568Z' NOT NULL,
	"expires_at" text,
	"deleted_at" text
);
--> statement-breakpoint
CREATE TABLE "hearth_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"user_id" integer,
	"payload" jsonb,
	"created_at" text DEFAULT '2026-03-22T13:20:47.568Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hearth_murmur" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"active_from" text NOT NULL,
	"active_to" text NOT NULL,
	"created_at" text DEFAULT '2026-03-22T13:20:47.568Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hearth_presence" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"seat_zone" text DEFAULT 'fire' NOT NULL,
	"status_text" text,
	"last_ping_at" text NOT NULL,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hearth_user_state" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"seat_zone" text DEFAULT 'fire',
	"last_visit_at" text,
	"last_departure_note" text,
	"quiet_mode_default" boolean DEFAULT false,
	"return_streak" integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE "hex_exploration_states" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"campaign_id" integer NOT NULL,
	"hex_q" integer NOT NULL,
	"hex_r" integer NOT NULL,
	"state" text DEFAULT 'unknown' NOT NULL,
	"markers" jsonb,
	"notes" text,
	"danger_override" integer,
	"depletion_until_tick" integer,
	"discovered_at" text,
	"last_visited_at" text
);
--> statement-breakpoint
CREATE TABLE "items" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"rarity" text DEFAULT 'common',
	"description" text,
	"damage_dice" text,
	"damage_type" text,
	"weapon_type" text,
	"weapon_range" text,
	"attack_bonus" integer DEFAULT 0,
	"properties" text[],
	"base_ac" integer,
	"max_dex_bonus" integer,
	"stealth_disadvantage" boolean DEFAULT false,
	"strength_requirement" integer,
	"armor_type" text,
	"weight" integer DEFAULT 0,
	"value" integer DEFAULT 0,
	"requires_attunement" boolean DEFAULT false,
	"magic_bonus" integer DEFAULT 0,
	"special_effect" text,
	"created_at" text DEFAULT '2026-03-22T13:20:47.537Z' NOT NULL,
	CONSTRAINT "items_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "llm_configs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"provider" text DEFAULT 'openai' NOT NULL,
	"api_key" text NOT NULL,
	"endpoint" text,
	"model" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"label" text DEFAULT 'My LLM' NOT NULL,
	"created_at" text DEFAULT '2026-03-22T13:20:47.589Z' NOT NULL,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"environment" text,
	"climate" text,
	"terrain" text,
	"notable_features" text[] DEFAULT '{}',
	"inhabitants" text[] DEFAULT '{}',
	"secrets" text,
	"hooks" text[] DEFAULT '{}',
	"created_by" integer NOT NULL,
	"is_public" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "magic_item_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"type" text NOT NULL,
	"rarity" text DEFAULT 'uncommon' NOT NULL,
	"min_level" integer DEFAULT 1,
	"max_level" integer DEFAULT 20,
	"class_affinity" text[],
	"magic_bonus" integer DEFAULT 0,
	"damage_dice" text,
	"damage_type" text,
	"base_ac" integer,
	"properties" text[],
	"special_effect" text,
	"requires_attunement" boolean DEFAULT false,
	"attunement_requirements" text,
	"milestone_type" text,
	"drop_weight" integer DEFAULT 10,
	"is_shoppable" boolean DEFAULT false,
	"shop_price" integer,
	"lore" text,
	"image_url" text,
	"created_at" text DEFAULT '2026-03-22T13:20:47.566Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "magic_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"rarity" text NOT NULL,
	"description" text NOT NULL,
	"requires_attunement" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "market_item_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"item_slug" text NOT NULL,
	"base_price" real NOT NULL,
	"current_price" real NOT NULL,
	"demand_multiplier" real DEFAULT 1 NOT NULL,
	"total_purchases" integer DEFAULT 0 NOT NULL,
	"recent_purchases" integer DEFAULT 0 NOT NULL,
	"last_purchase_at" text,
	"last_decay_at" text,
	CONSTRAINT "market_item_stats_item_slug_unique" UNIQUE("item_slug")
);
--> statement-breakpoint
CREATE TABLE "milestone_rewards" (
	"id" serial PRIMARY KEY NOT NULL,
	"character_id" integer NOT NULL,
	"campaign_id" integer NOT NULL,
	"milestone_type" text NOT NULL,
	"milestone_name" text NOT NULL,
	"session_number" integer,
	"item_template_id" integer,
	"inventory_item_id" integer,
	"xp_awarded" integer DEFAULT 0,
	"gold_awarded" integer DEFAULT 0,
	"is_claimed" boolean DEFAULT false,
	"claimed_at" text,
	"earned_at" text NOT NULL,
	"created_at" text DEFAULT '2026-03-22T13:20:47.567Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monsters" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"size" text NOT NULL,
	"challenge_rating" text NOT NULL,
	"armor_class" integer NOT NULL,
	"hit_points" integer NOT NULL,
	"speed" text NOT NULL,
	"stats" text NOT NULL,
	"skills" text[] DEFAULT '{}',
	"resistances" text[] DEFAULT '{}',
	"immunities" text[] DEFAULT '{}',
	"senses" text[] DEFAULT '{}',
	"languages" text[] DEFAULT '{}',
	"abilities" text[] DEFAULT '{}',
	"actions" text[] DEFAULT '{}',
	"description" text,
	"environment" text[] DEFAULT '{}',
	"lore" text,
	"image_url" text,
	"created_by" integer NOT NULL,
	"is_public" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "online_users" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"username" text NOT NULL,
	"display_name" text,
	"last_seen" text NOT NULL,
	"socket_id" text,
	"is_in_campaign" boolean DEFAULT false,
	"current_campaign_id" integer,
	CONSTRAINT "online_users_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "pending_discord_choices" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"session_number" integer NOT NULL,
	"discord_user_id" text NOT NULL,
	"user_id" integer NOT NULL,
	"choice_index" integer NOT NULL,
	"choice_text" text NOT NULL,
	"created_at" text DEFAULT '2026-03-22T13:20:47.530Z' NOT NULL,
	"processed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_bank" (
	"id" serial PRIMARY KEY NOT NULL,
	"character_id" integer NOT NULL,
	"campaign_id" integer NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"last_interest_at" text,
	"transactions" jsonb DEFAULT '[]'::jsonb,
	"created_at" text DEFAULT '2026-03-22T13:20:47.590Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_group_members" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"character_id" integer,
	"role" text DEFAULT 'member',
	"title" text,
	"joined_at" text DEFAULT '2026-03-22T13:20:47.559Z' NOT NULL,
	"is_active" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "player_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"motto" text,
	"emblem_url" text,
	"founder_id" integer NOT NULL,
	"leader_ids" integer[] DEFAULT '{}',
	"collective_identity" text,
	"reputation_descriptor" text,
	"notable_achievements" jsonb DEFAULT '[]'::jsonb,
	"is_public" boolean DEFAULT true,
	"max_members" integer DEFAULT 20,
	"created_at" text DEFAULT '2026-03-22T13:20:47.559Z' NOT NULL,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "player_houses" (
	"id" serial PRIMARY KEY NOT NULL,
	"character_id" integer NOT NULL,
	"campaign_id" integer NOT NULL,
	"house_name" text NOT NULL,
	"house_type" text DEFAULT 'modest' NOT NULL,
	"district" text NOT NULL,
	"purchase_price" integer NOT NULL,
	"furnishings" jsonb DEFAULT '[]'::jsonb,
	"stored_items" jsonb DEFAULT '[]'::jsonb,
	"upgrades" jsonb DEFAULT '[]'::jsonb,
	"purchased_at" text NOT NULL,
	"created_at" text DEFAULT '2026-03-22T13:20:47.589Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "player_listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"seller_id" integer NOT NULL,
	"character_id" integer NOT NULL,
	"item_name" text NOT NULL,
	"item_data" jsonb NOT NULL,
	"asking_price" integer NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"buyer_id" integer,
	"buyer_character_id" integer,
	"created_at" text DEFAULT '2026-03-22T13:20:47.570Z' NOT NULL,
	"sold_at" text
);
--> statement-breakpoint
CREATE TABLE "quests" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"rewards" jsonb DEFAULT '{}'::jsonb,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reputation_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"character_id" integer NOT NULL,
	"campaign_id" integer NOT NULL,
	"faction_id" integer,
	"trace_event_id" integer,
	"trigger_type" text NOT NULL,
	"significance" text DEFAULT 'minor',
	"narrative_summary" text NOT NULL,
	"pattern_delta" jsonb DEFAULT '{}'::jsonb,
	"witnesses" text[],
	"location_context" text,
	"is_processed" boolean DEFAULT false,
	"created_at" text DEFAULT '2026-03-22T13:20:47.559Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shared_adventures" (
	"id" serial PRIMARY KEY NOT NULL,
	"author_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"short_description" text,
	"caml_data" jsonb,
	"cover_image_url" text,
	"tags" text[] DEFAULT '{}',
	"difficulty" text DEFAULT 'medium' NOT NULL,
	"player_count_min" integer DEFAULT 1,
	"player_count_max" integer DEFAULT 5,
	"estimated_sessions" integer DEFAULT 1,
	"genre" text DEFAULT 'fantasy',
	"avg_rating" integer DEFAULT 0,
	"total_ratings" integer DEFAULT 0,
	"download_count" integer DEFAULT 0,
	"is_featured" boolean DEFAULT false,
	"status" text DEFAULT 'published' NOT NULL,
	"created_at" text DEFAULT '2026-03-22T13:20:47.569Z' NOT NULL,
	"updated_at" text
);
--> statement-breakpoint
CREATE TABLE "shared_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"author_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"item_type" text DEFAULT 'weapon' NOT NULL,
	"rarity" text DEFAULT 'common' NOT NULL,
	"stats" jsonb DEFAULT '{}'::jsonb,
	"lore" text,
	"image_url" text,
	"tags" text[] DEFAULT '{}',
	"avg_rating" integer DEFAULT 0,
	"total_ratings" integer DEFAULT 0,
	"download_count" integer DEFAULT 0,
	"is_featured" boolean DEFAULT false,
	"status" text DEFAULT 'published' NOT NULL,
	"created_at" text DEFAULT '2026-03-22T13:20:47.569Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spells" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"level" integer NOT NULL,
	"school" text NOT NULL,
	"casting_time" text NOT NULL,
	"range" text NOT NULL,
	"components" text NOT NULL,
	"duration" text NOT NULL,
	"description" text NOT NULL,
	"higher_levels" text,
	"classes" text[] NOT NULL,
	"damage_type" text,
	"damage_dice" text,
	"healing_dice" text,
	"saving_throw" text,
	"ritual" boolean DEFAULT false,
	"concentration" boolean DEFAULT false,
	"srd_compliant" boolean DEFAULT true,
	CONSTRAINT "spells_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "trading_post_reviews" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"target_type" text NOT NULL,
	"target_id" integer NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"created_at" text DEFAULT '2026-03-22T13:20:47.569Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trek_routes" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"character_id" integer,
	"character_name" text,
	"origin_q" integer DEFAULT 0,
	"origin_r" integer DEFAULT 0,
	"destination_q" integer NOT NULL,
	"destination_r" integer NOT NULL,
	"destination_name" text,
	"path" jsonb NOT NULL,
	"current_step" integer DEFAULT 0,
	"status" text DEFAULT 'active' NOT NULL,
	"pending_encounter" jsonb,
	"loot_found" jsonb DEFAULT '[]'::jsonb,
	"created_at" text DEFAULT '2026-03-22T13:20:47.550Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unresolved_threads" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"character_id" integer,
	"thread_type" text NOT NULL,
	"title" text NOT NULL,
	"narrative" text NOT NULL,
	"involved_parties" text[] DEFAULT '{}',
	"urgency" text DEFAULT 'low',
	"status" text DEFAULT 'active',
	"resolved_at" text,
	"resolution_notes" text,
	"created_at" text DEFAULT '2026-03-22T13:20:47.560Z' NOT NULL,
	"last_mentioned_at" text
);
--> statement-breakpoint
CREATE TABLE "user_activity_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"session_id" text NOT NULL,
	"event_type" text NOT NULL,
	"event_category" text NOT NULL,
	"event_name" text NOT NULL,
	"event_data" jsonb DEFAULT '{}'::jsonb,
	"page_url" text,
	"campaign_id" integer,
	"character_id" integer,
	"duration" integer,
	"created_at" text DEFAULT '2026-03-22T13:20:47.561Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_badges" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"badge_id" integer NOT NULL,
	"earned_at" text NOT NULL,
	"context" jsonb DEFAULT '{}'::jsonb,
	"is_featured" boolean DEFAULT false,
	"is_hidden" boolean DEFAULT false
);
--> statement-breakpoint
CREATE TABLE "user_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"felt_confusing" boolean DEFAULT false NOT NULL,
	"felt_slow" boolean DEFAULT false NOT NULL,
	"would_use" boolean DEFAULT false NOT NULL,
	"comment" text,
	"created_at" text DEFAULT '2026-03-22T13:20:47.589Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_session_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"campaign_id" integer NOT NULL,
	"last_login_at" text NOT NULL,
	"last_world_state_hash" text,
	"since_then_bullets" jsonb DEFAULT '[]'::jsonb,
	"bullets_cached_at" text
);
--> statement-breakpoint
CREATE TABLE "user_sessions_analytics" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"session_id" text NOT NULL,
	"started_at" text NOT NULL,
	"ended_at" text,
	"duration_minutes" integer,
	"page_views" integer DEFAULT 0,
	"actions_count" integer DEFAULT 0,
	"dice_rolls" integer DEFAULT 0,
	"ai_requests" integer DEFAULT 0,
	"campaigns_played" jsonb DEFAULT '[]'::jsonb,
	"features_used" jsonb DEFAULT '[]'::jsonb,
	"device_type" text,
	"browser_info" text
);
--> statement-breakpoint
CREATE TABLE "user_world_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"region_id" integer,
	"location_id" integer,
	"has_discovered" boolean DEFAULT false,
	"has_visited" boolean DEFAULT false,
	"completion_percent" integer DEFAULT 0,
	"completion_state" text DEFAULT 'undiscovered',
	"times_visited" integer DEFAULT 0,
	"last_visited_at" text,
	"first_discovered_at" text,
	"completed_at" text,
	"last_session_id" integer,
	"last_campaign_id" integer,
	"player_notes" text,
	"created_at" text DEFAULT '2026-03-22T13:20:47.552Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wander_markers" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"hex_q" integer NOT NULL,
	"hex_r" integer NOT NULL,
	"marker_type" text NOT NULL,
	"title" text NOT NULL,
	"blurb" text,
	"tags" text[],
	"discovered_by" integer NOT NULL,
	"persistence" text DEFAULT 'permanent' NOT NULL,
	"linked_dungeon_id" integer,
	"linked_scene_id" text,
	"linked_faction_id" text,
	"linked_item_id" text,
	"created_at" text DEFAULT '2026-03-22T13:20:47.587Z' NOT NULL,
	"expires_at_tick" integer
);
--> statement-breakpoint
CREATE TABLE "wander_outcome_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer NOT NULL,
	"tick" integer NOT NULL,
	"from_hex_q" integer NOT NULL,
	"from_hex_r" integer NOT NULL,
	"to_hex_q" integer NOT NULL,
	"to_hex_r" integer NOT NULL,
	"outcome_type" text NOT NULL,
	"outcome_payload" jsonb,
	"reward_payload" jsonb,
	"created_at" text DEFAULT '2026-03-22T13:20:47.587Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wander_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"campaign_id" integer NOT NULL,
	"character_id" integer NOT NULL,
	"start_hex_q" integer NOT NULL,
	"start_hex_r" integer NOT NULL,
	"current_hex_q" integer NOT NULL,
	"current_hex_r" integer NOT NULL,
	"tick" integer DEFAULT 0 NOT NULL,
	"fatigue" integer DEFAULT 0 NOT NULL,
	"last_outcome_type" text,
	"status" text DEFAULT 'active' NOT NULL,
	"flags" jsonb,
	"started_at" text DEFAULT '2026-03-22T13:20:47.570Z' NOT NULL,
	"ended_at" text
);
--> statement-breakpoint
CREATE TABLE "world_developments" (
	"id" serial PRIMARY KEY NOT NULL,
	"region_id" integer,
	"campaign_id" integer,
	"title" text NOT NULL,
	"narrative" text NOT NULL,
	"consequence" text,
	"development_type" text NOT NULL,
	"urgency" text DEFAULT 'slow',
	"triggered_by" text,
	"related_patterns" jsonb DEFAULT '[]'::jsonb,
	"dm_decision" text,
	"dm_notes" text,
	"decided_at" text,
	"resolution" text,
	"resolved_at" text,
	"created_at" text DEFAULT '2026-03-22T13:20:47.561Z' NOT NULL,
	"show_after" text
);
--> statement-breakpoint
CREATE TABLE "world_discoveries" (
	"id" serial PRIMARY KEY NOT NULL,
	"region_id" integer,
	"location_id" integer,
	"discovery_type" text DEFAULT 'exploration' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"discovered_by_user_id" integer,
	"discovered_by_character_name" text,
	"source_campaign_id" integer,
	"hex_q" integer,
	"hex_r" integer,
	"terrain_type" text,
	"is_public" boolean DEFAULT true,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" text DEFAULT '2026-03-22T13:20:47.553Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"event_type" text DEFAULT 'narrative' NOT NULL,
	"severity" text DEFAULT 'minor' NOT NULL,
	"affected_region_ids" integer[] DEFAULT '{}',
	"affected_location_ids" integer[] DEFAULT '{}',
	"pressure_effects" jsonb DEFAULT '{}'::jsonb,
	"source_campaign_id" integer,
	"source_character_id" integer,
	"source_character_name" text,
	"trigger_type" text DEFAULT 'narrative' NOT NULL,
	"trigger_detail" text,
	"is_active" boolean DEFAULT true,
	"expires_at" text,
	"created_at" text DEFAULT '2026-03-22T13:20:47.552Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_locations" (
	"id" serial PRIMARY KEY NOT NULL,
	"region_id" integer NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"location_type" text DEFAULT 'landmark' NOT NULL,
	"pos_x" integer DEFAULT 50 NOT NULL,
	"pos_y" integer DEFAULT 50 NOT NULL,
	"icon_type" text DEFAULT 'marker',
	"is_discoverable" boolean DEFAULT true,
	"is_main_quest" boolean DEFAULT false,
	"linked_campaign_id" integer,
	"lore" text,
	"secrets" text,
	"created_at" text DEFAULT '2026-03-22T13:20:47.552Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_memory" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaign_id" integer NOT NULL,
	"memory_type" text NOT NULL,
	"subject" text NOT NULL,
	"narrative" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb,
	"is_resolved" boolean DEFAULT false,
	"revealed_at" text,
	"caused_by_character_id" integer,
	"triggering_event_id" integer,
	"created_at" text DEFAULT '2026-03-22T13:20:47.560Z' NOT NULL,
	"expires_at" text
);
--> statement-breakpoint
CREATE TABLE "world_regions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"region_type" text DEFAULT 'territory' NOT NULL,
	"parent_region_id" integer,
	"grid_x" integer DEFAULT 0 NOT NULL,
	"grid_y" integer DEFAULT 0 NOT NULL,
	"width" integer DEFAULT 1 NOT NULL,
	"height" integer DEFAULT 1 NOT NULL,
	"color" text DEFAULT '#4a5568',
	"icon_type" text DEFAULT 'territory',
	"terrain" text DEFAULT 'plains',
	"danger_level" integer DEFAULT 1,
	"level_range" text DEFAULT '1-5',
	"lore" text,
	"known_for" text,
	"instability" integer DEFAULT 0,
	"danger" integer DEFAULT 0,
	"opportunity" integer DEFAULT 0,
	"mystery" integer DEFAULT 0,
	"current_mood" text DEFAULT 'stable',
	"last_pressure_update" text,
	"created_at" text DEFAULT '2026-03-22T13:20:47.551Z' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world_rumors" (
	"id" serial PRIMARY KEY NOT NULL,
	"region_id" integer,
	"campaign_id" integer,
	"narrative" text NOT NULL,
	"source" text,
	"rumor_type" text NOT NULL,
	"related_faction" text,
	"suggests_instability" boolean DEFAULT false,
	"suggests_danger" boolean DEFAULT false,
	"suggests_opportunity" boolean DEFAULT false,
	"suggests_mystery" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"times_heard" integer DEFAULT 0,
	"last_heard_at" text,
	"generated_from_pattern" text,
	"created_at" text DEFAULT '2026-03-22T13:20:47.561Z' NOT NULL,
	"expires_at" text
);
--> statement-breakpoint
CREATE TABLE "world_whispers" (
	"id" serial PRIMARY KEY NOT NULL,
	"world_event_id" integer NOT NULL,
	"campaign_id" integer NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false,
	"is_dismissed" boolean DEFAULT false,
	"created_at" text DEFAULT '2026-03-22T13:20:47.557Z' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "adventure_elements" ALTER COLUMN "created_at" SET DEFAULT '2026-03-22T13:20:47.542Z';--> statement-breakpoint
ALTER TABLE "adventure_templates" ALTER COLUMN "created_at" SET DEFAULT '2026-03-22T13:20:47.541Z';--> statement-breakpoint
ALTER TABLE "campaign_npcs" ALTER COLUMN "joined_at" SET DEFAULT '2026-03-22T13:20:47.544Z';--> statement-breakpoint
ALTER TABLE "encounters" ALTER COLUMN "created_at" SET DEFAULT '2026-03-22T13:20:47.542Z';--> statement-breakpoint
ALTER TABLE "learning_content" ALTER COLUMN "created_at" SET DEFAULT '2026-03-22T13:20:47.541Z';--> statement-breakpoint
ALTER TABLE "npcs" ALTER COLUMN "created_at" SET DEFAULT '2026-03-22T13:20:47.543Z';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT '2026-03-22T13:20:47.528Z';--> statement-breakpoint
ALTER TABLE "campaign_npcs" ADD COLUMN "current_hp" integer;--> statement-breakpoint
ALTER TABLE "campaign_npcs" ADD COLUMN "max_hp" integer;--> statement-breakpoint
ALTER TABLE "campaign_npcs" ADD COLUMN "armor_class" integer;--> statement-breakpoint
ALTER TABLE "campaign_npcs" ADD COLUMN "attack_bonus" integer DEFAULT 3;--> statement-breakpoint
ALTER TABLE "campaign_npcs" ADD COLUMN "damage_roll" text DEFAULT '1d6+1';--> statement-breakpoint
ALTER TABLE "campaign_npcs" ADD COLUMN "status" text DEFAULT 'conscious';--> statement-breakpoint
ALTER TABLE "campaign_npcs" ADD COLUMN "gold" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "campaign_npcs" ADD COLUMN "inventory" text[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "campaign_npcs" ADD COLUMN "consumables" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "campaign_npcs" ADD COLUMN "death_save_successes" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "campaign_npcs" ADD COLUMN "death_save_failures" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "campaign_sessions" ADD COLUMN "previous_session_result" jsonb;--> statement-breakpoint
ALTER TABLE "campaign_sessions" ADD COLUMN "story_state" jsonb;--> statement-breakpoint
ALTER TABLE "campaign_sessions" ADD COLUMN "dm_narrative" text;--> statement-breakpoint
ALTER TABLE "campaign_sessions" ADD COLUMN "player_choices_made" jsonb;--> statement-breakpoint
ALTER TABLE "campaign_sessions" ADD COLUMN "pending_events" jsonb;--> statement-breakpoint
ALTER TABLE "campaign_sessions" ADD COLUMN "npc_interactions" jsonb;--> statement-breakpoint
ALTER TABLE "campaign_sessions" ADD COLUMN "is_in_combat" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "campaign_sessions" ADD COLUMN "combat_state" jsonb;--> statement-breakpoint
ALTER TABLE "campaign_sessions" ADD COLUMN "quick_content_generated" jsonb;--> statement-breakpoint
ALTER TABLE "campaign_sessions" ADD COLUMN "scene_type" text;--> statement-breakpoint
ALTER TABLE "campaign_sessions" ADD COLUMN "scene_data" jsonb;--> statement-breakpoint
ALTER TABLE "campaign_sessions" ADD COLUMN "previous_scene_type" text;--> statement-breakpoint
ALTER TABLE "campaign_sessions" ADD COLUMN "action_log" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "campaign_length" text DEFAULT 'standard';--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "main_hook" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "total_chapters" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "is_published" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "published_at" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "deployment_code" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "is_private" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "max_players" integer DEFAULT 6;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "world_location_id" integer;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "world_region_id" integer;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "discord_guild_id" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "discord_channel_id" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "discord_thread_id" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "is_discord_deployed" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "session_name" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "session_focus" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "active_pressures" text[];--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "unresolved_thread" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "campaign_question" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "campaign_stakes" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "chapter_gates" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "narrative_log" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "world_state" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "npc_attitudes" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "pressure_meters" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "available_paths" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "global_stakes" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "unreliable_npcs" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "foreclosures" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "normative_residues" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "residue_triggers" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "repair_pathways" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "campaign_instability" text;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "faction_models" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "milestone_thresholds" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "scene_eligibility" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "faction_strengths" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "procedural_quest_config" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "last_procedural_quest_scene" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "villain_model" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "framing_event" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "complications_queue" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "encounter_designs" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "party_goal" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "power_network" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "rival_agent" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "meter_world_effects" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "dynamic_climax" jsonb;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "villain_corruption" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "party_reputation" integer DEFAULT 50;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "world_instability" integer DEFAULT 20;--> statement-breakpoint
ALTER TABLE "campaigns" ADD COLUMN "failure_advancement_log" jsonb;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "status" text DEFAULT 'conscious';--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "death_save_successes" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "death_save_failures" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "equipped_weapon" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "equipped_armor" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "equipped_shield" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "equipped_accessory" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "skill_progress" jsonb DEFAULT '{}'::jsonb;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "gold" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "silver" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "copper" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "platinum" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "consumables" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "death_timestamp" text;--> statement-breakpoint
ALTER TABLE "characters" ADD COLUMN "resurrected_at" text;--> statement-breakpoint
ALTER TABLE "npcs" ADD COLUMN "consumables" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "npcs" ADD COLUMN "gold" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "npcs" ADD COLUMN "equipped_weapon" text;--> statement-breakpoint
ALTER TABLE "npcs" ADD COLUMN "equipped_armor" text;--> statement-breakpoint
ALTER TABLE "npcs" ADD COLUMN "equipped_shield" text;--> statement-breakpoint
ALTER TABLE "npcs" ADD COLUMN "equipped_accessory" text;--> statement-breakpoint
ALTER TABLE "npcs" ADD COLUMN "status" text DEFAULT 'conscious';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "is_admin" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_secret" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "two_factor_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "discord_user_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "discord_username" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "onboarding_state" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "has_completed_demo" boolean DEFAULT false;--> statement-breakpoint
CREATE INDEX "idx_bulletin_posts_user_id" ON "bulletin_posts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_bulletin_responses_post_id" ON "bulletin_responses" USING btree ("post_id");--> statement-breakpoint
CREATE INDEX "idx_bulletin_responses_user_id" ON "bulletin_responses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_dungeon_maps_campaign_id" ON "campaign_dungeon_maps" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_exploration_hexes_campaign_id" ON "campaign_exploration_hexes" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_invitations_campaign_id" ON "campaign_invitations" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_quests_campaign_id" ON "campaign_quests" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_srd_references_campaign_id" ON "campaign_srd_references" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_trace_events_campaign_id" ON "campaign_trace_events" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_capital_exploration_campaign_id" ON "capital_exploration" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_capital_exploration_user_id" ON "capital_exploration" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_character_arc_insights_campaign_id" ON "character_arc_insights" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_character_arc_insights_character_id" ON "character_arc_insights" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "idx_character_inventory_character_id" ON "character_inventory" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "idx_char_reputation_profiles_campaign_id" ON "character_reputation_profiles" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_char_reputation_profiles_character_id" ON "character_reputation_profiles" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "idx_character_spells_character_id" ON "character_spells" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "idx_chat_messages_campaign_id" ON "chat_messages" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_chat_messages_user_id" ON "chat_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_city_maps_campaign_id" ON "city_maps" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_dm_notes_campaign_id" ON "dm_notes" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_dm_session_states_campaign_id" ON "dm_session_states" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_dungeon_node_states_run_id" ON "dungeon_node_states" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_dungeon_rewards_run_id" ON "dungeon_rewards" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_dungeon_rewards_user_id" ON "dungeon_rewards" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_dungeon_runs_campaign_id" ON "dungeon_runs" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_dungeon_runs_user_id" ON "dungeon_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_factions_campaign_id" ON "factions" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_group_messages_group_id" ON "group_messages" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_hex_exploration_states_campaign_id" ON "hex_exploration_states" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_hex_exploration_states_user_id" ON "hex_exploration_states" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_llm_configs_user_id" ON "llm_configs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_milestone_rewards_campaign_id" ON "milestone_rewards" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_milestone_rewards_character_id" ON "milestone_rewards" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "idx_player_bank_campaign_id" ON "player_bank" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_player_bank_character_id" ON "player_bank" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "idx_player_group_members_group_id" ON "player_group_members" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "idx_player_group_members_user_id" ON "player_group_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_player_houses_campaign_id" ON "player_houses" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_player_houses_character_id" ON "player_houses" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "idx_reputation_events_campaign_id" ON "reputation_events" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_reputation_events_character_id" ON "reputation_events" USING btree ("character_id");--> statement-breakpoint
CREATE INDEX "idx_trading_post_reviews_user_id" ON "trading_post_reviews" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_trek_routes_campaign_id" ON "trek_routes" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_trek_routes_user_id" ON "trek_routes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_unresolved_threads_campaign_id" ON "unresolved_threads" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_user_activity_events_user_id" ON "user_activity_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_badges_user_id" ON "user_badges" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_session_tracking_campaign_id" ON "user_session_tracking" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_user_session_tracking_user_id" ON "user_session_tracking" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_analytics_user_id" ON "user_sessions_analytics" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_world_progress_user_id" ON "user_world_progress" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_wander_markers_campaign_id" ON "wander_markers" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_wander_outcome_log_run_id" ON "wander_outcome_log" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "idx_wander_runs_campaign_id" ON "wander_runs" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_wander_runs_user_id" ON "wander_runs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_world_memory_campaign_id" ON "world_memory" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_world_whispers_campaign_id" ON "world_whispers" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_adventure_completions_user_id" ON "adventure_completions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_adventure_completions_campaign_id" ON "adventure_completions" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_npcs_campaign_id" ON "campaign_npcs" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_participants_campaign_id" ON "campaign_participants" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_participants_user_id" ON "campaign_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_campaign_sessions_campaign_id" ON "campaign_sessions" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "idx_characters_user_id" ON "characters" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_dice_rolls_user_id" ON "dice_rolls" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_sessions_user_id" ON "user_sessions" USING btree ("user_id");