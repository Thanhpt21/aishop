import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAiService } from './openai.service';

// Định nghĩa type
type KeywordPromptType = {
  id: string | number;
  keyword: string;
  prompt: string;
  sampleAnswer: string;
  additionalInfo?: string;
  priority: number;
  ownerEmail?: string;
  createdAt?: Date;
};

type ProductType = {
  id: string;
  name: string;
  slug: string;
  price: number;
  description?: string;
  category?: string;
  ownerEmail?: string;
  createdAt?: Date;
};

// 🆕 Type cho keyword prompt trong response
type ResponseKeywordPromptType = {
  id: string | number;
  keyword: string;
  sampleAnswer: string;
  priority: number;
  prompt?: string;
  additionalInfo?: string;
};

interface ChatContext {
  conversationHistory: string;
  currentProducts: ProductType[];
  keywordPrompts: KeywordPromptType[];
  userIntent: 'product_inquiry' | 'keyword_prompt' | 'general_chat' | 'product_suggestion' | 'link_request';
  extractedKeywords: string[];
  searchKeyword: string | null;
  urlSlug: string | null;
  isAskingForLink: boolean;
  isKeywordPromptMatch: boolean;
  matchedKeywordInfo?: KeywordPromptType;
}

@Injectable()
export class ChatService {
  // 🔑 TẤT CẢ QUESTION KEYWORDS - GENERIC CHO MỌI NGÀNH NGHỀ
  private readonly QUESTION_KEYWORDS = {
    PRODUCT: [
      'sản phẩm', 'hàng hóa', 'mặt hàng', 'đồ', 'vật phẩm',
      'item', 'product', 'goods', 'commodity', 'merchandise'
    ],
    PRICE: [
      'giá', 'bao nhiêu tiền', 'bao nhiêu', 'giá cả', 'cost', 'price',
      'rẻ', 'đắt', 'giá trị', 'chi phí', 'hết bao nhiêu',
      'đơn giá', 'báo giá', 'giá thành', 'giá bán'
    ],
    PURCHASE: [
      'mua', 'đặt hàng', 'order', 'thanh toán', 'payment', 'checkout',
      'giỏ hàng', 'cart', 'mua ở đâu', 'mua đâu', 'ở đâu bán',
      'mua sắm', 'mua online', 'đặt mua', 'chốt đơn'
    ],
    SHIPPING: [
      'giao hàng', 'ship', 'vận chuyển', 'delivery', 'phí ship',
      'thời gian giao', 'bao lâu nhận', 'freeship', 'miễn phí ship',
      'vận chuyển', 'gửi hàng', 'nhận hàng', 'địa chỉ giao'
    ],
    RETURN: [
      'đổi', 'trả', 'hoàn', 'return', 'exchange', 'refund',
      'bảo hành', 'warranty', 'lỗi', 'hư', 'hỏng',
      'sai sản phẩm', 'không đúng', 'khiếu nại'
    ],
    SIZE: [
      'size', 'kích thước', 'form dáng', 'đo', 'mặc vừa',
      'nhỏ', 'lớn', 'vừa', 'fit', 'khổ', 'kích cỡ'
    ],
    POLICY: [
      'chính sách', 'policy', 'điều khoản', 'terms',
      'hỗ trợ', 'support', 'liên hệ', 'contact',
      'hotline', 'email', 'zalo', 'facebook', 'thông tin'
    ],
    LOCATION: [
      'địa chỉ', 'ở đâu', 'đường nào', 'vị trí',
      'kho hàng', 'cửa hàng', 'chi nhánh', 'showroom',
      'trụ sở', 'địa điểm', 'nơi bán'
    ],
    WORKING_HOURS: [
      'mấy giờ', 'giờ mở cửa', 'giờ đóng cửa', 'làm việc',
      'mở cửa', 'đóng cửa', 'online', 'trực page',
      'giờ hành chính', 'thời gian làm việc'
    ],
    PAYMENT: [
      'thanh toán', 'tiền mặt', 'chuyển khoản',
      'cod', 'ship cod', 'thẻ ngân hàng',
      'ví điện tử', 'momo', 'zalopay', 'paypal'
    ],
    SUGGESTION: [
      'gợi ý', 'giới thiệu', 'tư vấn', 'recommend', 'suggest',
      'nên mua', 'phù hợp', 'dành cho', 'cho tôi xem',
      'có gì', 'có sản phẩm gì', 'có hàng gì', 'có đồ gì',
      'xem hàng', 'xem sản phẩm', 'xem đồ',
      'shop có gì', 'cửa hàng có gì', 'nên mua gì',
      'cho xem', 'show me', 'show product',
      'giới thiệu sản phẩm', 'tư vấn mua hàng'
    ],
    LINK: [
      'link', 'xem chi tiết', 'xem thêm', 'xem sản phẩm',
      'cho tui xem', 'cho tôi xem', 'muốn xem', 'tham khảo',
      'đường dẫn', 'url', 'trang sản phẩm', 'chi tiết',
      'xin link', 'cho xin link', 'gửi link', 'share link',
      'đường link', 'liên kết', 'cho tôi link', 'cho tui link',
      'website', 'trang web', 'fanpage'
    ],
    GREETING: [
      'chào', 'hello', 'hi', 'xin chào', 'good morning', 'good afternoon',
      'hey', 'hế lô', 'alo', 'alô', 'chào shop', 'chào bạn',
      'chào anh', 'chào chị', 'em chào'
    ],
    THANKS: [
      'cảm ơn', 'thank', 'thanks', 'cám ơn', 'cảm on', 'thank you',
      'cảm ơn bạn', 'cảm ơn shop', 'thanks bạn', 'ok cảm ơn',
      'cảm ơn nhiều', 'cảm ơn nha', 'cảm ơn nhé'
    ],
    GOODBYE: [
      'tạm biệt', 'bye', 'goodbye', 'hẹn gặp lại', 'đi đây',
      'tạm biệt nhé', 'bye bye', 'bái bai', 'see you',
      'tạm biệt shop', 'bye shop', 'thôi đi đây'
    ],
    SPECIFICATION: [
      'thông số', 'thông tin kỹ thuật', 'kỹ thuật', 'tech specs',
      'đặc tính', 'tính năng', 'đặc điểm', 'chi tiết kỹ thuật',
      'model', 'mẫu mã', 'phiên bản'
    ],
    FEATURE: [
      'tính năng', 'đặc điểm', 'ưu điểm', 'có gì', 'feature',
      'tốt không', 'có tốt không', 'chất lượng', 'độ bền',
      'lợi ích', 'công dụng', 'chức năng'
    ],
    CARE: [
      'bảo quản', 'giặt', 'sử dụng', 'care', 'wash',
      'ủi', 'là', 'phơi', 'tẩy', 'dry clean',
      'bảo dưỡng', 'vệ sinh', 'lau chùi'
    ],
    PROMOTION: [
      'khuyến mãi', 'sale', 'discount', 'giảm giá',
      'ưu đãi', 'promotion', 'deal', 'voucher', 'coupon',
      'chương trình', 'quà tặng', 'tặng kèm'
    ],
    ACCOUNT: [
      'đăng ký', 'register', 'tài khoản', 'account',
      'đăng nhập', 'login', 'đăng xuất', 'logout',
      'thông tin', 'profile', 'thay đổi mật khẩu',
      'user', 'người dùng'
    ],
    STOCK: [
      'còn hàng', 'hết hàng', 'tồn kho', 'stock', 'inventory',
      'có sẵn', 'có hàng không', 'còn không', 'hàng có sẵn'
    ],
    ORIGIN: [
      'xuất xứ', 'nơi sản xuất', 'made in', 'origin',
      'sản xuất tại', 'sản xuất ở đâu', 'hàng nước nào'
    ],
    MATERIAL: [
      'chất liệu', 'vật liệu', 'material', 'fabric',
      'làm bằng gì', 'chất liệu gì', 'nguyên liệu'
    ],
    CATEGORY: [
      'danh mục', 'category', 'phân loại', 'loại',
      'dòng sản phẩm', 'nhóm hàng', 'thể loại'
    ]
  };

