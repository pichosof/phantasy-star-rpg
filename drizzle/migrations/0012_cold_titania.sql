CREATE TABLE `library_documents` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`category` text,
	`filename` text NOT NULL,
	`original_name` text NOT NULL,
	`url` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`visible` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `library_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`player_key` text,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
