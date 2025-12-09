import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAiService } from './openai.service';

// Định nghĩa type
type KeywordPromptType = {
  id: string;
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
  // 🔑 TẤT CẢ QUESTION KEYWORDS
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
    POLICY: [
      'chính sách', 'policy', 'điều khoản', 'terms',
      'hỗ trợ', 'support', 'liên hệ', 'contact',
      'hotline', 'email', 'zalo', 'facebook'
    ],
    LOCATION: [
      'địa chỉ', 'ở đâu', 'đường nào', 'vị trí',
      'kho hàng', 'cửa hàng', 'chi nhánh'
    ],
    WORKING_HOURS: [
      'mấy giờ', 'giờ mở cửa', 'giờ đóng cửa', 'làm việc',
      'mở cửa', 'đóng cửa', 'online', 'trực page'
    ],
    PAYMENT: [
      'thanh toán', 'tiền mặt', 'chuyển khoản',
      'cod', 'ship cod', 'thẻ ngân hàng'
    ],
    SUGGESTION: [
      'gợi ý', 'giới thiệu', 'tư vấn', 'recommend', 'suggest',
      'nên mua', 'phù hợp', 'dành cho', 'cho tôi xem',
      'có gì', 'có sản phẩm gì', 'có hàng gì', 'có đồ gì',
      'xem hàng', 'xem sản phẩm', 'xem đồ',
      'shop có gì', 'cửa hàng có gì', 'nên mua gì',
      'cho xem', 'show me', 'show product'
    ],
    LINK: [
      'link', 'xem chi tiết', 'xem thêm', 'xem sản phẩm',
      'cho tui xem', 'cho tôi xem', 'muốn xem', 'tham khảo',
      'đường dẫn', 'url', 'trang sản phẩm', 'chi tiết',
      'xin link', 'cho xin link', 'gửi link', 'share link',
      'đường link', 'liên kết', 'cho tôi link', 'cho tui link'
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
    ],
    STYLE: [
      'màu', 'màu sắc', 'màu gì', 'color', 'colour',
      'chất liệu', 'vải', 'làm bằng', 'material', 'fabric',
      'cotton', 'len', 'da', 'jeans', 'kaki'
    ],
    FEATURE: [
      'tính năng', 'đặc điểm', 'ưu điểm', 'có gì', 'feature',
      'tốt không', 'có tốt không', 'chất lượng', 'độ bền'
    ],
    CARE: [
      'bảo quản', 'giặt', 'sử dụng', 'care', 'wash',
      'ủi', 'là', 'phơi', 'tẩy', 'dry clean'
    ],
    PROMOTION: [
      'khuyến mãi', 'sale', 'discount', 'giảm giá',
      'ưu đãi', 'promotion', 'deal', 'voucher', 'coupon'
    ],
    ACCOUNT: [
      'đăng ký', 'register', 'tài khoản', 'account',
      'đăng nhập', 'login', 'đăng xuất', 'logout',
      'thông tin', 'profile', 'thay đổi mật khẩu'
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
    // 🆕 TRUYỀN THÊM userPrompt để phân tích chính xác
    matchedKeywordPrompts = await this.findKeywordPromptsByKeywords(
      extractedKeywords, 
      ownerEmail,
      prompt  // 🆕 Thêm prompt để phân tích context
    );
    
    // 🆕 ƯU TIÊN MATCH THEO INTENT
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
            // ... các intent khác
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

    // 🔥 BƯỚC 6: Generate Response
    const result = await this.generateAIResponseWithContext(
      prompt,
      context,
      ownerEmail,
      metadata
    );

    // 🔥 BƯỚC 7: Save & Return
    const msg = await this.saveAssistantMessage(
      convId,
      result.answer,
      result.source,
      result.metadata
    );

    return {
      cached: result.source === 'keyword_prompt' || result.source === 'ai_enhanced',
      conversationId: convId,
      response: {
        id: msg.id,
        text: result.answer,
        source: result.source,
        confidence: result.confidence,
        wordCount: result.answer.split(/\s+/).length,
        products: result.metadata?.products || [],
        keywordPrompts: result.metadata?.keywordPrompts || [],
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

  private async useKeywordPromptDirectly(
  userQuestion: string,
  keywordPrompt: KeywordPromptType,
  matchedProducts: ProductType[],
  ownerEmail?: string,
  metadata?: any
): Promise<any> {
  console.log('🚀 Using keyword prompt directly from DB');
  
  // Lấy prompt từ database
  const dbPrompt = keywordPrompt.prompt || keywordPrompt.sampleAnswer;
  
  if (!dbPrompt) {
    console.log('❌ No prompt in keywordPrompt');
    return null;
  }
  
  // Xây dựng prompt gửi lên AI
  const aiPrompt = this.buildDirectPrompt(dbPrompt, userQuestion, matchedProducts, metadata);
  
  try {
    const ai = await this.openai.callOpenAI(aiPrompt, {
      maxTokens: 300,
      temperature: 0.7,
    });
    
    let answer = ai.text.trim();
    
    // Làm sạch response
    answer = this.cleanResponse(answer);
    
    console.log('✅ AI Response from DB prompt:', answer.substring(0, 200));
    
    return {
      answer,
      confidence: 0.95,
      source: 'keyword_prompt_db',
      metadata: {
        products: matchedProducts.slice(0, 3).map(this.clean),
        keywordPrompt: {
          id: keywordPrompt.id,
          keyword: keywordPrompt.keyword,
          priority: keywordPrompt.priority
        },
        usedDbPrompt: true
      }
    };
    
  } catch (error) {
    console.error('❌ AI with DB prompt failed:', error);
    
    // Fallback: dùng sampleAnswer
    return {
      answer: keywordPrompt.sampleAnswer,
      confidence: 0.85,
      source: 'keyword_prompt_fallback',
      metadata: {
        products: matchedProducts.slice(0, 3).map(this.clean),
        keywordPrompt: {
          id: keywordPrompt.id,
          keyword: keywordPrompt.keyword,
          priority: keywordPrompt.priority
        }
      }
    };
  }
}

private buildDirectPrompt(
  dbPrompt: string,        // Prompt từ database
  userQuestion: string,    // Câu hỏi của khách
  products: ProductType[], // Sản phẩm match
  metadata: any
): string {
  return `
Bạn là trợ lý bán hàng chuyên nghiệp. 

Dưới đây là HƯỚNG DẪN CÁCH TRẢ LỜI từ hệ thống:
"""
${dbPrompt}
"""

${products.length > 0 ? `
SẢN PHẨM ĐANG NÓI ĐẾN:
${products.map(p => `- ${p.name} (${this.fmt(p.price)})`).join('\n')}
` : ''}

${metadata?.slug ? `Khách đang xem trang sản phẩm: ${metadata.slug}` : ''}

CÂU HỎI CỦA KHÁCH: "${userQuestion}"

Hãy trả lời theo ĐÚNG hướng dẫn trên. 
Trả lời tự nhiên, thân thiện, bằng tiếng Việt.`;
}

// 🧹 Làm sạch response
private cleanResponse(response: string): string {
  // Loại bỏ các dòng không cần thiết
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

// 🔗 XỬ LÝ LINK REQUEST - ĐÃ SỬA
private handleLinkRequest(prompt: string, context: ChatContext): any {
  const product = context.currentProducts[0];
  
  // 🔥 QUAN TRỌNG: Trả về PLAIN TEXT với slug trong backticks
  const answer = `Bạn có thể xem chi tiết sản phẩm **${product.name}** (${this.fmt(product.price)}) tại:\n\n🔗 \`${product.slug}\`\n\nNếu cần hỗ trợ thêm về sản phẩm này, hãy cho tôi biết nhé! 😊`;
  
  return {
    answer, // 🔥 Chỉ plain text với slug trong backticks
    confidence: 0.95,
    source: 'product_link',
    metadata: {
      products: [this.clean(product)],
      keywordPrompts: [],
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

  // 🏗️ BUILD ENHANCED AI PROMPT
  private buildEnhancedAIPrompt(
    prompt: string,
    context: ChatContext,
    metadata: any
  ): string {
    let systemPrompt = `Bạn là trợ lý bán hàng thông minh và thân thiện. Hãy trả lời câu hỏi của khách hàng dựa trên thông tin sản phẩm thực tế và các chính sách ưu đãi.\n\n`;

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
      systemPrompt += `⚠️ LƯU Ý: Không tìm thấy sản phẩm cụ thể trong database. Hãy trả lời chung về shop.\n\n`;
    }

    // 2. THÔNG TIN ƯU ĐÃI/CHÍNH SÁCH
    if (context.matchedKeywordInfo) {
      systemPrompt += `🎯 CHÍNH SÁCH ƯU ĐÃI LIÊN QUAN:\n`;
      systemPrompt += `- Loại: ${context.matchedKeywordInfo.additionalInfo || 'Không có thông tin thêm'}\n`;
      systemPrompt += `- Mẫu trả lời gợi ý: "${context.matchedKeywordInfo.sampleAnswer}"\n`;
      systemPrompt += `\n`;
    }

    // 3. HƯỚNG DẪN TRẢ LỜI - ĐẶC BIỆT CHO LINK REQUEST
  systemPrompt += `📝 HƯỚNG DẪN TRẢ LỜI:\n`;
  
  if (context.isAskingForLink && context.currentProducts.length > 0) {
    systemPrompt += `🔗 KHÁCH ĐANG YÊU CẦU LINK SẢN PHẨM "${context.currentProducts[0].name}":\n`;
    systemPrompt += `- LUÔN LUÔN sử dụng backticks cho slug: \`${context.currentProducts[0].slug}\`\n`;
    systemPrompt += `- Format BẮT BUỘC: "Bạn có thể xem chi tiết tại: \`${context.currentProducts[0].slug}\`"\n`;
    systemPrompt += `- KHÔNG được sử dụng HTML (<a>, <div>, v.v.)\n`;
    systemPrompt += `- KHÔNG được sử dụng Markdown links: [text](slug)\n`;
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
    
    systemPrompt += `\n✍️ TRẢ LỜI CỦA BẠN (tự nhiên, thân thiện, kết hợp thông tin trên):`;

    return systemPrompt;
  }

  // 🛠️ KIỂM TRA BACKTICKS FORMAT
private ensureBackticksFormat(answer: string, slug: string): string {
  // Nếu có slug nhưng chưa có backticks, thêm vào
  if (slug && answer.includes(slug) && !answer.includes(`\`${slug}\``)) {
    // Thay thế slug không có backticks bằng có backticks
    const slugRegex = new RegExp(`\\b${slug}\\b`, 'g');
    answer = answer.replace(slugRegex, `\`${slug}\``);
  }
  return answer;
}

  // 🔄 ENHANCED FALLBACK RESPONSE
  private getEnhancedFallbackResponse(prompt: string, context: ChatContext): any {
    // 🆕 ƯU TIÊN XỬ LÝ LINK REQUEST TRƯỚC
     if (context.isAskingForLink && context.currentProducts.length > 0) {
    const product = context.currentProducts[0];
    // 🔥 SỬA: Dùng backticks cho slug
    const answer = `Bạn có thể xem chi tiết sản phẩm **${product.name}** (${this.fmt(product.price)}) tại:\n\n🔗 \`${product.slug}\`\n\nCần thêm thông tin gì về sản phẩm này không ạ? 😊`;
    
    return {
      answer, // 🔥 Chỉ plain text
      confidence: 0.9,
      source: 'link_fallback',
      metadata: {
        products: [this.clean(product)],
        keywordPrompts: [],
        hasLink: true,
        productSlug: product.slug,
      },
    };
  }
    
    // Nếu có sản phẩm và keyword prompt, kết hợp chúng
    if (context.currentProducts.length > 0 && context.matchedKeywordInfo) {
      const product = context.currentProducts[0];
      const keywordInfo = context.matchedKeywordInfo;
      
      // Tạo câu trả lời kết hợp cơ bản
      let answer = `Về sản phẩm ${product.name}:\n\n`;
      answer += `💰 Giá: ${this.fmt(product.price)}\n\n`;
      
      // Thêm thông tin từ keyword prompt
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
          keywordPrompts: [],
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
            priority: keywordInfo.priority
          }],
        },
      };
    }
    
    // Fallback chung
    return this.getSimpleFallbackResponse(prompt);
  }

  // 🛠️ ADAPT KEYWORD RESPONSE
  private adaptKeywordResponse(sampleAnswer: string, product?: ProductType): string {
    let answer = sampleAnswer;
    
    // Thay thế các placeholder nếu có
    if (product) {
      answer = answer.replace(/\[Tên SP\]/g, product.name);
      answer = answer.replace(/\[Giá\]/g, this.fmt(product.price));
    }
    
    // Thêm thông tin sản phẩm nếu chưa có
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
    
    // 🆕 ƯU TIÊN LINK REQUEST CAO NHẤT
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

    const hasSpecificProductKeyword = this.QUESTION_KEYWORDS.PRODUCT.some(keyword => 
      lowerPrompt.includes(keyword)
    );

    return hasSuggestionKeyword && !hasSpecificProductKeyword;
  }

  // 🔗 PHÁT HIỆN CÂU HỎI YÊU CẦU LINK
  private isAskingForLink(prompt: string): boolean {
    const lower = prompt.toLowerCase();
    const hasLinkKeyword = this.QUESTION_KEYWORDS.LINK.some(keyword => 
      lower.includes(keyword)
    );
    
    // Log để debug
    if (hasLinkKeyword) {
      console.log('🔍 Detected link request keywords in prompt:', prompt);
    }
    
    return hasLinkKeyword;
  }

  // 🆔 TRÍCH XUẤT SLUG TỪ PROMPT
  private extractSlug(text: string): string | null {
    // Tìm slug pattern (ví dụ: ao-thun-nam-icondenim-new-rules)
    const slugPattern = /([a-z0-9]+(?:-[a-z0-9]+){2,})/gi;
    const matches = text.match(slugPattern);
    
    if (matches && matches.length > 0) {
      // Lấy slug dài nhất
      const longestSlug = matches.reduce((a, b) => a.length > b.length ? a : b);
      console.log('🔍 Extracted slug from prompt:', longestSlug);
      return longestSlug.toLowerCase();
    }
    
    // Tìm tên sản phẩm cụ thể
    const productNames = [
      'Áo Thun Nam ICONDENIM New Rules',
      // Thêm các tên sản phẩm khác nếu cần
    ];
    
    for (const name of productNames) {
      if (text.includes(name)) {
        const slug = name
          .toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-z0-9\s]/g, '')
          .replace(/\s+/g, '-');
        console.log('🔍 Converted product name to slug:', slug);
        return slug;
      }
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

  // 🤖 AI PHÂN TÍCH TỪ KHÓA
  private async extractKeywordsUsingAI(prompt: string): Promise<string[]> {
    const aiPrompt = `
Phân tích câu hỏi sau và trích xuất TẤT CẢ từ khóa quan trọng (bao gồm cả từ đồng nghĩa):

📝 Câu hỏi: "${prompt}"

🎯 Yêu cầu:
- Trích xuất TẤT CẢ từ khóa liên quan đến sản phẩm, chính sách, địa điểm, thời gian
- Bao gồm cả từ đồng nghĩa (ví dụ: áo = shirt = top = thun)
- Chuẩn hóa về chữ thường
- KHÔNG bỏ dấu tiếng Việt
- Format: Mỗi từ khóa 1 dòng

✅ Ví dụ:
- "Tư vấn áo thun nam" → áo, thun, áo thun, shirt, tee, nam
- "Shop mở cửa mấy giờ?" → mở cửa, giờ, làm việc, working hours
- "Có găng tay không?" → găng tay, gloves, phụ kiện

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

    // Ưu tiên tìm theo tên sản phẩm trước
    const nameKeywords = keywords.filter(kw => kw.length > 2);
    
    const conditions = nameKeywords.flatMap(keyword => [
      { name: { contains: keyword, mode: 'insensitive' as const } },
      { category: { contains: keyword, mode: 'insensitive' as const } },
      { description: { contains: keyword, mode: 'insensitive' as const } },
    ]);

    // Nếu không có điều kiện, lấy sản phẩm mới nhất
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

  // 🔍 TÌM KEYWORD PROMPTS THEO KEYWORDS
private async findKeywordPromptsByKeywords(
  keywords: string[],
  ownerEmail?: string,
  userPrompt?: string  // 🆕 Thêm userPrompt để phân tích context
): Promise<KeywordPromptType[]> {
  if (keywords.length === 0) return [];

  // 🆕 Tách keywords thành từng từ riêng lẻ
  const individualWords = keywords.flatMap(kw => 
    kw.split(' ').filter(word => word.length > 2)
  );
  
  const allKeywords = [...keywords, ...individualWords];
  const uniqueKeywords = [...new Set(allKeywords)];
  
  console.log('🔍 All keywords for matching:', uniqueKeywords);

  // Lấy TẤT CẢ keyword prompts
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

  // 🆕 PHÂN TÍCH VÀ MATCH CHÍNH XÁC
  const matchedPrompts = allKeywordPrompts.filter(kp => {
    const keywordPatterns = kp.keyword.split('|').map(k => k.trim().toLowerCase());
    
    // Kiểm tra xem có từ khóa NÀO khớp với prompt không
    const hasExactMatch = keywordPatterns.some(pattern => {
      // Nếu pattern là cụm từ, kiểm tra xem userPrompt có chứa không
      if (pattern.includes(' ') && userPrompt) {
        return userPrompt.toLowerCase().includes(pattern);
      }
      
      // Nếu pattern là từ đơn, kiểm tra trong keywords
      return uniqueKeywords.some(kw => 
        kw.toLowerCase().includes(pattern) || pattern.includes(kw.toLowerCase())
      );
    });
    
    return hasExactMatch;
  });

  console.log('🔑 Matched prompts after filtering:', matchedPrompts.map(kp => kp.keyword));
  
  return matchedPrompts as any;
}

private analyzeIntentFromPrompt(prompt: string): string {
  const lower = prompt.toLowerCase();
  
  // 🆕 Các intent chính
  const intentPatterns = {
    'link_request': /link|đường dẫn|url|xem chi tiết|tham khảo|gửi link|cho xin link|xin link/,
    'purchase': /mua|đặt|chốt|order|mua ngay|mua liền|đặt hàng/,
    'book': /giữ hàng|book|đặt trước|đặt cọc|giữ giúp/,
    'shipping': /giao hàng|ship|vận chuyển|thời gian giao|bao lâu nhận/,
    'price': /giá|bao nhiêu tiền|cost|price/,
    'suggestion': /gợi ý|tư vấn|recommend|nên mua|có sản phẩm gì/,
    'size': /size|kích thước|form dáng/,
    'check_order': /theo dõi đơn|kiểm tra đơn|mã đơn|đơn hàng/
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
        answer: 'Xin chào! Rất vui được hỗ trợ bạn hôm nay. Bạn cần tôi tư vấn sản phẩm gì không? 😊',
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
      answer: 'Xin chào! Tôi có thể giúp gì cho bạn hôm nay? Bạn có thể hỏi tôi về sản phẩm, giá cả, chính sách... 😊',
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

    const emojiCount = (answer.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
    if (emojiCount > answer.length * 0.3) {
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