  constructor(
    private prisma: PrismaService,
    private openai: OpenAiService,
  ) {}

  // 🎯 MAIN HANDLER
  async handleChat(body: any) {
    const { conversationId, prompt, metadata = {}, ownerEmail } = body;
    
    const convId = await this.getOrCreateConv(conversationId, prompt);
    await this.saveUserMessage(convId, prompt);

    const detectedIntent = this.analyzeIntentFromPrompt(prompt);

    console.log('🔍 Bắt đầu xử lý prompt:', prompt);

    // 🔥 BƯỚC 1: Trích xuất từ khóa
    const extractedKeywords = await this.extractKeywordsUsingAI(prompt);
    console.log('🔍 Extracted Keywords:', extractedKeywords);

    // 🔥 BƯỚC 2: TÌM SẢN PHẨM THỰC TẾ
    let matchedProducts: ProductType[] = [];
    
    // Trích xuất slug từ prompt nếu có
    const promptSlug = this.extractSlug(prompt);
    const urlSlug = metadata?.slug && metadata.slug !== 'none' ? metadata.slug : null;
    
    console.log('🔍 Slug detection:', {
      promptSlug,
      urlSlug,
      metadataSlug: metadata?.slug
    });

    // Ưu tiên tìm sản phẩm theo slug
    if (urlSlug) {
      const product = await this.findBySlug(urlSlug, ownerEmail);
      if (product) {
        matchedProducts = [product as ProductType];
        console.log('✅ Found product by URL slug:', product.name);
      }
    }
    
    if (matchedProducts.length === 0 && promptSlug) {
      const product = await this.findBySlug(promptSlug, ownerEmail);
      if (product) {
        matchedProducts = [product as ProductType];
        console.log('✅ Found product by prompt slug:', product.name);
      }
    }
    
    // Tìm theo từ khóa
    if (matchedProducts.length === 0) {
      matchedProducts = await this.findProductsByKeywords(extractedKeywords, ownerEmail);
    }
    
    console.log('📦 Matched Products:', matchedProducts.length);
    if (matchedProducts.length > 0) {
      console.log('📦 Product details:', {
        name: matchedProducts[0].name,
        slug: matchedProducts[0].slug,
        price: matchedProducts[0].price
      });
    }

    // 🔥 BƯỚC 3: TÌM KEYWORD PROMPTS LIÊN QUAN
    let matchedKeywordPrompts: KeywordPromptType[] = [];
    let matchedKeywordInfo: KeywordPromptType | null = null;
    
    if (extractedKeywords.length > 0) {
      // TRUYỀN THÊM userPrompt để phân tích chính xác
      matchedKeywordPrompts = await this.findKeywordPromptsByKeywords(
        extractedKeywords, 
        ownerEmail,
        prompt  // Thêm prompt để phân tích context
      );
      
      // ƯU TIÊN MATCH THEO INTENT
      if (matchedKeywordPrompts.length > 0) {
        // Nếu có nhiều keyword prompts, ưu tiên theo intent
        if (matchedKeywordPrompts.length > 1 && detectedIntent) {
          const intentFiltered = matchedKeywordPrompts.filter(kp => {
            const keywords = kp.keyword.toLowerCase();
            // Kiểm tra xem keyword có liên quan đến intent không
            return (
              (detectedIntent === 'link_request' && keywords.includes('link')) ||
              (detectedIntent === 'purchase' && keywords.includes('mua')) ||
              (detectedIntent === 'book' && keywords.includes('giữ')) ||
              (detectedIntent === 'shipping' && keywords.includes('giao')) ||
              (detectedIntent === 'price' && keywords.includes('giá')) ||
              (detectedIntent === 'suggestion' && keywords.includes('gợi ý')) ||
              true // fallback
            );
          });
          
          matchedKeywordPrompts = intentFiltered.length > 0 ? intentFiltered : matchedKeywordPrompts;
        }
        
        matchedKeywordInfo = matchedKeywordPrompts[0];
        console.log('🔑 Selected keyword prompt:', matchedKeywordInfo.keyword);
      }
    }

    // 🔥 BƯỚC 4: Phát hiện loại câu hỏi đặc biệt
    const isSuggestionQuestion = this.isSuggestionQuestion(prompt);
    const isAskingForLink = this.isAskingForLink(prompt);
    
    console.log('🔍 Special detection:', {
      isSuggestionQuestion,
      isAskingForLink,
      hasProducts: matchedProducts.length > 0
    });

    // 🔥 BƯỚC 5: Build context
    const context = await this.buildContext(
      prompt,
      metadata,
      extractedKeywords,
      matchedProducts,
      matchedKeywordPrompts,
      isSuggestionQuestion,
      isAskingForLink,
      urlSlug,
      ownerEmail,
      matchedKeywordInfo || undefined
    );

    console.log('🎯 User Intent:', context.userIntent);
    console.log('🎯 Is Asking for Link:', context.isAskingForLink);

    // 🔥 BƯỚC 6: Generate Response - ƯU TIÊN KEYWORD PROMPT TRỰC TIẾP
    let result;
    if (matchedKeywordInfo && this.shouldUseKeywordPromptDirectly(prompt, context)) {
      console.log('🚀 Using keyword prompt with AI enhancement');
      
      // 🎯 LUÔN LUÔN dùng AI tinh chỉnh (trừ các trường hợp đặc biệt)
      const shouldEnhance = this.shouldEnhanceWithAI(prompt, matchedKeywordInfo);
      
      if (shouldEnhance) {
        result = await this.enhanceKeywordResponseWithAI(
          prompt,
          matchedKeywordInfo,
          matchedProducts,
          ownerEmail,
          metadata
        );
      } else {
        // Chỉ dùng sampleAnswer gốc nếu không nên tinh chỉnh
        result = await this.useKeywordPromptDirectly(
          prompt,
          matchedKeywordInfo,
          matchedProducts,
          ownerEmail,
          metadata
        );
      }
    } else {
      result = await this.generateAIResponseWithContext(
        prompt,
        context,
        ownerEmail,
        metadata
      );
    }

    // 🔥 BƯỚC 7: Save & Return
    const msg = await this.saveAssistantMessage(
      convId,
      result.answer,
      result.source,
      result.metadata
    );

    // 🆕 Xây dựng keywordPrompts với đầy đủ thông tin
    const enrichedKeywordPrompts: ResponseKeywordPromptType[] = this.buildEnrichedKeywordPrompts(
      result.metadata?.keywordPrompts,
      matchedKeywordPrompts,
      matchedKeywordInfo
    );

    console.log('📝 Final Keyword Prompts to return:', enrichedKeywordPrompts.map(kp => ({
      id: kp.id,
      keyword: kp.keyword.substring(0, 50),
      sampleAnswer: kp.sampleAnswer?.substring(0, 50) || 'No sample answer'
    })));

    return {
      cached: result.source === 'keyword_prompt' || result.source === 'ai_enhanced' || result.source === 'keyword_prompt_db' || result.source === 'keyword_prompt_fallback',
      conversationId: convId,
      response: {
        id: msg.id,
        text: result.answer,
        source: result.source,
        confidence: result.confidence,
        wordCount: result.answer.split(/\s+/).length,
        products: result.metadata?.products || [],
        keywordPrompts: enrichedKeywordPrompts,
        metadata: {
          extractedKeywords,
          userIntent: context.userIntent,
          hasProducts: matchedProducts.length > 0,
          hasKeywordPrompts: matchedKeywordPrompts.length > 0,
          isSuggestionQuestion,
          isAskingForLink,
          hasSlug: urlSlug || promptSlug,
          isKeywordPromptMatch: matchedKeywordPrompts.length > 0,
          productSlug: matchedProducts[0]?.slug || null
        }
      },
      usage: result.metadata?.usage || {},
    };
  }

private shouldEnhanceWithAI(userPrompt: string, keywordPrompt: KeywordPromptType): boolean {
  // 🎯 LUÔN LUÔN dùng AI để tinh chỉnh cho tự nhiên
  return true;
}


private async enhanceKeywordResponseWithAI(
  userPrompt: string,
  keywordPrompt: KeywordPromptType,
  matchedProducts: ProductType[],
  ownerEmail?: string,
  metadata?: any
): Promise<any> {
  console.log('🎨 Enhancing keyword response with AI');
  
  const sampleAnswer = keywordPrompt.sampleAnswer;
  const originalPrompt = keywordPrompt.prompt || '';
  
  // Xây dựng prompt cho AI tinh chỉnh
  const enhancementPrompt = this.buildEnhancementPrompt(
    userPrompt,
    sampleAnswer,
    originalPrompt,
    matchedProducts,
    metadata
  );
  
  try {
    const ai = await this.openai.callOpenAI(enhancementPrompt, {
      maxTokens: 200,
      temperature: 0.8, // Nhiệt độ cao hơn để sáng tạo hơn
    });
    
    let enhancedAnswer = ai.text.trim();
    
    // Làm sạch response
    enhancedAnswer = this.cleanEnhancedResponse(enhancedAnswer);
    
    // Đảm bảo response không quá ngắn, nếu quá ngắn thì dùng sampleAnswer gốc
    if (enhancedAnswer.length < 20 || this.isInvalidResponse(enhancedAnswer, enhancementPrompt)) {
      console.log('⚠️ Enhanced response too short/invalid, using original sample answer');
      enhancedAnswer = sampleAnswer;
    }
    
    console.log('🎨 Enhanced Response:', enhancedAnswer.substring(0, 200));
    
    return {
      answer: enhancedAnswer,
      confidence: 0.92, // Confidence cao nhưng thấp hơn direct một chút
      source: 'keyword_prompt_enhanced',
      metadata: {
        products: matchedProducts.slice(0, 3).map(this.clean),
        keywordPrompt: {
          id: keywordPrompt.id,
          keyword: keywordPrompt.keyword,
          sampleAnswer: keywordPrompt.sampleAnswer,
          priority: keywordPrompt.priority,
          originalPrompt: keywordPrompt.prompt
        },
        enhanced: true,
        originalAnswer: sampleAnswer.substring(0, 100) + (sampleAnswer.length > 100 ? '...' : '')
      }
    };
    
  } catch (error) {
    console.error('❌ AI Enhancement Failed:', error);
    
    // Fallback: dùng sampleAnswer gốc
    return await this.useKeywordPromptDirectly(
      userPrompt,
      keywordPrompt,
      matchedProducts,
      ownerEmail,
      metadata
    );
  }
}

// 🆕 PHƯƠNG THỨC: Xây dựng prompt để AI tinh chỉnh
private buildEnhancementPrompt(
  userQuestion: string,
  sampleAnswer: string,
  originalInstruction: string,
  products: ProductType[],
  metadata: any
): string {
  return `
Bạn là trợ lý bán hàng thân thiện, nhiệt tình. Hãy VIẾT LẠI câu trả lời mẫu dưới đây sao cho TỰ NHIÊN, GIỐNG CON NGƯỜI NÓI CHUYỆN hơn.

📝 CÂU HỎI CỦA KHÁCH: "${userQuestion}"

📋 CÂU TRẢ LỜI MẪU TỪ HỆ THỐNG:
"""
${sampleAnswer}
"""

🎯 HƯỚNG DẪN TRẢ LỜI GỐC:
"""
${originalInstruction}
"""

${products.length > 0 ? `
📦 THÔNG TIN SẢN PHẨM LIÊN QUAN:
${products.map((p, i) => `${i + 1}. ${p.name} - ${this.fmt(p.price)}`).join('\n')}
` : ''}

${metadata?.slug ? `🔗 Khách đang xem trang sản phẩm: ${metadata.slug}` : ''}

🎨 YÊU CẦU TINH CHỈNH:
1. GIỮ NGUYÊN Ý CHÍNH của câu trả lời mẫu
2. LÀM TỰ NHIÊN HƠN, GIỐNG CON NGƯỜI NÓI CHUYỆN
4. Tránh dùng cấu trúc cứng nhắc, công thức
5. Độ dài: khoảng 2-4 dòng, không quá dài
6. Vẫn giữ thông tin quan trọng từ câu trả lời mẫu


✍️ HÃY VIẾT LẠI CÂU TRẢ LỜI TỰ NHIÊN HƠN:`;
}

// 🆕 PHƯƠNG THỨC: Làm sạch response đã tinh chỉnh
private cleanEnhancedResponse(response: string): string {
  const lines = response.split('\n');
  const cleanLines = lines.filter(line => {
    const l = line.toLowerCase();
    return !l.includes('câu hỏi của khách') &&
           !l.includes('câu trả lời mẫu') &&
           !l.includes('hướng dẫn trả lời gốc') &&
           !l.includes('thông tin sản phẩm liên quan') &&
           !l.includes('yêu cầu tinh chỉnh') &&
           !l.includes('ví dụ:') &&
           !l.includes('hãy viết lại') &&
           !l.startsWith('"""') &&
           !l.startsWith('📝') &&
           !l.startsWith('📋') &&
           !l.startsWith('🎯') &&
           !l.startsWith('📦') &&
           !l.startsWith('🎨') &&
           !l.startsWith('💡') &&
           !l.startsWith('✍️') &&
           line.trim().length > 0;
  });
  
  return cleanLines.join('\n').trim();
}

