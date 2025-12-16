-- Fix contractors and suppliers table schema
-- Run this SQL script in your PostgreSQL database (matgridv2)

-- Drop all indexes for contractors
DROP INDEX IF EXISTS "IDX_25664340f47c92adb3f5ef4062" CASCADE;

-- Drop old contractors table
DROP TABLE IF EXISTS contractors CASCADE;

-- Drop old suppliers table (if it exists with old schema)
DROP TABLE IF EXISTS suppliers CASCADE;

-- TypeORM will recreate these tables with the correct schema on next startup
-- contractors: userId as PrimaryColumn (OneToOne with users)
-- suppliers: userId as PrimaryColumn (OneToOne with users)
