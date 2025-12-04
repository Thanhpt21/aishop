import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DedupService } from './dedup.service';
import { OpenAiService } from './openai.service';

interface MatchedAnswer {
  found: boolean;
  answer?: string;
  question?: string;
  confidence: number;
  source: 'exact_match' | 'fuzzy_match' | 'ai_generated';
  metadata?: any;
}

interface ConversationContext {
  lastProducts?: any[];
  lastQuestion?: string;
  lastAnswer?: string;
  productFocus?: string;
  conversationHistory?: Array<{
    role: 'user' | 'assistant';
    content: string;
    products?: any[];
    timestamp?: Date;
  }>;
}

@Injectable()
export class ChatService {
  private conversationContexts: Map<string, ConversationContext> = new Map();

  constructor(
    private prisma: PrismaService,
    private dedup: DedupService,
    private openai: OpenAiService,
  ) {}

  // ============ MAIN HANDLER ============
  async handleChat(body: any) {
    const { conversationId, prompt, metadata, userId, ownerEmail } = body;
    if (!prompt?.trim()) throw new Error('prompt required');

    // 1. Tạo hoặc lấy conversation
    const convId = await this.getOrCreateConversation(conversationId, prompt);

    // 2. Lấy context của CHÍNH conversation này
    const context = await this.getConversationContext(convId);

    // 3. Lưu tin nhắn user
    const userMessage = await this.saveUserMessage(convId, prompt);

    // 4. TÌM CÂU TRẢ LỜI TỐT NHẤT (với context của conversation này)
    const matchedAnswer = await this.findBestAnswer(prompt, metadata, context, convId, ownerEmail);

    // 5. Lưu tin nhắn assistant
    const assistantMessage = await this.saveAssistantMessage(
      convId,
      matchedAnswer.answer!,
      matchedAnswer.source,
      matchedAnswer.metadata
    );

    // 6. Cập nhật context CỦA CONVERSATION NÀY
    this.updateConversationContext(
      convId,
      prompt,
      matchedAnswer.answer!,
      matchedAnswer.metadata?.products || []
    );

    // 7. Trả về response
    const isCached = matchedAnswer.metadata?.cached || false;
    const products = matchedAnswer.metadata?.products || [];
    
    return {
      cached: isCached,
      conversationId: convId,
      response: {
        id: assistantMessage.id,
        text: matchedAnswer.answer,
        source: matchedAnswer.source,
        confidence: matchedAnswer.confidence,
        wordCount: this.countWords(matchedAnswer.answer!),
        products: products,
      },
      usage: isCached ? {} : (matchedAnswer.metadata?.usage || {}),
    };
  }

