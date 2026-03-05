import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class UpdateOtpEntityForTermii1740800000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Make otp column nullable (for Termii's pinId)
    await queryRunner.changeColumn(
      'user_otps',
      'otp',
      new TableColumn({
        name: 'otp',
        type: 'varchar',
        isNullable: true,
      }),
    );

    // Add pinId column for Termii
    await queryRunner.addColumn(
      'user_otps',
      new TableColumn({
        name: 'pinId',
        type: 'varchar',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove pinId column
    await queryRunner.dropColumn('user_otps', 'pinId');

    // Revert otp column to non-nullable
    await queryRunner.changeColumn(
      'user_otps',
      'otp',
      new TableColumn({
        name: 'otp',
        type: 'varchar',
        isNullable: false,
      }),
    );
  }
}