  // 🆕 QUYẾT ĐỊNH CÓ DÙNG KEYWORD PROMPT TRỰC TIẾP KHÔNG
  private shouldUseKeywordPromptDirectly(prompt: string, context: ChatContext): boolean {
    // Nếu có keyword prompt match và không có sản phẩm cụ thể, dùng trực tiếp
    if (context.matchedKeywordInfo && context.currentProducts.length === 0) {
      return true;
    }
    
    // Nếu câu hỏi đơn giản về chính sách/chung chung
    const lowerPrompt = prompt.toLowerCase();
    const simpleKeywords = [
      'shop bán gì', 'bán gì', 'chính sách', 'địa chỉ', 
      'giờ mở cửa', 'mấy giờ', 'liên hệ', 'hotline'
    ];
    
    if (simpleKeywords.some(keyword => lowerPrompt.includes(keyword))) {
      return true;
    }
    
    return false;
  }

  // 🆕 PHƯƠNG THỨC: Xây dựng keyword prompts với sampleAnswer
  private buildEnrichedKeywordPrompts(
    metadataPrompts: any[],
    matchedPrompts: KeywordPromptType[],
    matchedKeywordInfo?: KeywordPromptType | null
  ): ResponseKeywordPromptType[] {
    const enrichedPrompts: ResponseKeywordPromptType[] = [];

    // 1. Từ metadata (nếu có)
    if (metadataPrompts && Array.isArray(metadataPrompts)) {
      metadataPrompts.forEach(kp => {
        const originalKp = matchedPrompts.find(
          original => original.id.toString() === kp.id?.toString()
        );
        
        enrichedPrompts.push({
          id: kp.id || originalKp?.id || 0,
          keyword: kp.keyword || originalKp?.keyword || '',
          sampleAnswer: originalKp?.sampleAnswer || '',
          priority: kp.priority || originalKp?.priority || 1,
          prompt: originalKp?.prompt,
          additionalInfo: originalKp?.additionalInfo
        });
      });
    }

    // 2. Thêm từ matchedPrompts (nếu chưa có)
    if (matchedPrompts.length > 0 && enrichedPrompts.length === 0) {
      matchedPrompts.forEach(kp => {
        const exists = enrichedPrompts.some(ep => ep.id === kp.id);
        if (!exists) {
          enrichedPrompts.push({
            id: kp.id,
            keyword: kp.keyword,
            sampleAnswer: kp.sampleAnswer || '',
            priority: kp.priority,
            prompt: kp.prompt,
            additionalInfo: kp.additionalInfo
          });
        }
      });
    }

    // 3. Thêm từ matchedKeywordInfo (nếu có)
    if (matchedKeywordInfo && enrichedPrompts.length === 0) {
      const exists = enrichedPrompts.some(ep => ep.id === matchedKeywordInfo.id);
      if (!exists) {
        enrichedPrompts.push({
          id: matchedKeywordInfo.id,
          keyword: matchedKeywordInfo.keyword,
          sampleAnswer: matchedKeywordInfo.sampleAnswer || '',
          priority: matchedKeywordInfo.priority,
          prompt: matchedKeywordInfo.prompt,
          additionalInfo: matchedKeywordInfo.additionalInfo
        });
      }
    }

    // Loại bỏ trùng lặp
    const uniquePrompts = enrichedPrompts.filter((kp, index, self) =>
      index === self.findIndex((t) => t.id === kp.id)
    );

    return uniquePrompts;
  }