  // ============ CONTEXT MANAGEMENT (PER CONVERSATION) ============
  private async getConversationContext(conversationId: string): Promise<ConversationContext> {
    // Kiểm tra cache trước
    if (this.conversationContexts.has(conversationId)) {
      return this.conversationContexts.get(conversationId)!;
    }

    // Lấy lịch sử TỪ CHÍNH conversationId NÀY
    const messages = await this.prisma.message.findMany({
      where: { 
        conversationId: conversationId
      },
      orderBy: { createdAt: 'asc' },
      take: 8,
    });

    console.log(`📝 Loaded ${messages.length} messages for conversation ${conversationId}`);

    const context: ConversationContext = {
      conversationHistory: messages.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        products: (msg.metadata as any)?.products || [],
        timestamp: msg.createdAt
      }))
    };

    // Tìm tin nhắn assistant gần nhất TRONG CONVERSATION NÀY
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    const lastAssistantMsg = assistantMessages[assistantMessages.length - 1];
    
    if (lastAssistantMsg) {
      const metadata = lastAssistantMsg.metadata as any;
      if (metadata?.products?.length > 0) {
        context.lastProducts = metadata.products;
        context.productFocus = metadata.products[0].id;
      }
      context.lastAnswer = lastAssistantMsg.content;
    }

    // Tìm tin nhắn user gần nhất TRONG CONVERSATION NÀY
    const userMessages = messages.filter(m => m.role === 'user');
    const lastUserMsg = userMessages[userMessages.length - 1];
    
    if (lastUserMsg) {
      context.lastQuestion = lastUserMsg.content;
    }

    // Lưu vào cache
    this.conversationContexts.set(conversationId, context);
    
    console.log(`✅ Context loaded for conversation ${conversationId}:`, {
      hasLastProducts: !!context.lastProducts?.length,
      lastQuestion: context.lastQuestion?.substring(0, 50),
      historyLength: context.conversationHistory?.length
    });

    return context;
  }

  private updateConversationContext(
    conversationId: string, 
    userMessage: string, 
    assistantMessage: string, 
    products: any[]
  ) {
    const context = this.conversationContexts.get(conversationId) || {
      conversationHistory: []
    };
    
    // Cập nhật context mới nhất
    context.lastQuestion = userMessage;
    context.lastAnswer = assistantMessage;
    context.lastProducts = products;
    
    if (products.length > 0) {
      context.productFocus = products[0].id;
    }

    // Thêm vào lịch sử
    if (!context.conversationHistory) {
      context.conversationHistory = [];
    }
    
    context.conversationHistory.push({
      role: 'user',
      content: userMessage,
      timestamp: new Date()
    });
    
    context.conversationHistory.push({
      role: 'assistant',
      content: assistantMessage,
      products: products,
      timestamp: new Date()
    });

    // Giữ chỉ 10 tin nhắn gần nhất (5 cặp Q-A)
    if (context.conversationHistory.length > 10) {
      context.conversationHistory = context.conversationHistory.slice(-10);
    }

    this.conversationContexts.set(conversationId, context);
    
    console.log(`🔄 Context updated for conversation ${conversationId}`);
  }

  // ============ TÌM CÂU TRẢ LỜI TỐT NHẤT (VỚI CONTEXT ĐÚNG CONVERSATION) ============
  private async findBestAnswer(
    prompt: string, 
    metadata?: any,
    context?: ConversationContext,
    conversationId?: string,
    ownerEmail?: string
  ): Promise<MatchedAnswer> {
    
    const normalized = this.normalizeText(prompt);
    
    console.log(`🔍 [${conversationId}] Finding answer for: "${prompt.substring(0, 50)}..."`, {
      hasContext: !!context?.lastProducts,
      contextProducts: context?.lastProducts?.length || 0,
      ownerEmail: ownerEmail
    });

    // ============ KIỂM TRA SLUG TRONG PROMPT ============
    const extractedSlug = this.extractSlugFromPrompt(prompt);
    if (extractedSlug) {
      console.log(`🏷️  [${conversationId}] Detected slug in prompt: "${extractedSlug}"`);
      const productBySlug = await this.findProductBySlug(extractedSlug, ownerEmail);
      if (productBySlug) {
        console.log(`✅ [${conversationId}] Found product by slug: "${productBySlug.name}"`);
        
        // Tạo prompt mới thêm thông tin sản phẩm vào
        const enhancedPrompt = `${prompt}\n\n[SẢN PHẨM: ${productBySlug.name}]`;
        const generatedPrompt = this.createPromptForAI(enhancedPrompt, productBySlug);
        console.log(`💬 Generated prompt with product slug:\n${generatedPrompt}`);
        
        const aiResponse = await this.generateProductDetailAnswer(
          enhancedPrompt, 
          productBySlug, 
          metadata, 
          context
        );
        
        return {
          found: true,
          answer: aiResponse.text,
          confidence: 0.95,
          source: 'ai_generated',
          metadata: { 
            cached: false,
            usage: aiResponse.usage || {},
            products: aiResponse.products || []
          },
        };
      }
    }

    // ============ KIỂM TRA FOLLOW-UP QUESTIONS (CHỈ TRONG CONVERSATION NÀY) ============
    if (context && conversationId) {
      const followUpMatch = await this.checkFollowUpQuestion(
        prompt, 
        normalized, 
        context, 
        conversationId
      );
      if (followUpMatch.found) {
        console.log(`🔄 [${conversationId}] Follow-up question detected`);
        return followUpMatch;
      }
    }

    // ============ KIỂM TRA CÂU HỎI SẢN PHẨM CỤ THỂ ============
    const isProductQuestion = this.isProductQuestion(normalized);
    if (isProductQuestion) {
      console.log(`🎯 [${conversationId}] Detected product-specific question`);
      
      const specificProduct = await this.findSpecificProduct(normalized, ownerEmail);
      if (specificProduct) {
        console.log(`🔍 [${conversationId}] Found specific product: "${specificProduct.name}"`);
        const aiResponse = await this.generateProductDetailAnswer(
          prompt, 
          specificProduct, 
          metadata, 
          context
        );
        
        return {
          found: true,
          answer: aiResponse.text,
          confidence: 0.85,
          source: 'ai_generated',
          metadata: { 
            cached: false,
            usage: aiResponse.usage || {},
            products: aiResponse.products || []
          },
        };
      } else {
        // Nếu không tìm được product cụ thể, tìm related products
        console.log(`🔍 [${conversationId}] Searching for related products...`);
        const relevantProducts = await this.findRelevantProducts(normalized, ownerEmail);
        if (relevantProducts.length > 0) {
          console.log(`✅ [${conversationId}] Found ${relevantProducts.length} related products`);
          const aiResponse = await this.generateAIAnswerWithUsage(
            prompt, 
            normalized, 
            metadata, 
            context,
            ownerEmail
          );
          
          return {
            found: true,
            answer: aiResponse.text,
            confidence: 0.8,
            source: 'ai_generated',
            metadata: { 
              cached: false,
              usage: aiResponse.usage || {},
              products: aiResponse.products || []
            },
          };
        }
      }
    }

  // ============ GENERATE NEW ANSWER ============
    console.log(`💬 [${conversationId}] Calling AI...`);
    const aiResponse = await this.generateAIAnswerWithUsage(
      prompt, 
      normalized, 
      metadata, 
      context,
      ownerEmail
    );

    return {
      found: true,
      answer: aiResponse.text,
      confidence: 0.8,
      source: 'ai_generated',
      metadata: { 
        cached: false,
        usage: aiResponse.usage || {},
        products: aiResponse.products || []
      },
    };
  }

  // ============ CHECK FOLLOW-UP QUESTION (CHỈ XÉT TRONG CONVERSATION HIỆN TẠI) ============
  private async checkFollowUpQuestion(
    originalPrompt: string,
    normalizedPrompt: string,
    context?: ConversationContext,
    conversationId?: string
  ): Promise<MatchedAnswer> {
    
    if (!context?.lastProducts?.length) {
      return { found: false, confidence: 0, source: 'ai_generated' };
    }

    // Chỉ xét follow-up nếu có sản phẩm đã nói trong conversation này
    const followUpKeywords = [
      'nó', 'cái này', 'sản phẩm này', 'áo này', 'quần này', 
      'cái đó', 'thế còn', 'còn', 'thế', 'vậy',
      'giá', 'chất liệu', 'size', 'màu', 'có không',
      'như thế nào', 'ra sao', 'được không', 'thì sao'
    ];

    const keywords = this.extractKeywords(normalizedPrompt);
    const isFollowUp = keywords.some(kw => 
      followUpKeywords.some(followUp => kw.includes(followUp))
    ) || normalizedPrompt.length < 20;

    if (!isFollowUp) {
      return { found: false, confidence: 0, source: 'ai_generated' };
    }

    console.log(`🔄 [${conversationId}] Detected follow-up question about previous product`);

    // Lấy sản phẩm ĐANG ĐƯỢC NÓI ĐẾN TRONG CONVERSATION NÀY
    const currentProductId = context.productFocus;
    let targetProduct = context.lastProducts?.[0];

    if (currentProductId && context.lastProducts) {
      targetProduct = context.lastProducts.find(p => p.id === currentProductId) || targetProduct;
    }

    if (!targetProduct) {
      return { found: false, confidence: 0, source: 'ai_generated' };
    }

    // Lấy lịch sử CỦA CONVERSATION NÀY
    const historyContext = context.conversationHistory 
      ? this.formatConversationHistory(context.conversationHistory.slice(-4))
      : '';

    // Tạo prompt với context CỦA CONVERSATION NÀY
    let promptContext = `[CONVERSATION ID: ${conversationId}]

CUỘC HỘI THOẠI TRƯỚC ĐÓ TRONG PHIÊN NÀY:
${historyContext}

THÔNG TIN SẢN PHẨM ĐANG ĐƯỢC THẢO LUẬN:
TÊN: ${targetProduct.name}
GIÁ: ${this.formatPrice(targetProduct.price)}

CÂU HỎI TIẾP THEO: "${originalPrompt}"

Hãy trả lời câu hỏi này như một phần tiếp theo của cuộc trò chuyện trên.
TRẢ LỜI NGẮN GỌN (40-60 từ), TẬP TRUNG vào câu hỏi cụ thể.

TRẢ LỜI:`;

    const aiResponse = await this.openai.callOpenAI(promptContext, {
      maxTokens: 120,
      temperature: 0.4,
    });

    return {
      found: true,
      answer: aiResponse.text,
      confidence: 0.85,
      source: 'ai_generated',
      metadata: { 
        cached: false,
        usage: aiResponse.usage || {},
        products: [targetProduct]
      },
    };
  }

  // ============ GENERATE AI WITH USAGE TRACKING ============
  private async generateAIAnswerWithUsage(
    originalPrompt: string,
    normalizedPrompt: string,
    metadata?: any,
    context?: ConversationContext,
    ownerEmail?: string
  ): Promise<{ text: string; usage: any; products?: any[] }> {
    // LẤY CONTEXT TỪ DATABASE
    const relevantProducts = await this.findRelevantProducts(normalizedPrompt, ownerEmail);
    const relevantQAs = await this.findSimilarQAs(normalizedPrompt, 3);

    console.log(`\n================================================================================`);
    console.log(`📦 DANH SÁCH SẢN PHẨM DÙNG CHO AI:`);
    if (relevantProducts.length > 0) {
      relevantProducts.forEach((p, idx) => {
        console.log(`${idx + 1}. ${p.name} (ID: ${p.id}, Slug: ${p.slug}, Giá: ${p.price}đ)`);
        if (p.description) {
          console.log(`   Mô tả: ${p.description.substring(0, 100)}...`);
        }
      });
    } else {
      console.log(`❌ KHÔNG TÌM THẤY SẢN PHẨM LIÊN QUAN`);
    }
    console.log(`================================================================================\n`);

    // TẠO CONTEXT CHO AI (có thể thêm context conversation nếu cần)
    let contextPrompt = '';
    if (context?.conversationHistory?.length) {
      const recentHistory = context.conversationHistory.slice(-4);
      contextPrompt = `LỊCH SỬ TRÒ CHUYỆN GẦN ĐÂY:\n${this.formatConversationHistory(recentHistory)}\n\n`;
    }

    let promptContext = `${contextPrompt}Bạn là trợ lý tư vấn thời trang chuyên nghiệp.

NGUYÊN TẮC TRẢ LỜI:
1. Trả lời NGẮN GỌN, DỄ HIỂU, TẬP TRUNG vào câu hỏi
2. Chỉ đưa thông tin LIÊN QUAN TRỰC TIẾP đến câu hỏi
3. Không lan man, không thêm thông tin không cần thiết
4. Nếu có sản phẩm phù hợp, giới thiệu TỐI ĐA 2-3 sản phẩm và NHẮC ĐẾN TÊN SẢN PHẨM CHÍNH XÁC

`;

    // Thêm sản phẩm liên quan (nếu có)
    if (relevantProducts.length > 0) {
      promptContext += `SẢN PHẨM LIÊN QUAN:\n`;
      relevantProducts.slice(0, 3).forEach((p, i) => {
        promptContext += `${i + 1}. ${p.name} - ${this.formatPrice(p.price)}\n`;
        if (p.description) promptContext += `   ${p.description.substring(0, 100)}...\n`;
      });
      promptContext += '\n';
    }

    // Thêm Q&A tham khảo (nếu có)
    if (relevantQAs.length > 0) {
      promptContext += `CÂU HỎI TƯƠNG TỰ ĐÃ TRẢ LỜI:\n`;
      relevantQAs.forEach((qa, i) => {
        promptContext += `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}\n\n`;
      });
    }

    promptContext += `CÂU HỎI CỦA KHÁCH HÀNG: ${originalPrompt}

TRẢ LỜI (tối đa 50 từ, NHẮC TÊN SẢN PHẨM nếu có):`;

    // In ra prompt final
    console.log(`\n================================================================================`);
    console.log(`💬 FINAL PROMPT SENT TO AI:`);
    console.log(`================================================================================`);
    console.log(promptContext);
    console.log(`================================================================================\n`);

    // GỌI AI
    const aiResponse = await this.openai.callOpenAI(promptContext, {
      ...(metadata || {}),
      maxTokens: 150,
      temperature: 0.7,
    });

    // Trả về kèm thông tin sản phẩm để client xử lý
    return {
      text: aiResponse.text,
      usage: aiResponse.usage || {},
      products: relevantProducts.length > 0 
        ? relevantProducts.slice(0, 3).map(p => ({
            id: p.id,
            name: p.name,
            slug: p.slug,
            price: p.price,
            description: p.description
          }))
        : []
    };
  }

  // ============ GENERATE PRODUCT DETAIL ANSWER ============
  private async generateProductDetailAnswer(
    originalPrompt: string,
    product: any,
    metadata?: any,
    context?: ConversationContext
  ): Promise<{ text: string; usage: any; products?: any[] }> {
    
    // Tạo prompt đặc biệt cho phân tích sản phẩm
    let contextPrompt = '';
    if (context?.conversationHistory?.length) {
      const recentHistory = context.conversationHistory.slice(-2);
      contextPrompt = `LỊCH SỬ TRÒ CHUYỆN:\n${this.formatConversationHistory(recentHistory)}\n\n`;
    }

    let promptContext = `${contextPrompt}Bạn là chuyên gia tư vấn sản phẩm thời trang. 
Hãy phân tích THÔNG TIN SẢN PHẨM dưới đây và trả lời câu hỏi của khách hàng.

THÔNG TIN SẢN PHẨM:
TÊN: ${product.name}
GIÁ: ${this.formatPrice(product.price)}
MÔ TẢ: ${product.description.substring(0, 2000)}... [đã rút gọn]

`;

    // Kiểm tra loại câu hỏi
    const normalizedPrompt = this.normalizeTextForMatching(originalPrompt);
    
    if (normalizedPrompt.includes('chất liệu') || normalizedPrompt.includes('vải') || normalizedPrompt.includes('làm bằng')) {
      promptContext += `HÃY TẬP TRUNG TRẢ LỜI VỀ CHẤT LIỆU VẢI CỦA SẢN PHẨM\n`;
    } 
    else if (normalizedPrompt.includes('giá') || normalizedPrompt.includes('bao nhiêu tiền') || normalizedPrompt.includes('giá cả')) {
      promptContext += `HÃY TẬP TRUNG TRẢ LỜI VỀ GIÁ CẢ VÀ GIÁ TRỊ SẢN PHẨM\n`;
    }
    else if (normalizedPrompt.includes('size') || normalizedPrompt.includes('kích thước') || normalizedPrompt.includes('form dáng')) {
      promptContext += `HÃY TẬP TRUNG TRẢ LỜI VỀ KÍCH THƯỚC VÀ FORM DÁNG\n`;
    }
    else if (normalizedPrompt.includes('phù hợp') || normalizedPrompt.includes('dành cho') || normalizedPrompt.includes('ai mặc')) {
      promptContext += `HÃY TẬP TRUNG TRẢ LỜI VỀ ĐỐI TƯỢNG PHÙ HỢP\n`;
    }
    else if (normalizedPrompt.includes('ưu điểm') || normalizedPrompt.includes('tốt') || normalizedPrompt.includes('nổi bật')) {
      promptContext += `HÃY TẬP TRUNG TRẢ LỜI VỀ ƯU ĐIỂM VÀ ĐIỂM NỔI BẬT\n`;
    }
    else if (normalizedPrompt.includes('bảo quản') || normalizedPrompt.includes('giặt') || normalizedPrompt.includes('sử dụng')) {
      promptContext += `HÃY TẬP TRUNG TRẢ LỜI VỀ CÁCH BẢO QUẢN VÀ SỬ DỤNG\n`;
    }

    promptContext += `
CÂU HỎI CỦA KHÁCH HÀNG: "${originalPrompt}"

YÊU CẦU TRẢ LỜI:
1. Dựa HOÀN TOÀN vào thông tin sản phẩm trên
2. Trả lời NGẮN GỌN, SÚC TÍCH (tối đa 80 từ)
3. Tập trung vào yêu cầu cụ thể của khách hàng
4. KHÔNG bịa thêm thông tin ngoài mô tả
5. Nếu không tìm thấy thông tin, nói rõ "Theo mô tả sản phẩm không đề cập cụ thể về..."

TRẢ LỜI:`;

    // GỌI AI
    const aiResponse = await this.openai.callOpenAI(promptContext, {
      ...(metadata || {}),
      maxTokens: 200,
      temperature: 0.3,
    });

    return {
      text: aiResponse.text,
      usage: aiResponse.usage || {},
      products: [{
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        description: product.description
      }]
    };
  }

  // ============ KIỂM TRA CÂU HỎI SẢN PHẨM ============
  private isProductQuestion(normalizedPrompt: string): boolean {
    const productKeywords = [
      'áo', 'quần', 'váy', 'đầm', 'giày', 'dép', 'túi', 'ví',
      'thun', 'sơmi', 'khoác', 'hoodie', 'jean', 'tây', 'short',
      'jogger', 'polo', 'tanktop', 'vest', 'len', 'sản phẩm', 'món',
      'vớ', 'tất', 'dây', 'tay', 'cổ', 'mũ', 'nón', 'khăn', 'đồng hồ',
      'giặc', 'tăng', 'gối', 'nệm', 'gương', 'bàn chải'
    ];
    
    const questionWords = ['gì', 'nào', 'sao', 'thế nào', 'ra sao', 'tư vấn'];
    
    const keywords = this.extractKeywords(normalizedPrompt);
    const hasProductKeyword = keywords.some(kw => 
      productKeywords.some(term => kw.includes(term))
    );
    
    const hasQuestionWord = keywords.some(kw =>
      questionWords.some(term => kw.includes(term))
    ) || normalizedPrompt.includes('tư vấn'); // Hỗ trợ "tư vấn" trực tiếp
    
    return hasProductKeyword && hasQuestionWord;
  }

  // ============ TÌM SẢN PHẨM CỤ THỂ ============
  private async findSpecificProduct(normalizedPrompt: string, ownerEmail?: string): Promise<any | null> {
    const normalizedForMatch = this.normalizeTextForMatching(normalizedPrompt);
    
    // Tìm theo tên, slug, hoặc category
    const where: any = {
      isActive: true,
      OR: [
        { 
          name: { 
            contains: normalizedForMatch,
            mode: 'insensitive' 
          } 
        },
        { 
          slug: { 
            contains: normalizedForMatch.replace(/\s+/g, '-'),
            mode: 'insensitive' 
          } 
        },
        { 
          category: { 
            contains: normalizedForMatch,
            mode: 'insensitive' 
          } 
        },
      ],
    };
    
    // Filter by ownerEmail nếu có
    if (ownerEmail) {
      where.ownerEmail = ownerEmail;
    }
    
    const products = await this.prisma.product.findMany({
      where,
      take: 1,
    });

    return products.length > 0 ? products[0] : null;
  }

  // ============ KIỂM TRA VÀ TRÍCH XUẤT SLUG TỪ PROMPT ============
  private extractSlugFromPrompt(prompt: string): string | null {
    // Pattern: tìm các từ được nối với dấu gạch ngang như: ao-nam-icod, quan-jean-xanh, etc.
    const slugPattern = /\b[a-z0-9]+(?:-[a-z0-9]+)+\b/gi;
    const matches = prompt.match(slugPattern);
    
    if (matches && matches.length > 0) {
      // Lấy slug dài nhất hoặc phù hợp nhất
      const slug = matches[0].toLowerCase();
      console.log(`🔍 Extracted slug from prompt: "${slug}"`);
      return slug;
    }
    
    return null;
  }

  // ============ TÌM SẢN PHẨM THEO SLUG ============
  private async findProductBySlug(slug: string, ownerEmail?: string): Promise<any | null> {
    try {
      const where: any = {
        slug: {
          equals: slug,
          mode: 'insensitive'
        },
        isActive: true
      };
      
      // Filter by ownerEmail nếu có
      if (ownerEmail) {
        where.ownerEmail = ownerEmail;
      }
      
      const product = await this.prisma.product.findFirst({
        where
      });
      
      if (product) {
        console.log(`✅ Found product by slug "${slug}": ${product.name}`);
      }
      
      return product || null;
    } catch (error) {
      console.error(`❌ Error finding product by slug "${slug}":`, error.message);
      return null;
    }
  }

  // ============ TẠO PROMPT VỚI THÔNG TIN SẢN PHẨM VÀ SLUG ============
  private createPromptForAI(userPrompt: string, product: any): string {
    return `Bạn là chuyên gia tư vấn sản phẩm thời trang.

THÔNG TIN SẢN PHẨM ĐƯỢC TRỎ ĐẾN:
- TÊN: ${product.name}
- SLUG: ${product.slug}
- GIÁ: ${this.formatPrice(product.price)}
- MÔ TẢ: ${product.description ? product.description.substring(0, 500) : 'Không có mô tả'}

CÂU HỎI CỦA KHÁCH HÀNG: ${userPrompt}

Hãy trả lời dựa trên thông tin sản phẩm được chỉ định ở trên.`;
  }

  // ============ HELPER FUNCTIONS ============
  
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ');
  }

  private normalizeTextForMatching(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractKeywords(text: string): string[] {
    const stopWords = new Set([
      'có', 'và', 'là', 'của', 'cho', 'với', 'như', 'từ', 'được',
      'một', 'các', 'hay', 'hoặc', 'nếu', 'thì', 'mà', 'ở', 'trong',
      'bạn', 'tôi', 'shop', 'bán', 'mua', 'nào', 'gì', 'ạ', 'vậy',
    ]);

    return text
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word));
  }

  private extractProductKeywords(text: string): string[] {
    const productTerms = [
      'áo', 'quần', 'váy', 'đầm', 'giày', 'dép', 'túi', 'ví',
      'thun', 'sơmi', 'khoác', 'hoodie', 'jean', 'tây', 'short',
      'jogger', 'polo', 'tanktop', 'vest', 'len',
      'vớ', 'tất', 'dây', 'tay', 'cổ', 'mũ', 'nón', 'khăn', 'đồng hồ',
      'giặc', 'tăng', 'gối', 'nệm', 'gương', 'bàn chải', 'găng tay'
    ];

    const keywords = this.extractKeywords(text);
    return keywords.filter(kw => 
      productTerms.some(term => kw.includes(term) || term.includes(kw))
    );
  }

  private calculateKeywordOverlap(keywords1: string[], keywords2: string[]): number {
    if (keywords1.length === 0 || keywords2.length === 0) return 0;

    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));

    return intersection.size / Math.max(set1.size, set2.size);
  }

  private formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  }

  private formatConversationHistory(history: Array<{role: string, content: string}>): string {
    if (!history || history.length === 0) return '(Chưa có lịch sử trò chuyện)';
    
    return history.map((msg, index) => {
      const prefix = msg.role === 'user' ? 'KHÁCH HÀNG' : 'TRỢ LÝ';
      const content = msg.content.length > 100 
        ? msg.content.substring(0, 100) + '...' 
        : msg.content;
      return `${prefix}: ${content}`;
    }).join('\n');
  }

  // ============ SAVE FUNCTIONS ============
  
  private async getOrCreateConversation(conversationId: string | undefined, prompt: string): Promise<string> {
    if (conversationId) return conversationId;

    const conv = await this.prisma.conversation.create({
      data: {
        tags: [],
        title: prompt.substring(0, 50) + (prompt.length > 50 ? '...' : ''),
      },
    });
    return conv.id;
  }

  private async saveUserMessage(conversationId: string, content: string) {
    return this.prisma.message.create({
      data: {
        conversationId,
        role: 'user',
        content,
        source: 'user',
        tokens: content.split(/\s+/).length,
      },
    });
  }

  private async saveAssistantMessage(
    conversationId: string,
    content: string,
    source: string,
    metadata: any
  ) {
    return this.prisma.message.create({
      data: {
        conversationId,
        role: 'assistant',
        content,
        source,
        tokens: content.split(/\s+/).length,
        metadata: {
          ...metadata,
          products: metadata?.products || [],
        },
      },
    });
  }

  // Cache disabled - no longer saving responses
  private async saveToCache(hash: string, content: string, usage: any = {}, products: any[] = []) {
    // Cache functionality disabled
  }

  // ============ HELPER FUNCTION FOR WORD COUNT ============
  private countWords(text: string): number {
    if (!text) return 0;
    return text.trim().split(/\s+/).length;
  }

