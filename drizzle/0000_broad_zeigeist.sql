CREATE TABLE `entries` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`entry_date` text NOT NULL,
	`content` text NOT NULL,
	`mood` integer NOT NULL,
	`energy` integer NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `entries_owner_date_idx` ON `entries` (`owner_email`,`entry_date`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`title` text NOT NULL,
	`due_date` text NOT NULL,
	`due_time` text NOT NULL,
	`priority` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL
);
