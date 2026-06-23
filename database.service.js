const { Pool } = require('pg');

class DatabaseService {
  constructor(connectionString) {
    this.pool = new Pool({
      connectionString: connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  async initializeConversation(whatsappNumber, customerName = null) {
    const query = `
      INSERT INTO conversations (whatsapp_number, customer_name, status)
      VALUES ($1, $2, 'active')
      ON CONFLICT (whatsapp_number) DO UPDATE
      SET status = 'active', updated_at = CURRENT_TIMESTAMP
      RETURNING *;
    `;
    const result = await this.pool.query(query, [whatsappNumber, customerName]);
    return result.rows[0];
  }

  async getConversationByNumber(whatsappNumber) {
    const query = 'SELECT * FROM conversations WHERE whatsapp_number = $1;';
    const result = await this.pool.query(query, [whatsappNumber]);
    return result.rows[0];
  }

  async createSale(saleData) {
    const {
      conversation_id,
      whatsapp_number,
      customer_name,
      product_name,
      product_quantity,
      product_price,
      total_amount,
      customer_address,
      customer_city,
      campaign_source
    } = saleData;

    const query = `
      INSERT INTO sales (
        conversation_id, whatsapp_number, customer_name, product_name,
        product_quantity, product_price, total_amount, customer_address,
        customer_city, campaign_source, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'confirmed')
      RETURNING *;
    `;

    const result = await this.pool.query(query, [
      conversation_id,
      whatsapp_number,
      customer_name,
      product_name,
      product_quantity,
      product_price,
      total_amount,
      customer_address,
      customer_city,
      campaign_source || 'whatsapp'
    ]);

    return result.rows[0];
  }

  async logBotMessage(whatsappNumber, conversationId, messageType, messageContent, direction) {
    const query = `
      INSERT INTO bot_messages (
        conversation_id, whatsapp_number, message_type, message_content, direction
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *;
    `;
    const result = await this.pool.query(query, [
      conversationId,
      whatsappNumber,
      messageType,
      messageContent,
      direction
    ]);
    return result.rows[0];
  }

  async closeConversation(whatsappNumber, newStatus = 'closed') {
    const query = `
      UPDATE conversations 
      SET status = $2, conversation_closed_at = CURRENT_TIMESTAMP
      WHERE whatsapp_number = $1
      RETURNING *;
    `;
    const result = await this.pool.query(query, [whatsappNumber, newStatus]);
    return result.rows[0];
  }

  async getRealTimeMetrics() {
    const query = `
      SELECT 
        COUNT(DISTINCT c.id) as total_conversations,
        COUNT(DISTINCT s.id) as total_sales,
        COALESCE(SUM(s.total_amount), 0) as total_revenue,
        CASE 
          WHEN COUNT(DISTINCT c.id) > 0 
          THEN ROUND((COUNT(DISTINCT s.id)::DECIMAL / COUNT(DISTINCT c.id)) * 100, 2)
          ELSE 0 
        END as conversion_rate
      FROM conversations c
      LEFT JOIN sales s ON c.id = s.conversation_id;
    `;
    const result = await this.pool.query(query);
    return result.rows[0];
  }

  async healthCheck() {
    const result = await this.pool.query('SELECT NOW();');
    return result.rows[0];
  }
}

module.exports = DatabaseService;