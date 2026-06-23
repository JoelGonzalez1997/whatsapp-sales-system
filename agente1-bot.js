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
          botResponse =