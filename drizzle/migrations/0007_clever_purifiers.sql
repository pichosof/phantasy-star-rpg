ALTER TABLE `lores` ADD `updated_at` integer DEFAULT (unixepoch('now')) NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL;