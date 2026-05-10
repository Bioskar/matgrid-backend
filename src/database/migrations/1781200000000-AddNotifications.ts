import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddNotifications1781200000000 implements MigrationInterface {
  name = 'AddNotifications1781200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('account_welcome', 'security_password_changed', 'quote_received', 'quote_approved', 'payment_successful')`,
    );

    await queryRunner.query(
      `CREATE TABLE "notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "type" "public"."notifications_type_enum" NOT NULL,
        "title" character varying(140) NOT NULL,
        "message" text NOT NULL,
        "metadata" jsonb,
        "isRead" boolean NOT NULL DEFAULT false,
        "readAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id")
      )`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_created" ON "notifications" ("userId", "createdAt")`,
    );

    await queryRunner.query(
      `CREATE INDEX "IDX_notifications_user_read" ON "notifications" ("userId", "isRead")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_notifications_user_read"`);
    await queryRunner.query(`DROP INDEX "public"."IDX_notifications_user_created"`);
    await queryRunner.query(`DROP TABLE "notifications"`);
    await queryRunner.query(`DROP TYPE "public"."notifications_type_enum"`);
  }
}
