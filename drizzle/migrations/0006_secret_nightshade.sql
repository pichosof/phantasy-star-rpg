ALTER TABLE `cities` ADD `coordinates` text;--> statement-breakpoint
ALTER TABLE `cities` ADD `updated_at` integer DEFAULT (unixepoch('now')) NOT NULL;