  // 🆕 PHƯƠNG THỨC: Dùng keyword prompt trực tiếp từ DB
  private async useKeywordPromptDirectly(
    userQuestion: string,
    keywordPrompt: KeywordPromptType,
    matchedProducts: ProductType[],
    ownerEmail?: string,
    metadata?: any
  ): Promise<any> {
    console.log('🚀 Using keyword prompt directly from DB:', keywordPrompt.keyword);
    
    // Lấy sampleAnswer trực tiếp từ keyword prompt
    let answer = keywordPrompt.sampleAnswer;
    
    // Nếu có sản phẩm, thay thế placeholders
    if (matchedProducts.length > 0) {
      const product = matchedProducts[0];
      answer = this.adaptKeywordResponse(answer, product);
    }
    
    // Làm sạch response
    answer = this.cleanResponse(answer);
    
    console.log('✅ Direct keyword prompt response:', answer.substring(0, 200));
    
    return {
      answer,
      confidence: 0.95,
      source: 'keyword_prompt_db',
      metadata: {
        products: matchedProducts.slice(0, 3).map(this.clean),
        keywordPrompt: {
          id: keywordPrompt.id,
          keyword: keywordPrompt.keyword,
          sampleAnswer: keywordPrompt.sampleAnswer || '',
          priority: keywordPrompt.priority
        },
        usedDbPrompt: true
      }
    };
  }

  // 🆕 PHƯƠNG THỨC CHÍNH: Tạo câu trả lời AI
  private async generateAIResponseWithContext(
    prompt: string,
    context: ChatContext,
    ownerEmail?: string,
    metadata?: any
  ) {
    console.log('🤖 Generating AI response with context...');
    console.log('🎯 User Intent:', context.userIntent);
    
    // 🔥 ƯU TIÊN XỬ LÝ LINK REQUEST
    if (context.isAskingForLink && context.currentProducts.length > 0) {
      console.log('🔗 Handling link request for product:', context.currentProducts[0].name);
      return this.handleLinkRequest(prompt, context);
    }
    
    // Xây dựng prompt cho AI với đầy đủ thông tin
    const aiPrompt = this.buildEnhancedAIPrompt(prompt, context, metadata);
    
    try {
      const ai = await this.openai.callOpenAI(aiPrompt, {
        maxTokens: 300,
        temperature: 0.7,
      });

      let answer = ai.text.trim();
      
      // Kiểm tra response hợp lệ
      if (this.isInvalidResponse(answer, aiPrompt)) {
        console.log('⚠️ Invalid AI response, using fallback');
        return this.getEnhancedFallbackResponse(prompt, context);
      }

      if (context.currentProducts.length > 0) {
        const product = context.currentProducts[0];
        answer = this.ensureBackticksFormat(answer, product.slug);
      }
      
      console.log('🤖 AI Generated Response:', answer.substring(0, 200));
      
      return {
        answer,
        confidence: 0.85,
        source: 'ai_enhanced',
        metadata: {
          products: context.currentProducts.slice(0, 3).map(this.clean),
          keywordPrompts: context.keywordPrompts.slice(0, 3).map(kp => ({
            id: kp.id,
            keyword: kp.keyword,
            sampleAnswer: kp.sampleAnswer || '',
            priority: kp.priority
          })),
          usage: ai.usage,
        },
      };

    } catch (error) {
      console.error('❌ AI Enhanced Response Failed:', error);
      return this.getEnhancedFallbackResponse(prompt, context);
    }
  }

