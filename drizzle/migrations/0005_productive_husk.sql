CREATE TABLE `lore_cities` (
	`lore_id` integer NOT NULL,
	`city_id` integer NOT NULL,
	PRIMARY KEY(`lore_id`, `city_id`),
	FOREIGN KEY (`lore_id`) REFERENCES `lores`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `player_quests` (
	`player_id` integer NOT NULL,
	`quest_id` integer NOT NULL,
	`status` text DEFAULT 'assigned' NOT NULL,
	`assigned_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` integer,
	PRIMARY KEY(`player_id`, `quest_id`),
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`quest_id`) REFERENCES `quests`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `quest_cities` (
	`quest_id` integer NOT NULL,
	`city_id` integer NOT NULL,
	PRIMARY KEY(`quest_id`, `city_id`),
	FOREIGN KEY (`quest_id`) REFERENCES `quests`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`city_id`) REFERENCES `cities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `cities` ADD `world_id` integer REFERENCES worlds(id);