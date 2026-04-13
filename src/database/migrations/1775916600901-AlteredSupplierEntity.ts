import { MigrationInterface, QueryRunner } from "typeorm";

export class AlteredSupplierEntity1775916600901 implements MigrationInterface {
    name = 'AlteredSupplierEntity1775916600901'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // We do NOT drop pinId because it is used for Termii in the new backend
        await queryRunner.query(`ALTER TABLE "suppliers" ADD "rcNumber" character varying`);
        await queryRunner.query(`ALTER TABLE "suppliers" ADD "tin" character varying`);
        await queryRunner.query(`ALTER TABLE "suppliers" ADD "bankName" character varying`);
        await queryRunner.query(`ALTER TABLE "suppliers" ADD "accountNumber" character varying`);
        await queryRunner.query(`ALTER TABLE "suppliers" ADD "accountName" character varying`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "disputedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "orders" ADD "completedAt" TIMESTAMP`);
        await queryRunner.query(`ALTER TABLE "user_otps" ALTER COLUMN "otp" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "platform_settings" ALTER COLUMN "platformFeePercent" SET DEFAULT '2.5'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "platform_settings" ALTER COLUMN "platformFeePercent" SET DEFAULT 2.5`);
        await queryRunner.query(`ALTER TABLE "user_otps" ALTER COLUMN "otp" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "completedAt"`);
        await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "disputedAt"`);
        await queryRunner.query(`ALTER TABLE "suppliers" DROP COLUMN "accountName"`);
        await queryRunner.query(`ALTER TABLE "suppliers" DROP COLUMN "accountNumber"`);
        await queryRunner.query(`ALTER TABLE "suppliers" DROP COLUMN "bankName"`);
        await queryRunner.query(`ALTER TABLE "suppliers" DROP COLUMN "tin"`);
        await queryRunner.query(`ALTER TABLE "suppliers" DROP COLUMN "rcNumber"`);
    }

}
