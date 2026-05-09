/**
 * Admin User Seed Script
 *
 * Creates the initial admin user if one does not already exist.
 *
 * Usage:
 *   npm run seed:admin
 *
 * Default credentials (change immediately after first login):
 *   Email:    admin@matgrid.com
 *   Password: Admin@matgrid1
 */

import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '../../../.env') });

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'matgrid',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  synchronize: false,
  logging: false,
});

async function seed() {
  await dataSource.initialize();

  const ADMIN_EMAIL = process.env.ADMIN_SEED_EMAIL;
  const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD;

  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('ADMIN_SEED_EMAIL or ADMIN_SEED_PASSWORD is not defined');
  }

  const existing = await dataSource.query(
    `SELECT id FROM users WHERE email = $1 LIMIT 1`,
    [ADMIN_EMAIL],
  );

  if (existing.length > 0) {
    console.log(`Admin user already exists: ${ADMIN_EMAIL}`);
    await dataSource.destroy();
    return;
  }

  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);

  await dataSource.query(
    `INSERT INTO users (id, email, password, "fullName", "userRole", "isActive", "isEmailVerified", "isPhoneVerified", "twoFactorEnabled")
     VALUES (uuid_generate_v4(), $1, $2, $3, $4, true, true, false, false)`,
    [ADMIN_EMAIL, hashedPassword, 'MatGrid Admin', 'admin'],
  );

  console.log(`✓ Admin user created`);
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log(`  Change this password immediately after first login.`);

  await dataSource.destroy();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