  // 🔗 XỬ LÝ LINK REQUEST
  private handleLinkRequest(prompt: string, context: ChatContext): any {
    const product = context.currentProducts[0];
    
    const answer = `Bạn có thể xem chi tiết sản phẩm **${product.name}** (${this.fmt(product.price)}) tại:\n\n🔗 \`${product.slug}\`\n\nNếu cần hỗ trợ thêm về sản phẩm này, hãy cho tôi biết nhé! 😊`;
    
    return {
      answer,
      confidence: 0.95,
      source: 'product_link',
      metadata: {
        products: [this.clean(product)],
        keywordPrompts: context.keywordPrompts.slice(0, 3).map(kp => ({
          id: kp.id,
          keyword: kp.keyword,
          sampleAnswer: kp.sampleAnswer || '',
          priority: kp.priority
        })),
        hasLink: true,
        productSlug: product.slug,
        productUrl: this.generateProductUrl(product.slug),
      },
    };
  }

  // 🌐 TẠO URL SẢN PHẨM
  private generateProductUrl(slug: string): string {
    const frontendUrl = process.env.FRONTEND_URL || 'https://yourdomain.com';
    return `${frontendUrl}/san-pham/${slug}`;
  }

  // 🏗️ BUILD ENHANCED AI PROMPT - GENERIC CHO MỌI NGÀNH
  private buildEnhancedAIPrompt(
    prompt: string,
    context: ChatContext,
    metadata: any
  ): string {
    let systemPrompt = `Bạn là trợ lý bán hàng thông minh và thân thiện. Hãy trả lời câu hỏi của khách hàng dựa trên thông tin sản phẩm và chính sách của cửa hàng.\n\n`;

    // 1. THÔNG TIN SẢN PHẨM (nếu có)
    if (context.currentProducts.length > 0) {
      systemPrompt += `📦 THÔNG TIN SẢN PHẨM HIỆN CÓ:\n`;
      context.currentProducts.forEach((product, i) => {
        systemPrompt += `${i + 1}. ${product.name}\n`;
        systemPrompt += `   - Giá: ${this.fmt(product.price)}\n`;
        systemPrompt += `   - Slug/Link: ${product.slug}\n`;
        if (product.description) {
          systemPrompt += `   - Mô tả: ${product.description.substring(0, 100)}...\n`;
        }
        if (product.category) {
          systemPrompt += `   - Danh mục: ${product.category}\n`;
        }
      });
      systemPrompt += `\n`;
    } else {
      systemPrompt += `⚠️ LƯU Ý: Không tìm thấy sản phẩm cụ thể trong database. Hãy trả lời chung về cửa hàng.\n\n`;
    }

    // 2. THÔNG TIN ƯU ĐÃI/CHÍNH SÁCH
    if (context.matchedKeywordInfo) {
      systemPrompt += `🎯 THÔNG TIN LIÊN QUAN TỪ HỆ THỐNG:\n`;
      systemPrompt += `- Mẫu trả lời gợi ý: "${context.matchedKeywordInfo.sampleAnswer}"\n`;
      if (context.matchedKeywordInfo.additionalInfo) {
        systemPrompt += `- Thông tin thêm: ${context.matchedKeywordInfo.additionalInfo}\n`;
      }
      systemPrompt += `\n`;
    }

    // 3. HƯỚNG DẪN TRẢ LỜI
    systemPrompt += `📝 HƯỚNG DẪN TRẢ LỜI:\n`;
    
    if (context.isAskingForLink && context.currentProducts.length > 0) {
      systemPrompt += `🔗 KHÁCH ĐANG YÊU CẦU LINK SẢN PHẨM "${context.currentProducts[0].name}":\n`;
      systemPrompt += `- LUÔN LUÔN sử dụng backticks cho slug: \`${context.currentProducts[0].slug}\`\n`;
      systemPrompt += `- Format BẮT BUỘC: "Bạn có thể xem chi tiết tại: \`${context.currentProducts[0].slug}\`"\n`;
      systemPrompt += `- KHÔNG được sử dụng HTML hoặc Markdown links\n`;
      systemPrompt += `- Chỉ sử dụng plain text với backticks\n\n`;
    }
    
    // 4. PHÂN TÍCH CÂU HỎI
    systemPrompt += `\n🔍 PHÂN TÍCH CÂU HỎI:\n`;
    systemPrompt += `- Câu hỏi: "${prompt}"\n`;
    systemPrompt += `- Từ khóa chính: ${context.extractedKeywords.join(', ')}\n`;
    systemPrompt += `- User Intent: ${context.userIntent}\n`;
    systemPrompt += `- Có yêu cầu link: ${context.isAskingForLink ? 'CÓ' : 'KHÔNG'}\n`;
    
    if (context.urlSlug) {
      systemPrompt += `- Khách đang xem trang sản phẩm: ${context.urlSlug}\n`;
    }
    
    systemPrompt += `\n✍️ TRẢ LỜI CỦA BẠN (tự nhiên, thân thiện, kết hợp thông tin trên, bằng tiếng Việt):`;

    return systemPrompt;
  }