// ============ TÌM SẢN PHẨM LIÊN QUAN (OPTIMIZED) ============
private async findRelevantProducts(normalizedPrompt: string, ownerEmail?: string): Promise<any[]> {
  const keywords = this.extractProductKeywords(normalizedPrompt);
  
  console.log(`\n🔍 DEBUG findRelevantProducts:`);
  console.log(`   Input: "${normalizedPrompt}"`);
  console.log(`   Extracted keywords: [${keywords.join(', ')}]`);
  console.log(`   ownerEmail: ${ownerEmail}`);
  
  if (keywords.length === 0) {
    console.log(`   ⚠️  No keywords found - searching all products`);
    // Nếu không có keyword cụ thể, lấy sản phẩm mới nhất
    const where: any = { isActive: true };
    if (ownerEmail) where.ownerEmail = ownerEmail;
    
    const products = await this.prisma.product.findMany({
      where,
      take: 3,
      orderBy: { createdAt: 'desc' },
    });
    
    console.log(`   📦 Returned ${products.length} latest products`);
    return products;
  }

  // ============ BƯỚC 1: TÌM EXACT MATCH (ƯU TIÊN CAO NHẤT) ============
  const exactMatches: any[] = [];
  
  for (const keyword of keywords) {
    const where: any = {
      isActive: true,
      OR: [
        { name: { equals: keyword, mode: 'insensitive' } },
        { category: { equals: keyword, mode: 'insensitive' } },
      ],
    };
    
    if (ownerEmail) where.ownerEmail = ownerEmail;
    
    const exact = await this.prisma.product.findMany({
      where,
      take: 2,
    });
    
    if (exact.length > 0) {
      console.log(`   ✅ EXACT match for "${keyword}": ${exact.map(p => p.name).join(', ')}`);
      exactMatches.push(...exact);
    }
  }

  // Nếu có exact match, ưu tiên trả về
  if (exactMatches.length > 0) {
    const uniqueProducts = this.deduplicateProducts(exactMatches);
    console.log(`   🎯 Returning ${uniqueProducts.length} EXACT matches`);
    return uniqueProducts.slice(0, 5);
  }

  // ============ BƯỚC 2: TÌM PARTIAL MATCH (CONTAINS) ============
  const partialMatches: any[] = [];
  
  for (const keyword of keywords) {
    const where: any = {
      isActive: true,
      OR: [
        { name: { contains: keyword, mode: 'insensitive' } },
        { category: { contains: keyword, mode: 'insensitive' } },
        { description: { contains: keyword, mode: 'insensitive' } },
      ],
    };
    
    if (ownerEmail) where.ownerEmail = ownerEmail;
    
    const partial = await this.prisma.product.findMany({
      where,
      take: 3,
    });
    
    if (partial.length > 0) {
      console.log(`   ✅ PARTIAL match for "${keyword}": ${partial.map(p => p.name).join(', ')}`);
      partialMatches.push(...partial);
    }
  }

  if (partialMatches.length > 0) {
    const uniqueProducts = this.deduplicateProducts(partialMatches);
    console.log(`   📦 Returning ${uniqueProducts.length} PARTIAL matches`);
    return uniqueProducts.slice(0, 5);
  }

  // ============ BƯỚC 3: FUZZY SEARCH (TÌM GẦN ĐÚNG) ============
  console.log(`   🔄 No direct matches, trying fuzzy search...`);
  
  const where: any = { isActive: true };
  if (ownerEmail) where.ownerEmail = ownerEmail;
  
  const allProducts = await this.prisma.product.findMany({
    where,
    take: 20, // Lấy nhiều hơn để filter
  });

  // Score và rank sản phẩm
  const scoredProducts = allProducts.map(product => {
    let score = 0;
    const nameWords = this.normalizeText(product.name).split(/\s+/);
    const categoryWords = this.normalizeText(product.category || '').split(/\s+/);
    
    for (const keyword of keywords) {
      // Check exact word match trong name
      if (nameWords.some(word => word === keyword)) {
        score += 10;
      }
      // Check partial match trong name
      else if (nameWords.some(word => word.includes(keyword) || keyword.includes(word))) {
        score += 5;
      }
      
      // Check category
      if (categoryWords.some(word => word === keyword)) {
        score += 8;
      } else if (categoryWords.some(word => word.includes(keyword) || keyword.includes(word))) {
        score += 3;
      }
      
      // Check description
      if (product.description && this.normalizeText(product.description).includes(keyword)) {
        score += 2;
      }
    }
    
    return { product, score };
  });

  const matchedProducts = scoredProducts
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.product)
    .slice(0, 5);

  if (matchedProducts.length > 0) {
    console.log(`   🎯 FUZZY matches found:`, matchedProducts.map(p => `${p.name} (score: ${scoredProducts.find(s => s.product.id === p.id)?.score})`));
    return matchedProducts;
  }

  // ============ BƯỚC 4: FALLBACK - LẤY SẢN PHẨM MỚI NHẤT ============
  console.log(`   ⚠️  No matches found, returning latest products`);
  const latestProducts = await this.prisma.product.findMany({
    where: { isActive: true, ...(ownerEmail && { ownerEmail }) },
    take: 1,
    orderBy: { createdAt: 'desc' },
  });

  return latestProducts;
}

