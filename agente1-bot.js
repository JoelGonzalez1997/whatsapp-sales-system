const Anthropic = require('@anthropic-ai/sdk');

class WhatsAppBot {
  constructor(apiKey, databaseService, productsService) {
    this.client = new Anthropic({ apiKey });
    this.db = databaseService;
    this.products = productsService;
    this.conversationStates = new Map();
  }

  async handleMessage(whatsappNumber, userMessage) {
    try {
      console.log(`📨 [${whatsappNumber}] ${userMessage}`);

      let conversation = await this.db.getConversationByNumber(whatsappNumber);
      if (!conversation) {
        conversation = await this.db.initializeConversation(whatsappNumber);
      }

      if (!this.conversationStates.has(whatsappNumber)) {
        this.conversationStates.set(whatsappNumber, {
          conversationId: conversation.id,
          stage: 'start',
          selectedProduct: null,
          selectedOffer: null,
          shippingData: null
        });
      }

      const state = this.conversationStates.get(whatsappNumber);

      await this.db.logBotMessage(
        whatsappNumber,
        state.conversationId,
        'user_message',
        userMessage,
        'incoming'
      );

      let botResponse = '';

      if (state.stage === 'start') {
        const product = await this.products.findProductByKeywords(userMessage);

        if (product) {
          state.selectedProduct = product;
          state.stage = 'showing_offers';
          botResponse = this.products.formatProductMessage(product);
        } else {
          const allProducts = await this.products.getAllProducts();
          const catalog = allProducts
            .map(p => `• ${p.name} - $${parseFloat(p.base_price).toFixed(2)}\n  ${p.benefits}`)
            .join('\n\n');
          botResponse = `🛍️ Nuestro catálogo:\n\n${catalog}\n\n¿Cuál te interesa?`;
          state.stage = 'product_inquiry';
        }
      } else if (state.stage === 'product_inquiry') {
        const product = await this.products.findProductByKeywords(userMessage);
        if (product) {
          state.selectedProduct = product;
          state.stage = 'showing_offers';
          botResponse = this.products.formatProductMessage(product);
        } else {
          botResponse = 'No encontré ese producto. Intenta con otro nombre.';
        }
      } else if (state.stage === 'showing_offers') {
        const offerMatch = userMessage.match(/\d+/);
        if (offerMatch) {
          const offerIndex = parseInt(offerMatch[0]) - 1;
          if (offerIndex >= 0 && offerIndex < state.selectedProduct.offers.length) {
            state.selectedOffer = state.selectedProduct.offers[offerIndex];
            state.stage = 'awaiting_shipping';
            botResponse = `✅ Perfecto! Llevarás ${state.selectedOffer.quantity} ${state.selectedProduct.name} por $${state.selectedOffer.price.toFixed(2)}.\n\nAhora, envíame:\n1️⃣ Tu nombre\n2️⃣ Ciudad\n3️⃣ Dirección`;
          } else {
            botResponse = `Por favor, elige una oferta válida (1, 2 o 3).`;
          }
        } else {
          botResponse = `Por favor, elige el número de la oferta (1, 2 o 3).`;
        }
      } else if (state.stage === 'awaiting_shipping') {
        const extracted = await this.extractAddress(userMessage);

        if (!extracted.isValid) {
          botResponse = `⚠️ Proporciona nombre, ciudad y dirección completa.`;
        } else {
          state.shippingData = extracted;

          await this.db.createSale({
            conversation_id: state.conversationId,
            whatsapp_number: whatsappNumber,
            customer_name: extracted.name,
            product_name: state.selectedProduct.name,
            product_quantity: state.selectedOffer.quantity,
            product_price: state.selectedOffer.price / state.selectedOffer.quantity,
            total_amount: state.selectedOffer.price,
            customer_address: extracted.address,
            customer_city: extracted.city,
            campaign_source: 'whatsapp'
          });

          await this.db.closeConversation(whatsappNumber, 'completed');

          botResponse = `🎉 ¡Pedido creado exitosamente!\n\n📦 ${state.selectedProduct.name} x${state.selectedOffer.quantity}\n💰 Total: $${state.selectedOffer.price.toFixed(2)}\n\n📍 ${extracted.name}\n${extracted.city}\n${extracted.address}\n\n⏱️ Entrega: 2-4 días hábiles\n🚚 Envío GRATIS\n\n¡Gracias! 🙌`;

          state.stage = 'completed';
        }
      }

      await this.db.logBotMessage(
        whatsappNumber,
        state.conversationId,
        state.stage,
        botResponse,
        'outgoing'
      );

      return botResponse;

    } catch (error) {
      console.error('Error:', error);
      return '❌ Error procesando tu mensaje. Intenta de nuevo.';
    }
  }

  async extractAddress(userMessage) {
    try {
      const message = await this.client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Extrae datos de este mensaje:
"${userMessage}"

Devuelve SOLO JSON:
{"name":"nombre","city":"ciudad","address":"dirección","isValid":true}`
        }]
      });

      const text = message.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { isValid: false };
    } catch (error) {
      console.error('Error:', error);
      return { isValid: false };
    }
  }
}

module.exports = WhatsAppBot;