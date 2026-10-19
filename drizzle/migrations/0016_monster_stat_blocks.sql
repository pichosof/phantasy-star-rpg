CREATE TABLE IF NOT EXISTS `monster_stat_blocks` (
	`monster_id` integer PRIMARY KEY NOT NULL,
	`blocks` text DEFAULT '[]' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	FOREIGN KEY (`monster_id`) REFERENCES `bestiary`(`id`) ON UPDATE no action ON DELETE cascade
);
