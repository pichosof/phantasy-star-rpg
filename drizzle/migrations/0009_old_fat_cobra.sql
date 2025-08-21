ALTER TABLE `bestiary` ADD `visible` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `cities` ADD `visible` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `lores` ADD `visible` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `map_markers` ADD `visible` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `npcs` ADD `visible` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `players` ADD `visible` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `quests` ADD `visible` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `sessions` ADD `visible` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `timeline_events` ADD `visible` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `worlds` ADD `visible` integer DEFAULT false NOT NULL;