PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_bestiary` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text,
	`habitat` text,
	`image_url` text,
	`image_alt` text,
	`image_mime` text,
	`image_size` integer,
	`weaknesses` text,
	`description` text,
	`discovered` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_bestiary`("id", "name", "type", "habitat", "image_url", "image_alt", "image_mime", "image_size", "weaknesses", "description", "discovered", "created_at") SELECT "id", "name", "type", "habitat", "image_url", "image_alt", "image_mime", "image_size", "weaknesses", "description", "discovered", "created_at" FROM `bestiary`;--> statement-breakpoint
DROP TABLE `bestiary`;--> statement-breakpoint
ALTER TABLE `__new_bestiary` RENAME TO `bestiary`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_cities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`region` text,
	`description` text,
	`discovered` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_cities`("id", "name", "region", "description", "discovered", "created_at") SELECT "id", "name", "region", "description", "discovered", "created_at" FROM `cities`;--> statement-breakpoint
DROP TABLE `cities`;--> statement-breakpoint
ALTER TABLE `__new_cities` RENAME TO `cities`;--> statement-breakpoint
CREATE TABLE `__new_map_markers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text,
	`coordinates` text,
	`description` text,
	`discovered` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch('now') * 1000) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_map_markers`("id", "name", "type", "coordinates", "description", "discovered", "created_at") SELECT "id", "name", "type", "coordinates", "description", "discovered", "created_at" FROM `map_markers`;--> statement-breakpoint
DROP TABLE `map_markers`;--> statement-breakpoint
ALTER TABLE `__new_map_markers` RENAME TO `map_markers`;