// ============ HELPER: DEDUPLICATE PRODUCTS ============
private deduplicateProducts(products: any[]): any[] {
  const seen = new Set<string>();
  const unique: any[] = [];
  
  for (const product of products) {
    if (!seen.has(product.id)) {
      seen.add(product.id);
      unique.push(product);
    }
  }
  
  return unique;
}

  // ============ TÌM Q&A TƯƠNG TỰ ============
  private async findSimilarQAs(normalizedPrompt: string, limit: number = 3): Promise<any[]> {
    const normalizedForMatch = this.normalizeTextForMatching(normalizedPrompt);
    const keywords = this.extractKeywords(normalizedForMatch);
    const examples = await this.prisma.exampleQA.findMany({
      where: { isActive: true },
    });

    const scored = examples.map(example => {
      const exampleKeywords = this.extractKeywords(this.normalizeTextForMatching(example.question));
      const score = this.calculateKeywordOverlap(keywords, exampleKeywords);
      return { ...example, score };
    });

    return scored
      .filter(item => item.score > 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  // ============ EXACT MATCH ============
  private async findExactMatch(normalizedPrompt: string): Promise<MatchedAnswer> {
    const examples = await this.prisma.exampleQA.findMany({
      where: { isActive: true },
    });

    for (const example of examples) {
      const normalizedQuestion = this.normalizeTextForMatching(example.question);
      const normalizedPromptForMatch = this.normalizeTextForMatching(normalizedPrompt);
      
      if (normalizedQuestion === normalizedPromptForMatch) {
        return {
          found: true,
          answer: example.answer,
          question: example.question,
          confidence: 1.0,
          source: 'exact_match',
          metadata: { 
            exampleId: example.id,
            cached: false,
            usage: {} 
          },
        };
      }
    }

    return { found: false, confidence: 0, source: 'exact_match' };
  }

  // ============ FUZZY MATCH ============
  private async findFuzzyMatch(normalizedPrompt: string): Promise<MatchedAnswer> {
    const examples = await this.prisma.exampleQA.findMany({
      where: { isActive: true },
    });

    const normalizedPromptForMatch = this.normalizeTextForMatching(normalizedPrompt);
    const keywords = this.extractKeywords(normalizedPromptForMatch);
    let bestMatch: any = null;
    let bestScore = 0;

    for (const example of examples) {
      const normalizedQuestion = this.normalizeTextForMatching(example.question);
      const exampleKeywords = this.extractKeywords(normalizedQuestion);

      const score = this.calculateKeywordOverlap(keywords, exampleKeywords);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = example;
      }
    }

    if (bestScore >= 0.75) {
      return {
        found: true,
        answer: bestMatch.answer,
        question: bestMatch.question,
        confidence: bestScore,
        source: 'fuzzy_match',
        metadata: { 
          exampleId: bestMatch.id, 
          score: bestScore,
          cached: false,
          usage: {}
        },
      };
    }

    return { found: false, confidence: 0, source: 'fuzzy_match' };
  }

  // ============ EXISTING METHODS ============
  
  async getConversation(id: string) {
    return this.prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async getMessages(id: string) {
    return this.prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ============ CLEAR CONTEXT ============
  async clearConversationContext(conversationId: string) {
    this.conversationContexts.delete(conversationId);
    console.log(`🧹 Cleared context for conversation ${conversationId}`);
  }
}