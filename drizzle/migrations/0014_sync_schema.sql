CREATE TABLE `dungeon_images` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`dungeon_id` integer NOT NULL,
	`url` text NOT NULL,
	`alt` text,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	FOREIGN KEY (`dungeon_id`) REFERENCES `dungeons`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `dungeons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text,
	`description` text,
	`region` text,
	`coordinates` text,
	`discovered` integer DEFAULT false NOT NULL,
	`visible` integer DEFAULT false NOT NULL,
	`city_id` integer,
	`world_id` integer,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`world_id`) REFERENCES `worlds`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `entity_tags` (
	`tag_id` integer NOT NULL,
	`entity_type` text NOT NULL,
	`entity_id` integer NOT NULL,
	PRIMARY KEY(`tag_id`, `entity_type`, `entity_id`),
	FOREIGN KEY (`tag_id`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `image_focus` (
	`key` text PRIMARY KEY NOT NULL,
	`x` real NOT NULL,
	`y` real NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `player_notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`player_id` integer NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`date` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#1677ff' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);--> statement-breakpoint
ALTER TABLE `npcs` ADD `sheet_url` text;--> statement-breakpoint
ALTER TABLE `npcs` ADD `sheet_mime` text;--> statement-breakpoint
ALTER TABLE `npcs` ADD `sheet_size` integer;