  // 🔄 ENHANCED FALLBACK RESPONSE
  private getEnhancedFallbackResponse(prompt: string, context: ChatContext): any {
    // 🆕 ƯU TIÊN XỬ LÝ LINK REQUEST TRƯỚC
    if (context.isAskingForLink && context.currentProducts.length > 0) {
      const product = context.currentProducts[0];
      const answer = `Bạn có thể xem chi tiết sản phẩm **${product.name}** (${this.fmt(product.price)}) tại:\n\n🔗 \`${product.slug}\`\n\nCần thêm thông tin gì về sản phẩm này không ạ? 😊`;
      
      return {
        answer,
        confidence: 0.9,
        source: 'link_fallback',
        metadata: {
          products: [this.clean(product)],
          keywordPrompts: context.keywordPrompts.slice(0, 3).map(kp => ({
            id: kp.id,
            keyword: kp.keyword,
            sampleAnswer: kp.sampleAnswer || '',
            priority: kp.priority
          })),
          hasLink: true,
          productSlug: product.slug,
        },
      };
    }
    
    // Nếu có sản phẩm và keyword prompt, kết hợp chúng
    if (context.currentProducts.length > 0 && context.matchedKeywordInfo) {
      const product = context.currentProducts[0];
      const keywordInfo = context.matchedKeywordInfo;
      
      let answer = `Về sản phẩm ${product.name}:\n\n`;
      answer += `💰 Giá: ${this.fmt(product.price)}\n\n`;
      answer += this.adaptKeywordResponse(keywordInfo.sampleAnswer, product);
      
      return {
        answer,
        confidence: 0.7,
        source: 'enhanced_fallback',
        metadata: {
          products: [this.clean(product)],
          keywordPrompts: [{
            id: keywordInfo.id,
            keyword: keywordInfo.keyword,
            sampleAnswer: keywordInfo.sampleAnswer || '',
            priority: keywordInfo.priority
          }],
        },
      };
    }
    
    // Nếu chỉ có sản phẩm
    if (context.currentProducts.length > 0) {
      const product = context.currentProducts[0];
      return {
        answer: `Sản phẩm ${product.name} hiện có giá ${this.fmt(product.price)}. Bạn cần tôi tư vấn thêm thông tin gì về sản phẩm này không ạ? 😊`,
        confidence: 0.7,
        source: 'product_fallback',
        metadata: {
          products: [this.clean(product)],
          keywordPrompts: context.keywordPrompts.slice(0, 3).map(kp => ({
            id: kp.id,
            keyword: kp.keyword,
            sampleAnswer: kp.sampleAnswer || '',
            priority: kp.priority
          })),
        },
      };
    }
    
    // Nếu chỉ có keyword prompt
    if (context.matchedKeywordInfo) {
      const keywordInfo = context.matchedKeywordInfo;
      return {
        answer: keywordInfo.sampleAnswer,
        confidence: 0.8,
        source: 'keyword_prompt_fallback',
        metadata: {
          products: [],
          keywordPrompts: [{
            id: keywordInfo.id,
            keyword: keywordInfo.keyword,
            sampleAnswer: keywordInfo.sampleAnswer || '',
            priority: keywordInfo.priority
          }],
        },
      };
    }
    
    // Fallback chung
    return this.getSimpleFallbackResponse(prompt);
  }

  // 🧹 Làm sạch response
  private cleanResponse(response: string): string {
    const lines = response.split('\n');
    const cleanLines = lines.filter(line => {
      const l = line.toLowerCase();
      return !l.includes('hướng dẫn cách trả lời') &&
             !l.includes('sản phẩm đang nói đến') &&
             !l.includes('câu hỏi của khách') &&
             !l.includes('"""') &&
             !l.startsWith('dưới đây') &&
             line.trim().length > 0;
    });
    
    return cleanLines.join('\n').trim();
  }

  // 🛠️ ADAPT KEYWORD RESPONSE
  private adaptKeywordResponse(sampleAnswer: string, product?: ProductType): string {
    let answer = sampleAnswer;
    
    if (product) {
      answer = answer.replace(/\[Tên SP\]/g, product.name);
      answer = answer.replace(/\[Giá\]/g, this.fmt(product.price));
      answer = answer.replace(/\[sản phẩm\]/gi, product.name);
      answer = answer.replace(/\[sp\]/gi, product.name);
    }
    
    if (product && !answer.includes(product.name)) {
      answer = `Về sản phẩm ${product.name} (${this.fmt(product.price)}):\n\n${answer}`;
    }
    
    return answer;
  }

  // 🏗️ BUILD CONTEXT
  private async buildContext(
    prompt: string,
    metadata: any,
    extractedKeywords: string[],
    matchedProducts: ProductType[],
    matchedKeywordPrompts: KeywordPromptType[],
    isSuggestionQuestion: boolean,
    isAskingForLink: boolean,
    urlSlug: string | null,
    ownerEmail?: string,
    matchedKeywordInfo?: KeywordPromptType
  ): Promise<ChatContext> {
    const history = metadata.conversationHistory || '';
    
    let userIntent: ChatContext['userIntent'] = 'general_chat';
    
    if (isAskingForLink) {
      if (matchedProducts.length > 0) {
        userIntent = 'link_request';
      } else {
        userIntent = 'general_chat';
      }
    } else if (matchedKeywordPrompts.length > 0 && matchedProducts.length > 0) {
      userIntent = 'product_inquiry';
    } else if (matchedKeywordPrompts.length > 0) {
      userIntent = 'keyword_prompt';
    } else if (isSuggestionQuestion && matchedProducts.length > 0) {
      userIntent = 'product_suggestion';
    } else if (matchedProducts.length > 0) {
      userIntent = 'product_inquiry';
    } else if (isSuggestionQuestion) {
      userIntent = 'product_suggestion';
    }

    return {
      conversationHistory: history,
      currentProducts: matchedProducts,
      keywordPrompts: matchedKeywordPrompts,
      userIntent,
      extractedKeywords,
      searchKeyword: extractedKeywords[0] || null,
      urlSlug,
      isAskingForLink,
      isKeywordPromptMatch: matchedKeywordPrompts.length > 0,
      matchedKeywordInfo,
    };
  }

  // 🎯 PHÁT HIỆN CÂU GỢI Ý SẢN PHẨM
  private isSuggestionQuestion(prompt: string): boolean {
    const lowerPrompt = prompt.toLowerCase().trim();
    
    const hasSuggestionKeyword = this.QUESTION_KEYWORDS.SUGGESTION.some(keyword => 
      lowerPrompt.includes(keyword)
    );

    return hasSuggestionKeyword;
  }

  // 🔗 PHÁT HIỆN CÂU HỎI YÊU CẦU LINK
  private isAskingForLink(prompt: string): boolean {
    const lower = prompt.toLowerCase();
    const hasLinkKeyword = this.QUESTION_KEYWORDS.LINK.some(keyword => 
      lower.includes(keyword)
    );
    
    if (hasLinkKeyword) {
      console.log('🔍 Detected link request keywords in prompt:', prompt);
    }
    
    return hasLinkKeyword;
  }

  // 🛠️ KIỂM TRA BACKTICKS FORMAT
  private ensureBackticksFormat(answer: string, slug: string): string {
    if (slug && answer.includes(slug) && !answer.includes(`\`${slug}\``)) {
      const slugRegex = new RegExp(`\\b${slug}\\b`, 'g');
      answer = answer.replace(slugRegex, `\`${slug}\``);
    }
    return answer;
  }

  // 🆔 TRÍCH XUẤT SLUG TỪ PROMPT
  private extractSlug(text: string): string | null {
    const slugPattern = /([a-z0-9]+(?:-[a-z0-9]+){2,})/gi;
    const matches = text.match(slugPattern);
    
    if (matches && matches.length > 0) {
      const longestSlug = matches.reduce((a, b) => a.length > b.length ? a : b);
      console.log('🔍 Extracted slug from prompt:', longestSlug);
      return longestSlug.toLowerCase();
    }
    
    return null;
  }

