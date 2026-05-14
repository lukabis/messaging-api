ALTER TABLE "friend_requests" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "friend_requests" ALTER COLUMN "status" SET DEFAULT 'PENDING'::text;--> statement-breakpoint
DROP TYPE "public"."friend_request_status";--> statement-breakpoint
CREATE TYPE "public"."friend_request_status" AS ENUM('PENDING', 'ACCEPTED');--> statement-breakpoint
ALTER TABLE "friend_requests" ALTER COLUMN "status" SET DEFAULT 'PENDING'::"public"."friend_request_status";--> statement-breakpoint
ALTER TABLE "friend_requests" ALTER COLUMN "status" SET DATA TYPE "public"."friend_request_status" USING "status"::"public"."friend_request_status";