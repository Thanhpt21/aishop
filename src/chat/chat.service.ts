import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAiService } from './openai.service';

interface ChatContext {
  conversationHistory: string;
  currentProducts: any[];
  userIntent: 'product_inquiry' | 'policy_question' | 'general_chat';
  searchKeyword: string | null;
  questionCategories: string[]; // 🆕 Các category từ khóa
  specificQuestions: string[];  // 🆕 Câu hỏi cụ thể
}

@Injectable()
export class ChatService {
  // 🔑 QUESTION KEYWORDS - GIỐNG BÊN CLIENT
  private readonly QUESTION_KEYWORDS = {
    PRODUCT: [
      'áo', 'quần', 'giày', 'dép', 'mũ', 'nón', 'túi', 'ví', 'váy', 'đầm',
      'thun', 'sơ mi', 'jeans', 'kaki', 'short', 'hoodie', 'jacket',
      'vớ', 'tất', 'phụ kiện', 'thắt lưng', 'khăn', 'găng tay'
    ],
    PRICE: [
      'giá', 'bao nhiêu tiền', 'bao nhiêu', 'giá cả', 'cost', 'price',
      'rẻ', 'đắt', 'giá trị', 'chi phí', 'hết bao nhiêu'
    ],
    PURCHASE: [
      'mua', 'đặt hàng', 'order', 'thanh toán', 'payment', 'checkout',
      'giỏ hàng', 'cart', 'mua ở đâu', 'mua đâu', 'ở đâu bán'
    ],
    SHIPPING: [
      'giao hàng', 'ship', 'vận chuyển', 'delivery', 'phí ship',
      'thời gian giao', 'bao lâu nhận', 'freeship', 'miễn phí ship'
    ],
    RETURN: [
      'đổi', 'trả', 'hoàn', 'return', 'exchange', 'refund',
      'bảo hành', 'warranty', 'lỗi', 'hư', 'hỏng', 'sai size'
    ],
    SIZE: [
      'size', 'kích thước', 'form dáng', 'đo', 'mặc vừa',
      'nhỏ', 'lớn', 'vừa', 'fit', 'oversize', 'ôm'
    ],
    STYLE: [
      'màu', 'màu sắc', 'màu gì', 'color', 'colour',
      'chất liệu', 'vải', 'làm bằng', 'material', 'fabric',
      'cotton', 'len', 'da', 'jeans', 'kaki'
    ],
    ADVICE: [
      'tư vấn', 'giới thiệu', 'recommend', 'suggest', 'nên mua',
      'phù hợp', 'dành cho', 'ai mặc', 'mặc đi đâu', 'phong cách'
    ],
    FEATURE: [
      'tính năng', 'đặc điểm', 'ưu điểm', 'có gì', 'feature',
      'tốt không', 'có tốt không', 'chất lượng', 'độ bền'
    ],
    CARE: [
      'bảo quản', 'giặt', 'sử dụng', 'care', 'wash',
      'ủi', 'là', 'phơi', 'tẩy', 'dry clean'
    ],
    POLICY: [
      'chính sách', 'policy', 'điều khoản', 'terms',
      'hỗ trợ', 'support', 'liên hệ', 'contact',
      'hotline', 'email', 'zalo', 'facebook'
    ],
    PROMOTION: [
      'khuyến mãi', 'sale', 'discount', 'giảm giá',
      'ưu đãi', 'promotion', 'deal', 'voucher', 'coupon'
    ],
    ACCOUNT: [
      'đăng ký', 'register', 'tài khoản', 'account',
      'đăng nhập', 'login', 'đăng xuất', 'logout',
      'thông tin', 'profile', 'thay đổi mật khẩu'
    ],
    FOLLOW_UP: [
      'nó', 'cái này', 'sản phẩm này', 'cái đó',
      'được không', 'đc không', 'thế nào', 'ra sao'
    ],
    GREETING: [
      'chào', 'hello', 'hi', 'xin chào', 'good morning', 'good afternoon',
      'hey', 'hế lô', 'alo', 'alô', 'chào shop', 'chào bạn'
    ],
    
    THANKS: [
      'cảm ơn', 'thank', 'thanks', 'cám ơn', 'cảm on', 'thank you',
      'cảm ơn bạn', 'cảm ơn shop', 'thanks bạn', 'ok cảm ơn'
    ],
    
    GOODBYE: [
      'tạm biệt', 'bye', 'goodbye', 'hẹn gặp lại', 'đi đây',
      'tạm biệt nhé', 'bye bye', 'bái bai', 'see you'
    ]
  };

