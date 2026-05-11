import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKycDocumentSide1782315000000 implements MigrationInterface {
  name = 'AddKycDocumentSide1782315000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "kyc_documents" ADD COLUMN IF NOT EXISTS "documentSide" character varying(20) NOT NULL DEFAULT 'front'`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_kyc_user_type_side" ON "kyc_documents" ("userId", "documentType", "documentSide")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_kyc_user_type_side"`);
    await queryRunner.query(`ALTER TABLE "kyc_documents" DROP COLUMN IF EXISTS "documentSide"`);
  }
}
