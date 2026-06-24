require('dotenv').config();
const express = require('express');
const cors = require('cors');
const DatabaseService = require('./database.service');
const ProductsService = require('./products.service');
const WhatsAppBot = require('./agente1-bot');

const app = express();
const db = new DatabaseService(process.env.DATABASE_URL);
const products = new ProductsService(db);
const bot = new WhatsAppBot(process.env.ANTHROPIC_API_KEY, db, products);

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const authMiddleware = (req, res, next) => {
  const token = req.headers['x-admin-token'];
  if (token !== process.env.ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

app.get('/api/catalog', async (req, res) => {
  try {
    const allProducts = await products.getAllProducts();
    res.json(allProducts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/metrics/realtime', async (req, res) => {
  try {
    const metrics = await db.getRealTimeMetrics();
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/bot/message', async (req, res) => {
  try {
    const { whatsappNumber, message } = req.body;
    if (!whatsappNumber || !message) {
      return res.status(400).json({ error: 'whatsappNumber y message requeridos' });
    }
    const response = await bot.handleMessage(whatsappNumber, message);
    res.json({ response });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/products', authMiddleware, async (req, res) => {
  try {
    const allProducts = await products.getAllProducts();
    res.json(allProducts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/admin/products', authMiddleware, async (req, res) => {
  try {
    const { sku, name, description, benefits, category, base_price } = req.body;
    const query = `
      INSERT INTO products (sku, name, description, benefits, category, base_price)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *;
    `;
    const result = await db.pool.query(query, [sku, name, description, benefits, category, base_price]);
    products.clearCache();
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/stats', authMiddleware, async (req, res) => {
  try {
    const query = `
      SELECT 
        COUNT(*) as total_products,
        COUNT(DISTINCT category) as total_categories,
        AVG(base_price) as avg_price,
        MIN(base_price) as min_price,
        MAX(base_price) as max_price
      FROM products WHERE active = true;
    `;
    const result = await db.pool.query(query);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', async (req, res) => {
  try {
    await db.healthCheck();
    res.json({ status: 'ok' });
  } catch (error) {
    res.status(500).json({ status: 'error' });
  }
});
// ============ OFERTAS ============

app.post('/api/admin/offers', authMiddleware, async (req, res) => {
  try {
    const { product_id, name, quantity, price, discount_percent } = req.body;
    const query = `
      INSERT INTO product_offers (product_id, name, quantity, price, discount_percent)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await db.pool.query(query, [product_id, name, quantity, price, discount_percent || 0]);
    products.clearCache();
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/admin/offers', authMiddleware, async (req, res) => {
  try {
    const query = `
      SELECT po.*, p.name as product_name, p.sku
      FROM product_offers po
      JOIN products p ON po.product_id = p.id
      WHERE po.active = true 
      ORDER BY p.sku, po.quantity;
    `;
    const result = await db.pool.query(query);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============ FIN OFERTAS ============

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ API escuchando en puerto ${PORT}`);
});