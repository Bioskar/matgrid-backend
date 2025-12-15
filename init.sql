CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE INDEX IF NOT EXISTS idx_materials_user_id ON materials(user_id);
CREATE INDEX IF NOT EXISTS idx_quotes_material_id ON quotes(material_id);
CREATE INDEX IF NOT EXISTS idx_supplier_quotes_quote_id ON supplier_quotes(quote_id);
CREATE INDEX IF NOT EXISTS idx_supplier_quotes_supplier_id ON supplier_quotes(supplier_id);