  constructor(
    private prisma: PrismaService,
    private openai: OpenAiService,
  ) {}

  async handleChat(body: any) {
  const { conversationId, prompt, metadata = {}, ownerEmail } = body;
  if (!prompt?.trim()) throw new Error('prompt required');

  const convId = await this.getOrCreateConv(conversationId, prompt);
  await this.saveUserMessage(convId, prompt);

  // 🎯 Phân tích context với keyword analysis
  const context = await this.analyzeContext(prompt, metadata, ownerEmail);
  
  console.log('📊 Context Analysis:', {
    intent: context.userIntent,
    keyword: context.searchKeyword,
    categories: context.questionCategories,
    specificQuestions: context.specificQuestions,
    productCount: context.currentProducts.length,
    products: context.currentProducts.map(p => p.name),
    hasSlug: metadata?.slug && metadata.slug !== 'none', // 🆕 Log có slug không
    slug: metadata?.slug || 'none' // 🆕 Log slug value
  });

  // 🤖 Generate AI response - 🆕 TRUYỀN metadata VÀO
  const result = await this.generateAIResponse(prompt, context, ownerEmail, metadata);

  const msg = await this.saveAssistantMessage(
    convId,
    result.answer,
    'ai_generated',
    result.metadata
  );

  return {
    cached: false,
    conversationId: convId,
    response: {
      id: msg.id,
      text: result.answer,
      source: 'ai_generated',
      confidence: result.confidence,
      wordCount: result.answer.split(/\s+/).length,
      products: result.metadata?.products || [],
      metadata: {
        questionCategories: context.questionCategories,
        specificQuestions: context.specificQuestions,
        hasSlug: metadata?.slug && metadata.slug !== 'none', // 🆕 Trả về info
      }
    },
    usage: result.metadata?.usage || {},
  };
}

  // =============== 🆕 PHÂN TÍCH TỪ KHÓA ===============
  private analyzeQuestionKeywords(prompt: string): {
    categories: string[];
    specificQuestions: string[];
  } {
    const lower = prompt.toLowerCase();
    const categories: string[] = [];
    const specificQuestions: string[] = [];

    // Duyệt qua tất cả categories
    Object.entries(this.QUESTION_KEYWORDS).forEach(([category, keywords]) => {
      const matchedKeywords = keywords.filter(keyword => 
        lower.includes(keyword.toLowerCase())
      );

      if (matchedKeywords.length > 0) {
        categories.push(category.toLowerCase());
        specificQuestions.push(...matchedKeywords);
      }
    });

    console.log(`🔍 Keyword Analysis:`, {
      categories: categories.join(', '),
      matched: specificQuestions.join(', ')
    });

    return { categories, specificQuestions };
  }

  // =============== PHÂN TÍCH CONTEXT ===============
  private async analyzeContext(
    prompt: string,
    metadata: any,
    ownerEmail?: string
  ): Promise<ChatContext> {
    const history = metadata.conversationHistory || '';
    
    // 🆕 Phân tích keywords
    const keywordAnalysis = this.analyzeQuestionKeywords(prompt);
    
    // Phân loại ý định
    const userIntent = this.classifyIntent(prompt, keywordAnalysis.categories);
    
    // Trích xuất keyword tìm kiếm sản phẩm
    const searchKeyword = this.extractSearchKeyword(prompt);
    
    console.log('🔍 Search keyword:', searchKeyword);

    // Tìm sản phẩm liên quan
    const currentProducts = await this.findRelevantProducts(
      prompt,
      history,
      metadata.slug,
      searchKeyword,
      ownerEmail
    );

    return {
      conversationHistory: history,
      currentProducts,
      userIntent,
      searchKeyword,
      questionCategories: keywordAnalysis.categories,
      specificQuestions: keywordAnalysis.specificQuestions,
    };
  }

