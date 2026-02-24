import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddRefreshTokenAnd2FA1740378000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add twoFactorEnabled column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'twoFactorEnabled',
        type: 'boolean',
        default: false,
      }),
    );

    // Add refreshToken column
    await queryRunner.addColumn(
      'users',
      new TableColumn({
        name: 'refreshToken',
        type: 'text',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop columns in reverse order
    await queryRunner.dropColumn('users', 'refreshToken');
    await queryRunner.dropColumn('users', 'twoFactorEnabled');
  }
}
