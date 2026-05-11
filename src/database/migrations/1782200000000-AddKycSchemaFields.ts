import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKycSchemaFields1782200000000 implements MigrationInterface {
  name = 'AddKycSchemaFields1782200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          WHERE t.typname = 'users_usertype_enum'
        ) THEN
          CREATE TYPE "public"."users_usertype_enum" AS ENUM ('individual', 'business');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          WHERE t.typname = 'users_kyctier_enum'
        ) THEN
          CREATE TYPE "public"."users_kyctier_enum" AS ENUM ('not_started', 'tier_1', 'tier_2', 'tier_3');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "userType" "public"."users_usertype_enum" NOT NULL DEFAULT 'individual'`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bvnNumber" character varying`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "kycTier" "public"."users_kyctier_enum" NOT NULL DEFAULT 'not_started'`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "kycCompletedAt" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isBvnVerified" boolean NOT NULL DEFAULT false`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_users_bvn_number_unique" ON "users" ("bvnNumber") WHERE "bvnNumber" IS NOT NULL`);

    await queryRunner.query(`ALTER TYPE "public"."kyc_documents_documenttype_enum" ADD VALUE IF NOT EXISTS 'bvn_verification'`);
    await queryRunner.query(`ALTER TYPE "public"."kyc_documents_documenttype_enum" ADD VALUE IF NOT EXISTS 'utility_bill'`);
    await queryRunner.query(`ALTER TYPE "public"."kyc_documents_documenttype_enum" ADD VALUE IF NOT EXISTS 'bank_statement'`);

    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_type t
          WHERE t.typname = 'kyc_documents_imagequality_enum'
        ) THEN
          CREATE TYPE "public"."kyc_documents_imagequality_enum" AS ENUM ('excellent', 'good', 'acceptable', 'poor', 'illegible');
        END IF;
      END
      $$;
    `);

    await queryRunner.query(`ALTER TABLE "kyc_documents" ADD COLUMN IF NOT EXISTS "issueDate" date`);
    await queryRunner.query(`ALTER TABLE "kyc_documents" ADD COLUMN IF NOT EXISTS "expiryDate" date`);
    await queryRunner.query(`ALTER TABLE "kyc_documents" ADD COLUMN IF NOT EXISTS "imageQuality" "public"."kyc_documents_imagequality_enum"`);
    await queryRunner.query(`ALTER TABLE "kyc_documents" ADD COLUMN IF NOT EXISTS "isExpired" boolean NOT NULL DEFAULT false`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "kyc_documents" DROP COLUMN IF EXISTS "isExpired"`);
    await queryRunner.query(`ALTER TABLE "kyc_documents" DROP COLUMN IF EXISTS "imageQuality"`);
    await queryRunner.query(`ALTER TABLE "kyc_documents" DROP COLUMN IF EXISTS "expiryDate"`);
    await queryRunner.query(`ALTER TABLE "kyc_documents" DROP COLUMN IF EXISTS "issueDate"`);

    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_users_bvn_number_unique"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "isBvnVerified"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "kycCompletedAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "kycTier"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "bvnNumber"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN IF EXISTS "userType"`);

    await queryRunner.query(`DROP TYPE IF EXISTS "public"."kyc_documents_imagequality_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."users_kyctier_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."users_usertype_enum"`);
  }
}