  // 🔍 TÌM SẢN PHẨM THEO SLUG
  private async findBySlug(slug: string, ownerEmail?: string): Promise<any> {
    if (!slug) return null;
    
    const product = await this.prisma.product.findFirst({
      where: {
        OR: [
          { slug: { equals: slug, mode: 'insensitive' } },
          { slug: { contains: slug, mode: 'insensitive' } }
        ],
        ...(ownerEmail && { ownerEmail }),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        description: true,
        category: true,
        ownerEmail: true,
        createdAt: true,
      },
    });
    
    if (product) {
      console.log('✅ Found product by slug:', {
        name: product.name,
        slug: product.slug,
        price: product.price
      });
    } else {
      console.log('❌ No product found for slug:', slug);
    }
    
    return product;
  }

  // 🤖 AI PHÂN TÍCH TỪ KHÓA - GENERIC
  private async extractKeywordsUsingAI(prompt: string): Promise<string[]> {
    const aiPrompt = `
Phân tích câu hỏi sau và trích xuất TẤT CẢ từ khóa quan trọng liên quan đến mua bán, sản phẩm, dịch vụ:

📝 Câu hỏi: "${prompt}"

🎯 Yêu cầu:
- Trích xuất từ khóa liên quan đến sản phẩm, dịch vụ, mua bán, chính sách, địa điểm, thời gian
- KHÔNG tập trung vào loại sản phẩm cụ thể nào (thời trang, điện tử, v.v.)
- Chuẩn hóa về chữ thường
- KHÔNG bỏ dấu tiếng Việt
- Format: Mỗi từ khóa 1 dòng

✅ Ví dụ:
- "Tư vấn sản phẩm tốt" → tư vấn, sản phẩm, tốt
- "Shop mở cửa mấy giờ?" → mở cửa, giờ, làm việc, working hours
- "Có hàng không?" → hàng, có, stock, tồn kho

💡 CHỈ trả lời danh sách từ khóa, mỗi từ 1 dòng:`;

    try {
      const result = await this.openai.callOpenAI(aiPrompt, {
        maxTokens: 150,
        temperature: 0.3,
      });

      const keywords = result.text
        .split('\n')
        .map(line => line.trim().toLowerCase())
        .filter(line => line.length > 0 && !line.startsWith('-'))
        .filter(line => !/^[0-9\.]+$/.test(line));

      console.log('🤖 AI Extracted Keywords:', keywords);
      return keywords;
      
    } catch (error) {
      console.error('❌ AI Keyword Extraction Failed:', error);
      return this.fallbackKeywordExtraction(prompt);
    }
  }

  // 🔄 FALLBACK: Trích xuất từ khóa đơn giản
  private fallbackKeywordExtraction(prompt: string): string[] {
    const lower = prompt.toLowerCase();
    const keywords: string[] = [];

    Object.values(this.QUESTION_KEYWORDS).forEach(keywordList => {
      keywordList.forEach(keyword => {
        if (lower.includes(keyword.toLowerCase())) {
          keywords.push(keyword.toLowerCase());
        }
      });
    });

    return [...new Set(keywords)];
  }