  // =============== PHÂN LOẠI Ý ĐỊNH - CẢI TIẾN ===============
private classifyIntent(
  prompt: string,
  categories: string[]
): ChatContext['userIntent'] {
  // 🎯 ƯU TIÊN SOCIAL INTERACTIONS - FIX: chuyển thành general_chat
  const socialCategories = ['greeting', 'thanks', 'goodbye'];
  const isSocialInteraction = categories.some(cat => socialCategories.includes(cat));
  
  // 🆕 Nếu chỉ có social category → general_chat
  if (isSocialInteraction && categories.length === 1) {
    return 'general_chat';
  }

  // Nếu có category POLICY, SHIPPING, RETURN, ACCOUNT → policy question
  const policyCategories = ['policy', 'shipping', 'return', 'account', 'promotion'];
  
  if (categories.some(cat => policyCategories.includes(cat))) {
    return 'policy_question';
  }

  // Nếu có category PRODUCT, PRICE, PURCHASE, SIZE, STYLE, etc → product inquiry
  const productCategories = ['product', 'price', 'purchase', 'size', 'style', 'advice', 'feature', 'care', 'follow_up'];
  
  if (categories.some(cat => productCategories.includes(cat))) {
    return 'product_inquiry';
  }

  // Social interactions và các câu chung → general_chat
  return 'general_chat';
}

  // =============== TRÍCH XUẤT KEYWORD TÌM KIẾM ===============
  private extractSearchKeyword(prompt: string): string | null {
    const lower = prompt.toLowerCase();
    
    // Ưu tiên keywords từ PRODUCT category
    const productKeywords = this.QUESTION_KEYWORDS.PRODUCT;
    
    for (const keyword of productKeywords) {
      if (lower.includes(keyword)) {
        console.log(`✅ Extracted search keyword: "${keyword}"`);
        return keyword;
      }
    }

    return null;
  }

  // =============== TÌM SẢN PHẨM LIÊN QUAN ===============
  private async findRelevantProducts(
    prompt: string,
    history: string,
    urlSlug: string | null,
    searchKeyword: string | null,
    ownerEmail?: string
  ): Promise<any[]> {
    // 1. Slug từ URL
    if (urlSlug && urlSlug !== 'none') {
      const product = await this.findBySlug(urlSlug, ownerEmail);
      if (product) {
        console.log('✅ Found from URL slug:', product.name);
        return [product];
      }
    }

    // 2. Slug trong prompt
    const promptSlug = this.extractSlug(prompt);
    if (promptSlug) {
      const product = await this.findBySlug(promptSlug, ownerEmail);
      if (product) {
        console.log('✅ Found from prompt slug:', product.name);
        return [product];
      }
    }

    // 3. 🎯 TÌM THEO KEYWORD
    if (searchKeyword) {
      console.log(`🔍 Searching products with keyword: "${searchKeyword}"`);
      const products = await this.searchProductsByKeyword(searchKeyword, ownerEmail);
      
      if (products.length > 0) {
        console.log(`✅ Found ${products.length} products:`, products.map(p => p.name));
        return products;
      }
    }

    // 4. History
    if (history) {
      const historyProducts = await this.extractProductsFromHistory(history, ownerEmail);
      if (historyProducts.length > 0) {
        console.log('✅ Found from history:', historyProducts[0].name);
        return [historyProducts[0]];
      }
    }

    return [];
  }

