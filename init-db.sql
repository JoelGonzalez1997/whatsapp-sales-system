CREATE TABLE IF NOT EXISTS conversations (
  id SERIAL PRIMARY KEY,
  whatsapp_number VARCHAR(20) NOT NULL UNIQUE,
  customer_name VARCHAR(255),
  customer_city VARCHAR(100),
  customer_address TEXT,
  status VARCHAR(50) DEFAULT 'active',
  conversation_started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  conversation_closed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id),
  whatsapp_number VARCHAR(20) NOT NULL,
  customer_name VARCHAR(255),
  product_name VARCHAR(255) NOT NULL,
  product_quantity INTEGER NOT NULL,
  product_price DECIMAL(10, 2) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  customer_address TEXT,
  customer_city VARCHAR(100),
  campaign_source VARCHAR(100),
  status VARCHAR(50) DEFAULT 'confirmed',
  confirmed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bot_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES conversations(id),
  whatsapp_number VARCHAR(20) NOT NULL,
  message_type VARCHAR(50),
  message_content TEXT,
  direction VARCHAR(20),
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS daily_metrics (
  id SERIAL PRIMARY KEY,
  metric_date DATE NOT NULL UNIQUE,
  total_conversations INTEGER DEFAULT 0,
  total_sales INTEGER DEFAULT 0,
  total_revenue DECIMAL(10, 2) DEFAULT 0,
  conversion_rate DECIMAL(5, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  sku VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  benefits TEXT,
  category VARCHAR(100),
  image_url TEXT,
  base_price DECIMAL(10, 2) NOT NULL,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_offers (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  quantity INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  discount_percent DECIMAL(5, 2) DEFAULT 0,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE VIEW products_with_offers AS
SELECT 
  p.id as product_id,
  p.sku,
  p.name,
  p.description,
  p.benefits,
  p.category,
  p.image_url,
  p.base_price,
  json_agg(
    json_build_object(
      'id', po.id,
      'name', po.name,
      'quantity', po.quantity,
      'price', po.price,
      'discount', po.discount_percent
    ) ORDER BY po.quantity
  ) as offers
FROM products p
LEFT JOIN product_offers po ON p.id = po.product_id AND po.active = true
WHERE p.active = true
GROUP BY p.id, p.sku, p.name, p.description, p.benefits, p.category, p.image_url, p.base_price;

CREATE INDEX IF NOT EXISTS idx_conversations_number ON conversations(whatsapp_number);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);
CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_product_offers_product ON product_offers(product_id);

INSERT INTO products (sku, name, description, benefits, category, base_price)
VALUES 
  ('ORE-001', 'Cápsulas Oil of Oregano', 'Cápsulas de aceite de orégano puro', 'Apoya el sistema inmunológico', 'Suplementos', 25.99),
  ('BAT-001', 'Batana Oil Shampoo', 'Shampoo con aceite de batana', 'Fortalece el cabello', 'Cuidado Capilar', 25.00),
  ('COL-001', 'Colágeno Hidrolizado', 'Colágeno puro hidrolizado', 'Mejora elasticidad de piel', 'Belleza', 22.99)
ON CONFLICT (sku) DO NOTHING;

INSERT INTO product_offers (product_id, name, quantity, price, discount_percent) VALUES
((SELECT id FROM products WHERE sku = 'ORE-001'), 'Pide 1', 1, 25.99, 0),
((SELECT id FROM products WHERE sku = 'ORE-001'), 'Oferta (lleva 2)', 2, 35.99, 30),
((SELECT id FROM products WHERE sku = 'BAT-001'), 'Normal', 1, 25.00, 0),
((SELECT id FROM products WHERE sku = 'BAT-001'), 'Especial', 1, 13.00, 48),
((SELECT id FROM products WHERE sku = 'COL-001'), 'Pide 1', 1, 22.99, 0),
((SELECT id FROM products WHERE sku = 'COL-001'), 'Oferta (lleva 2)', 2, 38.99, 15)
ON CONFLICT DO NOTHING;