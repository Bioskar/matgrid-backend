import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTinCertificate1778344134050 implements MigrationInterface {
    name = 'AddTinCertificate1778344134050'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_0a3afb0117f604ede21112e939"`);
        await queryRunner.query(`ALTER TYPE "public"."kyc_documents_documenttype_enum" RENAME TO "kyc_documents_documenttype_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."kyc_documents_documenttype_enum" AS ENUM('nin_slip', 'drivers_license', 'voters_card', 'cac_certificate', 'tin_certificate')`);
        await queryRunner.query(`ALTER TABLE "kyc_documents" ALTER COLUMN "documentType" TYPE "public"."kyc_documents_documenttype_enum" USING "documentType"::"text"::"public"."kyc_documents_documenttype_enum"`);
        await queryRunner.query(`DROP TYPE "public"."kyc_documents_documenttype_enum_old"`);
        await queryRunner.query(`ALTER TABLE "platform_settings" ALTER COLUMN "platformFeePercent" SET DEFAULT '2.5'`);
        await queryRunner.query(`CREATE INDEX "IDX_0a3afb0117f604ede21112e939" ON "kyc_documents" ("userId", "documentType") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_0a3afb0117f604ede21112e939"`);
        await queryRunner.query(`ALTER TABLE "platform_settings" ALTER COLUMN "platformFeePercent" SET DEFAULT 2.5`);
        await queryRunner.query(`CREATE TYPE "public"."kyc_documents_documenttype_enum_old" AS ENUM('nin_slip', 'drivers_license', 'voters_card', 'cac_certificate')`);
        await queryRunner.query(`ALTER TABLE "kyc_documents" ALTER COLUMN "documentType" TYPE "public"."kyc_documents_documenttype_enum_old" USING "documentType"::"text"::"public"."kyc_documents_documenttype_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."kyc_documents_documenttype_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."kyc_documents_documenttype_enum_old" RENAME TO "kyc_documents_documenttype_enum"`);
        await queryRunner.query(`CREATE INDEX "IDX_0a3afb0117f604ede21112e939" ON "kyc_documents" ("documentType", "userId") `);
    }

}