  // =============== TÌM SẢN PHẨM THEO KEYWORD ===============
  private async searchProductsByKeyword(
    keyword: string,
    ownerEmail?: string
  ): Promise<any[]> {
    const products = await this.prisma.product.findMany({
      where: {
        isActive: true,
        OR: [
          { name: { contains: keyword, mode: 'insensitive' } },
          { category: { contains: keyword, mode: 'insensitive' } },
          { description: { contains: keyword, mode: 'insensitive' } },
        ],
        ...(ownerEmail && { ownerEmail }),
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    // Fallback: Tìm với variants
    if (products.length === 0) {
      const variants: Record<string, string[]> = {
        'áo': ['shirt', 'thun', 'tshirt', 't-shirt', 'icondenim', 'icod', 'áo nam', 'áo thun'],
        'quần': ['pants', 'jeans', 'trouser', 'short'],
        'giày': ['shoes', 'sneaker', 'boots'],
        'găng tay': ['gloves', 'găng', 'gang'],
        'vớ': ['socks', 'vo', 'tat'],
      };

      const keywordVariants = variants[keyword.toLowerCase()] || [];
      
      if (keywordVariants.length > 0) {
        console.log(`🔄 Searching with variants: ${keywordVariants.join(', ')}`);
        
        const variantProducts = await this.prisma.product.findMany({
          where: {
            isActive: true,
            OR: keywordVariants.flatMap(variant => [
              { name: { contains: variant, mode: 'insensitive' } },
              { category: { contains: variant, mode: 'insensitive' } },
            ]),
            ...(ownerEmail && { ownerEmail }),
          },
          orderBy: { createdAt: 'desc' },
          take: 5,
        });
        
        return variantProducts;
      }
    }

    return products;
  }

  // =============== 🆕 GENERATE AI RESPONSE - LINH HOẠT ===============
private async generateAIResponse(
  prompt: string,
  context: ChatContext,
  ownerEmail?: string,
  metadata?: any
) {
  // 1. QA cho policy questions
  if (context.userIntent === 'policy_question') {
    const qaMatch = await this.matchQA(prompt, ownerEmail);
    if (qaMatch) {
      return qaMatch;
    }
  }

  // 2. Build dynamic AI prompt với metadata
  const aiPrompt = this.buildDynamicAIPrompt(prompt, context, metadata || {});
  
  console.log('🤖 AI Prompt (first 600 chars):\n', aiPrompt.substring(0, 600) + '...');

  try {
    // 3. Call OpenAI
    const ai = await this.openai.callOpenAI(aiPrompt, {
      maxTokens: 150,
      temperature: 0.75,
    });

    // ✅ VALIDATE RESPONSE
    const answer = ai.text.trim();
    
    // 🚨 KIỂM TRA CÂU TRẢ LỜI KHÔNG HỢP LỆ
    if (this.isInvalidResponse(answer, aiPrompt)) {
      console.warn('⚠️ Invalid AI response detected, using fallback');
      return this.getFallbackResponse(prompt, context);
    }

    return {
      answer,
      confidence: 0.9,
      metadata: {
        products: context.currentProducts.slice(0, 3).map(this.clean),
        usage: ai.usage,
        cached: false,
        userIntent: context.userIntent,
        questionCategories: context.questionCategories,
      },
    };

  } catch (error) {
    console.error('❌ OpenAI call failed:', error);
    return this.getFallbackResponse(prompt, context);
  }
}
// =============== 🆕 KIỂM TRA RESPONSE KHÔNG HỢP LỆ ===============
private isInvalidResponse(answer: string, originalPrompt: string): boolean {
  // 1. Trả về prompt gốc hoặc system instructions
  if (answer.includes('Bạn là trợ lý bán hàng') || 
      answer.includes('📦 SẢN PHẨM CÓ SẴN:') ||
      answer.includes('📝 HƯỚNG DẪN TRẢ LỜI:') ||
      answer.includes('💬 PHẢN HỒI XÃ GIAO:') ||
      answer.includes('❓ CÂU HỎI:') ||
      answer.includes('✍️ CHỈ TRẢ LỜI:')) {
    return true;
  }

  // 2. Quá ngắn (< 5 ký tự) nhưng không phải social response
  if (answer.length < 5 && !this.isLikelySocialResponse(answer)) {
    return true;
  }

  // 3. Chỉ có emoji hoặc ký tự đặc biệt
  if (!/[a-zA-Z0-9\u00C0-\u1EF9]/.test(answer)) {
    return true;
  }

  // 4. Chứa quá nhiều emoji (> 30% content)
  const emojiCount = (answer.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
  if (emojiCount > answer.length * 0.3) {
    return true;
  }

  return false;
}

// 🆕 Thêm hàm kiểm tra social response
private isLikelySocialResponse(answer: string): boolean {
  const socialPatterns = [
    /^không có gì/i,
    /^cảm ơn/i,
    /^xin chào/i,
    /^tạm biệt/i,
    /^chào bạn/i,
    /^vâng/i,
    /^dạ/i,
    /^ok/i,
    /^ừ/i,
    /^uh/i
  ];
  
  return socialPatterns.some(pattern => pattern.test(answer));
}

// =============== 🆕 FALLBACK RESPONSE ===============
private getFallbackResponse(prompt: string, context: ChatContext): any {
  let fallbackAnswer = '';

  // 🆕 KIỂM TRA SOCIAL INTERACTIONS TRƯỚC
  const socialCategories = ['greeting', 'thanks', 'goodbye'];
  const isSocialInteraction = context.questionCategories.some(cat => 
    socialCategories.includes(cat)
  );

  if (isSocialInteraction && context.questionCategories.length === 1) {
    // FALLBACK CHO SOCIAL (khi OpenAI fail)
    if (context.questionCategories.includes('thanks')) {
      fallbackAnswer = 'Không có gì đâu ạ! Rất vui được hỗ trợ bạn. 😊';
    } else if (context.questionCategories.includes('greeting')) {
      fallbackAnswer = 'Xin chào bạn! Tôi có thể giúp gì cho bạn hôm nay?';
    } else if (context.questionCategories.includes('goodbye')) {
      fallbackAnswer = 'Tạm biệt bạn! Hẹn gặp lại! 👋';
    }
  }

  // FALLBACK THEO CONTEXT
  if (context.userIntent === 'policy_question') {
    const categories = context.questionCategories;
    
    if (categories.includes('shipping')) {
      fallbackAnswer = 'Về chính sách giao hàng, tôi chưa có thông tin chi tiết. Bạn vui lòng liên hệ shop qua hotline hoặc Zalo để được tư vấn cụ thể nhé! 📞';
    } else if (categories.includes('return')) {
      fallbackAnswer = 'Về chính sách đổi trả, tôi chưa rõ lắm. Bạn vui lòng liên hệ trực tiếp shop để biết thông tin chính xác nhất nhé! 🔄';
    } else if (categories.includes('promotion')) {
      fallbackAnswer = 'Về các chương trình khuyến mãi hiện tại, tôi chưa có thông tin đầy đủ. Bạn liên hệ shop để biết thêm các ưu đãi đang có nhé! 🎁';
    } else {
      fallbackAnswer = 'Tôi chưa rõ lắm về vấn đề này. Bạn vui lòng liên hệ shop qua hotline hoặc Zalo để được hỗ trợ tốt nhất nhé! 💬';
    }
  } 
  
  else if (context.userIntent === 'product_inquiry') {
    if (context.currentProducts.length > 0) {
      const product = context.currentProducts[0];
      fallbackAnswer = `Về sản phẩm ${product.name} (${this.fmt(product.price)}), tôi chưa có đủ thông tin để tư vấn chi tiết. Bạn vui lòng liên hệ shop để được tư vấn kỹ hơn nhé! 📦`;
    } else if (context.searchKeyword) {
      fallbackAnswer = `Shop hiện chưa có sản phẩm "${context.searchKeyword}" bạn tìm. Bạn có thể xem các sản phẩm khác hoặc liên hệ shop để đặt hàng riêng nhé! 🛍️`;
    } else {
      fallbackAnswer = 'Tôi chưa hiểu rõ sản phẩm bạn đang hỏi. Bạn có thể mô tả cụ thể hơn hoặc liên hệ shop để được tư vấn trực tiếp nhé! 💁‍♀️';
    }
  }
  
  else {
    // General chat fallback
    fallbackAnswer = 'Tôi chưa rõ lắm về câu hỏi này. Bạn vui lòng liên hệ shop để được hỗ trợ tốt nhất nhé! 😊';
  }

  return {
    answer: fallbackAnswer,
    confidence: 0.5,
    metadata: {
      products: context.currentProducts.slice(0, 3).map(this.clean),
      usage: {},
      cached: false,
      userIntent: context.userIntent,
      questionCategories: context.questionCategories,
      fallback: true, // 🆕 Đánh dấu là fallback
    },
  };
}


  // =============== THÊM HÀM KIỂM TRA CÂU HỎI VỀ LINK ===============
private isAskingForLink(prompt: string, categories: string[]): boolean {
  const lower = prompt.toLowerCase();
  
  const linkKeywords = [
    'link', 'xem chi tiết', 'xem thêm', 'xem sản phẩm',
    'cho tui xem', 'cho tôi xem', 'muốn xem', 'tham khảo',
    'đường dẫn', 'url', 'trang sản phẩm'
  ];
  
  return linkKeywords.some(keyword => lower.includes(keyword));
}


  // =============== 🆕 BUILD DYNAMIC AI PROMPT ===============
private buildDynamicAIPrompt(prompt: string, context: ChatContext, metadata: any): string {
  let systemPrompt = `Bạn là trợ lý bán hàng thông minh, thân thiện và tự nhiên.

`;

  // 🎯 XỬ LÝ CHÀO HỎI, CẢM ƠN, TẠM BIỆT
  const socialCategories = ['greeting', 'thanks', 'goodbye'];
  const isSocialInteraction = context.questionCategories.some(cat => 
    socialCategories.includes(cat)
  );

  if (isSocialInteraction && context.questionCategories.length === 1) {
    systemPrompt += `💬 CÂU XÃ GIAO - TRẢ LỜI TỰ NHIÊN:\n`;
    
    if (context.questionCategories.includes('greeting')) {
      systemPrompt += `- Khách đang chào hỏi
- Chào lại thân thiện: "Xin chào! Chào bạn!"
- Hỏi thăm: "Bạn cần tôi tư vấn sản phẩm gì không?"
- Giữ giọng điệu vui vẻ, ấm áp
- KHÔNG đề cập đến liên hệ shop trừ khi khách hỏi\n\n`;
    }
    
    if (context.questionCategories.includes('thanks')) {
      systemPrompt += `- Khách đang cảm ơn
- Đáp lại: "Không có gì đâu ạ! 😊"
- Tiếp lời: "Rất vui được hỗ trợ bạn!"
- Nếu cần: "Bạn còn cần tôi giúp gì nữa không?"
- Giữ câu ngắn gọn, thân thiện
- KHÔNG chuyển hướng sang liên hệ shop\n\n`;
    }
    
    if (context.questionCategories.includes('goodbye')) {
      systemPrompt += `- Khách đang chào tạm biệt
- Chúc: "Tạm biệt bạn! Chúc bạn một ngày tốt lành!"
- Mời: "Hẹn gặp lại bạn nhé! 👋"
- Giọng điệu tích cực, ấm áp\n\n`;
    }

    systemPrompt += `❓ CÂU HỎI: "${prompt}"

✍️ CHỈ TRẢ LỜI (tự nhiên, thân thiện, ngắn gọn 10-30 từ, KHÔNG đề cập liên hệ shop):`;
    
    return systemPrompt;
  }

  // 🎯 KIỂM TRA CÓ SLUG TRONG METADATA (đang ở trang sản phẩm)
  const hasUrlSlug = metadata?.slug && metadata.slug !== 'none';
  const isAskingForLink = this.isAskingForLink(prompt, context.questionCategories);
  
  console.log('🔗 Link analysis:', { hasUrlSlug, isAskingForLink });

  // 🎯 THÔNG TIN SẢN PHẨM - THÊM SLUG ĐỘNG
  if (context.currentProducts.length > 0) {
    systemPrompt += `📦 SẢN PHẨM CÓ SẴN:\n`;
    context.currentProducts.forEach((p, i) => {
      systemPrompt += `${i + 1}. ${p.name} - ${this.fmt(p.price)}\n`;
      
      if (!hasUrlSlug || isAskingForLink) {
        systemPrompt += `   Slug: ${p.slug}\n`;
      }
      
      if (p.description) {
        systemPrompt += `   ${p.description.substring(0, 120)}...\n`;
      }
    });
    systemPrompt += `\n`;
  } else if (context.searchKeyword) {
    systemPrompt += `⚠️ LƯU Ý: Khách tìm "${context.searchKeyword}" nhưng hiện shop KHÔNG CÓ.\n\n`;
  }

  // 🔍 PHÂN TÍCH CÂU HỎI
  if (context.questionCategories.length > 0) {
    systemPrompt += `🎯 KHÁCH ĐANG HỎI VỀ: ${context.questionCategories.join(', ').toUpperCase()}\n`;
    
    if (context.specificQuestions.length > 0) {
      systemPrompt += `🔑 Từ khóa quan trọng: ${context.specificQuestions.slice(0, 5).join(', ')}\n`;
    }
    systemPrompt += `\n`;
  }

  // 📋 HƯỚNG DẪN THEO CONTEXT
  systemPrompt += this.buildContextGuidance(context);

  // 🆕 HƯỚNG DẪN LINK ĐỘNG
  if (hasUrlSlug && !isAskingForLink) {
    systemPrompt += `\n🔗 QUAN TRỌNG - KHÔNG THÊM LINK:
- Khách đang ở trang sản phẩm này rồi
- KHÔNG cần thêm slug vào câu trả lời
- Tập trung vào tư vấn nội dung sản phẩm
- Trả lời tự nhiên, không đề cập "xem chi tiết" hay slug\n\n`;
  } else if (isAskingForLink) {
    systemPrompt += `\n🔗 KHÁCH HỎI VỀ LINK - PHẢI TRẢ LINK:
- Khách muốn xem link/chi tiết sản phẩm
- BẮT BUỘC thêm slug sau tên sản phẩm: "Tên sản phẩm (giá) \`slug-san-pham\`"
- Ví dụ: "Áo Thun Nam ICONDENIM (200.000₫) \`ao-thun-nam-icondenin-new-rules\`"
- KHÔNG thêm text dư thừa như "xem tại đây", chỉ cần slug\n\n`;
  } else {
    systemPrompt += `\n🔗 TRẢ LINK CHO TIỆN:
- Khi giới thiệu sản phẩm, thêm slug để khách dễ truy cập
- Format: "Tên sản phẩm (giá) \`slug-san-pham\`"
- Ví dụ: "Áo Thun Nam (200.000₫) \`ao-thun-nam-icod\`"
- GIỮ CÂU TRẢ LỜI TỰ NHIÊN\n\n`;
  }

  // 🆕 THÊM HƯỚNG DẪN FALLBACK
  systemPrompt += `\n⚠️ QUAN TRỌNG - NẾU KHÔNG BIẾT:
- Nếu không có đủ thông tin để trả lời chính xác
- Nói thẳng: "Tôi chưa rõ lắm về vấn đề này"
- Đề xuất: "Bạn vui lòng liên hệ shop để được tư vấn chi tiết nhé!"
- KHÔNG bịa đặt thông tin\n\n`;

  // 📜 LỊCH SỬ
  if (context.conversationHistory) {
    const recentHistory = context.conversationHistory.split('\n').slice(-6).join('\n');
    systemPrompt += `💬 HỘI THOẠI GẦN ĐÂY:\n${recentHistory}\n`;
  }

  systemPrompt += `\n❓ CÂU HỎI: "${prompt}"

✍️ CHỈ TRẢ LỜI (tự nhiên, ${hasUrlSlug && !isAskingForLink ? 'KHÔNG thêm slug' : 'thêm slug nếu cần'}, 50-80 từ, KHÔNG lặp lại prompt):`;

  return systemPrompt;
}


  // =============== 🆕 BUILD CONTEXT GUIDANCE ===============
private buildContextGuidance(context: ChatContext): string {
  let guidance = `📝 HƯỚNG DẪN TRẢ LỜI:\n`;

  const categories = context.questionCategories;

  // PRODUCT INQUIRY
  if (context.userIntent === 'product_inquiry') {
    if (context.currentProducts.length > 0) {
      guidance += `✅ CÓ SẢN PHẨM:\n`;
      
      if (categories.includes('advice') || categories.includes('feature')) {
        guidance += `- Tư vấn ưu điểm nổi bật của sản phẩm\n`;
      }
      if (categories.includes('price')) {
        guidance += `- Nêu rõ giá cả, so sánh giá trị\n`;
      }
      if (categories.includes('size') || categories.includes('style')) {
        guidance += `- Mô tả kích thước, màu sắc, chất liệu\n`;
      }
      if (categories.includes('purchase')) {
        guidance += `- Hướng dẫn cách mua hàng\n`;
      }
      
      guidance += `- Gợi ý 1-2 sản phẩm phù hợp nhất\n`;
      guidance += `- Giọng điệu: Nhiệt tình, tự tin\n`;
      guidance += `- Nếu không đủ thông tin chi tiết: hướng dẫn liên hệ shop\n`;
    } else if (context.searchKeyword) {
      guidance += `❌ KHÔNG CÓ SẢN PHẨM "${context.searchKeyword}":\n`;
      guidance += `- Thông báo lịch sự shop chưa có\n`;
      guidance += `- Hỏi khách cần tìm sản phẩm nào khác\n`;
      guidance += `- Giọng điệu: Thân thiện, sẵn sàng hỗ trợ\n`;
    }
  }

  // POLICY QUESTION
  else if (context.userIntent === 'policy_question') {
    guidance += `📋 CÂU HỎI CHÍNH SÁCH:\n`;
    
    if (categories.includes('shipping')) {
      guidance += `- Thông tin về giao hàng, phí ship, thời gian\n`;
    }
    if (categories.includes('return')) {
      guidance += `- Chính sách đổi trả, bảo hành\n`;
    }
    if (categories.includes('promotion')) {
      guidance += `- Khuyến mãi, ưu đãi hiện có\n`;
    }
    if (categories.includes('account')) {
      guidance += `- Hướng dẫn đăng ký, đăng nhập\n`;
    }
    
    guidance += `- KHÔNG đề cập sản phẩm cụ thể\n`;
    guidance += `- Nếu không rõ: "Bạn vui lòng liên hệ hotline để biết chi tiết"\n`;
  }

  // GENERAL CHAT
  else {
    guidance += `💬 CHAT TỰ NHIÊN:\n`;
    guidance += `- Trả lời thân thiện, tự nhiên như người bạn\n`;
    guidance += `- Giữ giọng điệu tích cực, chuyên nghiệp\n`;
    guidance += `- Sẵn sàng hỗ trợ khi khách cần\n`;
  }

  guidance += `\n`;
  return guidance;
}

  // =============== EXTRACT PRODUCTS FROM HISTORY ===============
  private async extractProductsFromHistory(
    history: string,
    ownerEmail?: string
  ): Promise<any[]> {
    if (!history.trim()) return [];

    const lines = history.split('\n').filter(line => line.trim());
    
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i];
      
      if (line.startsWith('Bot:') || line.startsWith('BOT:')) {
        const content = line.substring(4).trim();
        const products = await this.findProductMentions(content, ownerEmail);
        
        if (products.length > 0) {
          return products;
        }
      }
    }

    return [];
  }

  private async findProductMentions(
    text: string,
    ownerEmail?: string
  ): Promise<any[]> {
    const lowerText = text.toLowerCase();
    
    const dbProducts = await this.prisma.product.findMany({
      where: {
        isActive: true,
        ...(ownerEmail && { ownerEmail }),
      },
      take: 10,
    });

    return dbProducts.filter(product => 
      lowerText.includes(product.name.toLowerCase())
    );
  }

  // =============== MATCH QA ===============
  private async matchQA(prompt: string, ownerEmail?: string) {
    const normalized = this.normalizeQuestion(prompt);

    const where: any = {
      isActive: true,
      OR: ownerEmail
        ? [{ ownerEmail }, { ownerEmail: null }]
        : [{ ownerEmail: null }],
    };

    const exact = await this.prisma.exampleQA.findFirst({
      where: {
        ...where,
        question: { equals: normalized, mode: 'insensitive' },
      },
    });

    if (exact) {
      return {
        answer: exact.answer,
        confidence: 0.99,
        metadata: { products: [], usage: {}, cached: true },
      };
    }

    return null;
  }

  // =============== HELPERS ===============
  private normalizeQuestion(text: string): string {
    return text
      .toLowerCase()
      .replace(/[?,!.]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractSlug(text: string): string | null {
    const m = text.match(/[a-z0-9][a-z0-9-]{8,}[a-z0-9]/i);
    return m ? m[0].toLowerCase() : null;
  }

  private async findBySlug(slug: string, ownerEmail?: string) {
    return this.prisma.product.findFirst({
      where: {
        slug: { equals: slug, mode: 'insensitive' },
        isActive: true,
        ...(ownerEmail && { ownerEmail }),
      },
    });
  }

  private clean(p: any) {
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      description: p.description,
    };
  }

  private fmt(p: number) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(p);
  }

  // =============== DATABASE ===============
  private async getOrCreateConv(id?: string, prompt?: string) {
    if (id) return id;
    const c = await this.prisma.conversation.create({
      data: {
        title: (prompt || '').slice(0, 50) + (prompt && prompt.length > 50 ? '...' : ''),
      },
    });
    return c.id;
  }

  private saveUserMessage(convId: string, content: string) {
    return this.prisma.message.create({
      data: {
        conversationId: convId,
        role: 'user',
        content,
        source: 'user',
      },
    });
  }

  private saveAssistantMessage(
    convId: string,
    content: string,
    source: string,
    metadata: any
  ) {
    return this.prisma.message.create({
      data: {
        conversationId: convId,
        role: 'assistant',
        content,
        source,
        metadata,
      },
    });
  }

  async getConversation(id: string) {
    return this.prisma.conversation.findUnique({
      where: { id },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  async getMessages(id: string) {
    return this.prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
    });
  }
}