  // 🔍 TÌM PRODUCTS THEO KEYWORDS
  private async findProductsByKeywords(
    keywords: string[],
    ownerEmail?: string
  ): Promise<ProductType[]> {
    if (keywords.length === 0) return [];

    const nameKeywords = keywords.filter(kw => kw.length > 2);
    
    const conditions = nameKeywords.flatMap(keyword => [
      { name: { contains: keyword, mode: 'insensitive' as const } },
      { category: { contains: keyword, mode: 'insensitive' as const } },
      { description: { contains: keyword, mode: 'insensitive' as const } },
    ]);

    if (conditions.length === 0) {
      const products = await this.prisma.product.findMany({
        where: {
          ...(ownerEmail && { ownerEmail }),
        },
        select: {
          id: true,
          name: true,
          slug: true,
          price: true,
          description: true,
          category: true,
          ownerEmail: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 3,
      });
      return products as ProductType[];
    }

    const products = await this.prisma.product.findMany({
      where: {
        OR: conditions,
        ...(ownerEmail && { ownerEmail }),
      },
      select: {
        id: true,
        name: true,
        slug: true,
        price: true,
        description: true,
        category: true,
        ownerEmail: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return products as ProductType[];
  }

// 🔍 TÌM KEYWORD PROMPTS THEO KEYWORDS - VERSION NÂNG CAO VỚI SCORING
private async findKeywordPromptsByKeywords(
  keywords: string[],
  ownerEmail?: string,
  userPrompt?: string
): Promise<KeywordPromptType[]> {
  if (!userPrompt) return [];

  console.log('🔍 FINDING KEYWORD PROMPTS FOR:', userPrompt);
  
  const allKeywordPrompts = await this.prisma.keywordPrompt.findMany({
    where: {
      ...(ownerEmail && { ownerEmail }),
    },
    select: {
      id: true,
      keyword: true,
      prompt: true,
      sampleAnswer: true,
      additionalInfo: true,
      priority: true,
      ownerEmail: true,
      createdAt: true,
    },
    orderBy: { priority: 'desc' },
  });

  const lowerUserPrompt = userPrompt.toLowerCase();
  
  // 🆕 PHÂN TÍCH TỪ NGỮ TRONG USER PROMPT
  const userWords = this.tokenizeVietnameseText(lowerUserPrompt);
  console.log('🔍 User words:', userWords);

  const scoredPrompts: Array<{kp: KeywordPromptType, score: number, matches: string[]}> = [];

  // TÍNH ĐIỂM CHO TỪNG KEYWORD PROMPT
  allKeywordPrompts.forEach(dbKp => {
    const patterns = dbKp.keyword.split('|').map(p => p.trim().toLowerCase());
    let totalScore = 0;
    const matchedPatterns: string[] = [];

    patterns.forEach(pattern => {
      let patternScore = 0;
      
      if (pattern.includes(' ')) {
        // 🆕 CỤM TỪ: Tính độ tương đồng
        patternScore = this.calculatePhraseSimilarity(lowerUserPrompt, pattern);
        if (patternScore > 0.7) { // Ngưỡng 70% similarity
          matchedPatterns.push(pattern);
          totalScore += patternScore * 100; // Weight cao cho cụm từ
        }
      } else {
        // 🆕 TỪ ĐƠN: Chỉ tính nếu từ đó có ý nghĩa và không phải stop word
        if (this.isMeaningfulWord(pattern) && userWords.includes(pattern)) {
          const regex = new RegExp(`\\b${pattern}\\b`, 'i');
          if (regex.test(lowerUserPrompt)) {
            matchedPatterns.push(pattern);
            totalScore += 30; // Weight thấp hơn cho từ đơn
          }
        }
      }
    });

    // 🆕 THÊM BONUS CHO CÁC TRƯỜNG HỢP ĐẶC BIỆT
    // Bonus cho pattern dài (cụm từ dài thường chính xác hơn)
    const maxPatternLength = Math.max(...patterns.map(p => p.length));
    totalScore += maxPatternLength * 0.5;

    // Bonus cho priority (nếu có)
    totalScore += dbKp.priority * 10;

    if (totalScore > 0) {
      scoredPrompts.push({
        kp: {
          id: dbKp.id.toString(),
          keyword: dbKp.keyword,
          prompt: dbKp.prompt,
          sampleAnswer: dbKp.sampleAnswer,
          additionalInfo: dbKp.additionalInfo || undefined,
          priority: dbKp.priority,
          ownerEmail: dbKp.ownerEmail || undefined,
          createdAt: dbKp.createdAt || undefined,
        },
        score: totalScore,
        matches: matchedPatterns
      });
    }
  });

  // SẮP XẾP THEO ĐIỂM CAO NHẤT
  scoredPrompts.sort((a, b) => b.score - a.score);

  console.log('\n🔍 SCORED PROMPTS:');
  scoredPrompts.forEach(({kp, score, matches}) => {
    console.log(`- Score ${score.toFixed(1)}: ID ${kp.id} | Matches: ${matches.join(', ')}`);
    console.log(`  Keywords: ${kp.keyword.substring(0, 60)}...`);
  });

  return scoredPrompts.map(({kp}) => kp);
}

// 🆕 PHƯƠNG THỨC: Tokenize tiếng Việt
private tokenizeVietnameseText(text: string): string[] {
  // Loại bỏ dấu câu và tách từ
  const cleaned = text
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  
  return cleaned.split(' ').filter(word => word.length > 1);
}

// 🆕 PHƯƠNG THỨC: Tính độ tương đồng cụm từ
private calculatePhraseSimilarity(userText: string, phrase: string): number {
  // Phương pháp đơn giản: kiểm tra độ phủ
  const phraseWords = phrase.split(' ');
  const userWords = userText.split(' ');
  
  let matchedWords = 0;
  
  phraseWords.forEach(word => {
    if (userText.includes(word)) {
      matchedWords++;
    }
  });
  
  return matchedWords / phraseWords.length;
}

// 🆕 PHƯƠNG THỨC: Kiểm tra từ có ý nghĩa không
private isMeaningfulWord(word: string): boolean {
  const stopWords = [
    'có', 'không', 'gì', 'nào', 'đâu', 'bao', 'nhiêu', 'mấy',
    'vậy', 'ạ', 'nhé', 'nha', 'shop', 'bạn', 'mình', 'tôi', 'tui',
    'và', 'hoặc', 'nhưng', 'mà', 'thì', 'là', 'của', 'cho', 'với'
  ];
  
  return !stopWords.includes(word) && word.length > 2;
}


  private analyzeIntentFromPrompt(prompt: string): string {
    const lower = prompt.toLowerCase();
    
    const intentPatterns = {
      'link_request': /link|đường dẫn|url|xem chi tiết|tham khảo|gửi link|cho xin link|xin link/,
      'purchase': /mua|đặt|chốt|order|mua ngay|mua liền|đặt hàng/,
      'book': /giữ hàng|book|đặt trước|đặt cọc|giữ giúp/,
      'shipping': /giao hàng|ship|vận chuyển|thời gian giao|bao lâu nhận/,
      'price': /giá|bao nhiêu tiền|cost|price/,
      'suggestion': /gợi ý|tư vấn|recommend|nên mua|có sản phẩm gì/,
      'size': /size|kích thước|form dáng/,
      'check_order': /theo dõi đơn|kiểm tra đơn|mã đơn|đơn hàng/,
      'stock': /còn hàng|hết hàng|tồn kho|stock|có sẵn/,
      'policy': /chính sách|điều khoản|terms|policy/,
      'location': /địa chỉ|ở đâu|vị trí|chi nhánh/,
      'working_hours': /mấy giờ|giờ mở cửa|giờ đóng cửa|thời gian làm việc/
    };
    
    for (const [intent, pattern] of Object.entries(intentPatterns)) {
      if (pattern.test(lower)) {
        console.log(`🎯 Detected intent: ${intent}`);
        return intent;
      }
    }
    
    return 'general';
  }

  // 🔄 FALLBACK RESPONSES
  private getSimpleFallbackResponse(prompt: string): any {
    const lowerPrompt = prompt.toLowerCase();
    
    if (this.QUESTION_KEYWORDS.GREETING.some(keyword => lowerPrompt.includes(keyword))) {
      return {
        answer: 'Xin chào! Rất vui được hỗ trợ bạn hôm nay. Bạn cần tôi tư vấn sản phẩm/dịch vụ gì không? 😊',
        confidence: 0.8,
        source: 'fallback_greeting',
        metadata: {},
      };
    }
    
    if (this.QUESTION_KEYWORDS.THANKS.some(keyword => lowerPrompt.includes(keyword))) {
      return {
        answer: 'Không có gì đâu ạ! Rất vui được hỗ trợ bạn. Bạn còn cần giúp gì nữa không? 😊',
        confidence: 0.8,
        source: 'fallback_thanks',
        metadata: {},
      };
    }
    
    if (this.QUESTION_KEYWORDS.GOODBYE.some(keyword => lowerPrompt.includes(keyword))) {
      return {
        answer: 'Tạm biệt bạn! Chúc bạn một ngày tốt lành. Hẹn gặp lại! 👋',
        confidence: 0.8,
        source: 'fallback_goodbye',
        metadata: {},
      };
    }
    
    return {
      answer: 'Xin chào! Tôi có thể giúp gì cho bạn hôm nay? Bạn có thể hỏi tôi về sản phẩm, giá cả, chính sách, địa chỉ, thời gian làm việc...',
      confidence: 0.6,
      source: 'fallback_default',
      metadata: {},
    };
  }

  // 🔍 KIỂM TRA RESPONSE HỢP LỆ
  private isInvalidResponse(answer: string, originalPrompt: string): boolean {
    const invalidPatterns = [
      'Bạn là trợ lý bán hàng',
      '📝 HƯỚNG DẪN',
      '❓ CÂU HỎI',
      '✍️ TRẢ LỜI',
      '📦 THÔNG TIN SẢN PHẨM',
      'Xin lỗi, tôi gặp sự cố kỹ thuật',
      '⚠️ LƯU Ý',
      '🎯 CHÍNH SÁCH ƯU ĐÃI',
      '🔍 PHÂN TÍCH CÂU HỎI'
    ];
    
    const hasInvalidPattern = invalidPatterns.some(pattern => 
      answer.includes(pattern)
    );
    
    if (hasInvalidPattern) {
      return true;
    }
    
    if (answer.length < 5) {
      return true;
    }

    if (!/[a-zA-Z0-9\u00C0-\u1EF9]/.test(answer)) {
      return true;
    }


    return false;
  }

  // 🛠️ HELPER FUNCTIONS
  private clean(p: any) {
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      description: p.description,
      category: p.category,
    };
  }

  private fmt(p: number) {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(p);
  }

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