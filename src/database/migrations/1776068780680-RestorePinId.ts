import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class RestorePinId1776068780680 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Check if column exists first to be safe
    const table = await queryRunner.getTable('user_otps');
    const columnExists = table?.columns.some((col) => col.name === 'pinId');

    if (!columnExists) {
      await queryRunner.addColumn(
        'user_otps',
        new TableColumn({
          name: 'pinId',
          type: 'varchar',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('user_otps');
    const columnExists = table?.columns.some((col) => col.name === 'pinId');

    if (columnExists) {
      await queryRunner.dropColumn('user_otps', 'pinId');
    }
  }
}
