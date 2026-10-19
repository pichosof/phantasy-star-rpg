CREATE TABLE IF NOT EXISTS `session_diaries` (
	`session_id` integer PRIMARY KEY NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
