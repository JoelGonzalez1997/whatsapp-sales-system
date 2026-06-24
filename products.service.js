const NodeCache = require('node-cache');

class ProductsService {
  constructor(databaseService) {
    this.db = databaseService;
    this.cache = new NodeCache({ stdTTL: 60 });
  }

async getAllProducts() {
    const cacheKey = 'all_products';
    // const cached = this.cache.get(cacheKey);
    // if (cached) return cached;

    try {
      const query = 'SELECT * FROM products_with_offers ORDER BY name;';
      const result = await this.db.pool.query(query);
      this.cache.set(cacheKey, result.rows);
      return result.rows;
    } catch (error) {
      console.error('Error getting all products:', error);
      return [];
    }
  }

  async searchProducts(searchTerm) {
    try {
      const query = `
        SELECT * FROM products_with_offers 
        WHERE active = true 
        AND (LOWER(name) LIKE LOWER($1) OR LOWER(benefits) LIKE LOWER($1))
        ORDER BY name;
      `;
      const result = await this.db.pool.query(query, [`%${searchTerm}%`]);
      return result.rows;
    } catch (error) {
      console.error('Error searching products:', error);
      return [];
    }
  }

  async findProductByKeywords(keywords) {
    let products = await this.searchProducts(keywords);
    if (products.length > 0) return products[0];
    
    const parts = keywords.split(' ');
    for (const part of parts) {
      products = await this.searchProducts(part);
      if (products.length > 0) return products[0];
    }
    return null;
  }

  formatProductMessage(product) {
    if (!product || !product.offers) return null;

    const offers = product.offers
      .map((offer, idx) => {
        if (offer.discount === 0) {
          return `${idx + 1}. ${offer.name}: ${offer.quantity} por $${parseFloat(offer.price).toFixed(2)}`;
        } else {
          return `${idx + 1}. ${offer.name}: ${offer.quantity} por $${parseFloat(offer.price).toFixed(2)}`;
        }
      })
      .join('\n');

    return `🛍️ ${product.name}\n\n💚 ${product.benefits}\n\n📦 Ofertas:\n${offers}\n\n¿Cuál te gustaría? (1, 2 o 3)`;
  }

  clearCache() {
    this.cache.flushAll();
  }
}

module.exports = ProductsService;