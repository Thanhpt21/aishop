import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAiService } from './openai.service';
import { Prisma } from '@prisma/client';

interface ChatContext {
  conversationHistory: string;
  currentProducts: any[];
  userIntent: 'product_inquiry' | 'policy_question' | 'general_chat' | 'qa_match';
  searchKeyword: string | null;
  questionCategories: string[];
  specificQuestions: string[];
  qaMatch: {
    answer: string;
    confidence: number;
    metadata: any;
  } | null;
}

@Injectable()
export class ChatService {
  // 🔑 QUESTION KEYWORDS
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
    ],
    WORKING_HOURS: [
      'mấy giờ', 'giờ mở cửa', 'giờ đóng cửa', 'làm việc',
      'mở cửa', 'đóng cửa', 'online', 'trực page',
      'giờ làm việc', 'khung giờ', 'chủ nhật',
      'cuối tuần', 'nghỉ trưa', 'tối muộn', 'ngày lễ',
      'lễ tết', 'tết', 'nghỉ lễ', 'có làm không',
      'trả lời', 'nhắn tin', 'check tin nhắn',
      'sáng', 'tối', 'trưa', 'thời gian làm việc'
    ],

    LOCATION: [
      'địa chỉ', 'ở đâu', 'đường nào', 'vị trí',
      'kho hàng', 'cửa hàng', 'chi nhánh',
      'hà nội', 'hồ chí minh', 'tp.hcm', 'sài gòn',
      'ghé kho', 'xem hàng', 'location', 'thử đồ',
      'trực tiếp', 'store', 'offline', 'văn phòng',
      'nhà', 'lấy hàng', 'tỉnh', 'thành phố',
      'kho hàng ở đâu', 'cửa hàng ở đâu'
    ],

    TRUST: [
      'uy tín', 'tin tưởng', 'có uy tín không',
      'chất lượng', 'ảnh thật', 'ảnh mạng',
      'giống hình', 'như ảnh', 'đúng hình',
      'feedback', 'đánh giá', 'review',
      'khách cũ', 'shop có uy tín',
      'hàng chất lượng', 'sợ hàng kém'
    ],

    PAYMENT: [
      'thanh toán', 'tiền mặt', 'chuyển khoản',
      'cod', 'ship cod', 'thẻ ngân hàng',
      'cà thẻ', 'đặt cọc', 'trả tiền trước',
      'số tài khoản', 'banking', 'tài khoản',
      'kiểm tra hàng', 'xem hàng', 'thử đồ',
      'shipper', 'nhận hàng rồi thanh toán',
      'trả lại shipper', 'lỗi', 'từ chối nhận',
      'không ưng', 'không vừa'
    ],

    DELIVERY: [
      'giao hàng', 'ship', 'vận chuyển', 'delivery',
      'phí ship', 'cước phí', 'tiền vận chuyển',
      'freeship', 'miễn phí ship', 'giảm tiền ship',
      'giá ship', 'thời gian giao', 'bao lâu nhận',
      'khi nào giao', 'gửi hàng', 'đi tỉnh',
      'nội thành', 'ngoại thành', 'hỏa tốc',
      'giao nhanh', 'xe khách', 'đơn nhỏ',
      'đơn lớn', 'xem hàng trước', 'kiểm tra hàng'
    ],

    PRODUCT_CARE: [
      'bảo quản', 'giặt', 'sử dụng', 'care',
      'wash', 'ủi', 'là', 'phơi', 'tẩy',
      'dry clean', 'vệ sinh', 'làm sạch',
      'giặt như thế nào', 'bảo quản sao',
      'có giặt máy được không', 'giặt tay',
      'nhiệt độ giặt', 'chất tẩy rửa'
    ],

    EXCHANGE: [
      'đổi', 'trả', 'hoàn', 'đổi trả',
      'không vừa size', 'chính sách đổi',
      'phí ship đổi', 'size không vừa',
      'đổi size', 'trả hàng', 'hoàn hàng',
      'thời gian đổi trả', 'điều kiện đổi'
    ],

    WARRANTY: [
      'bảo hành', 'warranty', 'lỗi kỹ thuật',
      'sửa chữa', 'bảo trì', 'đường chỉ',
      'hư hỏng', 'lỗi sản xuất', 'bảo hành bao lâu'
    ]
  };


  constructor(
    private prisma: PrismaService,
    private openai: OpenAiService,
  ) {}

async handleChat(body: any) {
  const { conversationId, prompt, metadata = {}, ownerEmail } = body;
  

  const convId = await this.getOrCreateConv(conversationId, prompt);
  await this.saveUserMessage(convId, prompt);

  // 1️⃣ PHÂN TÍCH TỪ KHÓA
  const keywordAnalysis = this.analyzeQuestionKeywords(prompt);

  // 2️⃣ KIỂM TRA LOẠI CÂU HỎI
  const isProductQuestion = this.isProductQuestion(prompt, keywordAnalysis.categories);
  const socialCategories = ['greeting', 'thanks', 'goodbye'];
  const isSocialInteraction = keywordAnalysis.categories.some(cat => 
    socialCategories.includes(cat)
  );

  // 3️⃣ QUYẾT ĐỊNH LUỒNG XỬ LÝ
  if (isProductQuestion || isSocialInteraction) {
    
    const context = await this.analyzeContext(prompt, metadata, ownerEmail);
    
    if (isSocialInteraction && !isProductQuestion) {
       context.userIntent = 'general_chat'; 
       context.qaMatch = null;
    }

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
          hasSlug: metadata?.slug && metadata.slug !== 'none',
          isProductQuestion: isProductQuestion,
          isSocial: isSocialInteraction
        }
      },
      usage: result.metadata?.usage || {},
    };
  } 
  
  else {
    
    const qaMatch = await this.findQAMatch(prompt, ownerEmail);
    
    if (qaMatch) {
      
      const msg = await this.saveAssistantMessage(
        convId,
        qaMatch.answer,
        'qa_match',
        qaMatch.metadata
      );

      return {
        cached: true,
        conversationId: convId,
        response: {
          id: msg.id,
          text: qaMatch.answer,
          source: 'qa_match',
          confidence: qaMatch.confidence,
          wordCount: qaMatch.answer.split(/\s+/).length,
          products: [],
          metadata: {
            qaMatch: true,
            question: qaMatch.metadata?.question,
            categories: keywordAnalysis.categories,
          }
        },
        usage: {},
      };
    }

    // Fallback về AI
    const context = await this.analyzeContext(prompt, metadata, ownerEmail);
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
          hasSlug: metadata?.slug && metadata.slug !== 'none',
          isProductQuestion: false,
        }
      },
      usage: result.metadata?.usage || {},
    };
  }
}

private isProductQuestion(prompt: string, categories: string[]): boolean {
  const lowerPrompt = prompt.toLowerCase();
  
  
  const STRONG_PRODUCT_KEYWORDS = [
    'áo', 'quần', 'giày', 'dép', 'mũ', 'nón', 'túi', 'ví', 'váy', 'đầm',
    'thun', 'sơ mi', 'jeans', 'kaki', 'short', 'hoodie', 'jacket',
    'vớ', 'tất', 'phụ kiện', 'thắt lưng', 'khăn', 'găng tay',
    'tư vấn sản phẩm', 'giới thiệu sản phẩm', 'có sản phẩm nào',
    'xem sản phẩm', 'xem hàng', 'xem đồ', 'sản phẩm này',
    'áo nào', 'quần nào', 'giày nào', 'mẫu nào', 'kiểu nào',
    'nó', 'cái này', 'sản phẩm này', 'cái đó'
  ];

  const PRODUCT_CATEGORIES = [
    'product', 'price', 'size', 'style', 'feature'
  ];

  const hasStrongProductKeyword = STRONG_PRODUCT_KEYWORDS.some(keyword => 
    lowerPrompt.includes(keyword.toLowerCase())
  );

  const hasProductCategory = categories.some(cat => 
    PRODUCT_CATEGORIES.includes(cat)
  );

  const isProductQueryPattern = 
    (lowerPrompt.includes('tư vấn') && (lowerPrompt.includes('áo') || lowerPrompt.includes('quần') || lowerPrompt.includes('giày'))) ||
    (lowerPrompt.includes('có') && lowerPrompt.includes('gì') && (lowerPrompt.includes('sản phẩm') || lowerPrompt.includes('hàng'))) ||
    (lowerPrompt.includes('sản phẩm') && (lowerPrompt.includes('nào') || lowerPrompt.includes('gì')));

  const result = hasStrongProductKeyword || hasProductCategory || isProductQueryPattern;
  
  return result;
}

  // =============== PHÂN TÍCH TỪ KHÓA ===============
  private analyzeQuestionKeywords(prompt: string): {
    categories: string[];
    specificQuestions: string[];
  } {
    const lower = prompt.toLowerCase();
    const categories: string[] = [];
    const specificQuestions: string[] = [];

    Object.entries(this.QUESTION_KEYWORDS).forEach(([category, keywords]) => {
      const matchedKeywords = keywords.filter(keyword => 
        lower.includes(keyword.toLowerCase())
      );

      if (matchedKeywords.length > 0) {
        categories.push(category.toLowerCase());
        specificQuestions.push(...matchedKeywords);
      }
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
  
  const keywordAnalysis = this.analyzeQuestionKeywords(prompt);
  
  // ⚠️ findQAMatch được gọi ở handleChat nếu không phải Product/Social
  // Chỉ gọi lại ở đây nếu userIntent được ép thành QA match từ bên ngoài (ít xảy ra)
  const qaMatch = await this.findQAMatch(prompt, ownerEmail);
  
  const userIntent = qaMatch 
    ? 'qa_match' 
    : this.classifyIntent(prompt, keywordAnalysis.categories);
  
  const searchKeyword = this.extractSearchKeyword(prompt);
  
  
  // TÌM SẢN PHẨM: Dùng searchProductsByKeyword mới
  const currentProducts = qaMatch 
    ? []
    : await this.findRelevantProducts(
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
    qaMatch,
  };
}

private async findQAMatch(prompt: string, ownerEmail?: string): Promise<any> {
  try {
    const keywordAnalysis = this.analyzeQuestionKeywords(prompt);
    const socialCategories = ['greeting', 'thanks', 'goodbye'];
    const isSocialOnly = keywordAnalysis.categories.length > 0 && 
                         keywordAnalysis.categories.every(cat => socialCategories.includes(cat));

    // Bỏ qua QA cho Social và Product questions
    if (isSocialOnly || this.isProductQuestion(prompt, [])) {
      return null;
    }

    // 🎯 Simple QA Search (Exact match hoặc Contains match)
    const match = await this.prisma.exampleQA.findFirst({
      where: {
        isActive: true,
        OR: [
          { question: { equals: prompt, mode: 'insensitive' } },
          { question: { contains: prompt, mode: 'insensitive' } },
        ],
        ...(ownerEmail && { ownerEmail }),
      },
      orderBy: { createdAt: 'desc' },
    });

    if (match) {
      return {
        answer: match.answer,
        confidence: match.question.toLowerCase() === prompt.toLowerCase() ? 0.99 : 0.95,
        metadata: { source: 'qa_match', qaId: match.id, question: match.question },
      };
    }
    
    return null;
    
  } catch (error) {
    return null;
  }
}

// Hàm trích xuất từ khóa NON-PRODUCT (Không đổi)
private extractNonProductKeywords(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const keywords: string[] = [];
  
  const NON_PRODUCT_KEYWORDS = [
    'địa chỉ', 'ở đâu', 'đường nào', 'vị trí',
    'lễ tết', 'ngày lễ', 'làm việc', 'mở cửa', 'đóng cửa',
    'giờ làm', 'khung giờ', 'trực', 'online',
    'ship', 'giao hàng', 'vận chuyển', 'phí ship',
    'thanh toán', 'cod', 'chuyển khoản', 'tiền mặt',
    'đổi trả', 'bảo hành', 'chính sách',
    'liên hệ', 'hotline', 'zalo', 'facebook', 'email',
    'chi nhánh', 'tỉnh', 'thành phố', 'quận'
  ];
  
  NON_PRODUCT_KEYWORDS.forEach(word => {
    if (lower.includes(word)) {
      keywords.push(word);
    }
  });
  
  return keywords;
}


// --- Các hàm phân loại/trích xuất (Không đổi) ---

private classifyIntent(
  prompt: string,
  categories: string[]
): ChatContext['userIntent'] {
  const socialCategories = ['greeting', 'thanks', 'goodbye'];
  const isSocialInteraction = categories.some(cat => socialCategories.includes(cat));
  
  if (isSocialInteraction && categories.length === 1) {
    return 'general_chat';
  }

  const policyCategories = [
    'policy', 'shipping', 'return', 'account', 'promotion',
    'working_hours', 'location', 'trust', 'payment', 'delivery',
    'product_care', 'exchange', 'warranty'
  ];
  
  if (categories.some(cat => policyCategories.includes(cat))) {
    return 'policy_question';
  }

  const productCategories = ['product', 'price', 'purchase', 'size', 'style', 'advice', 'feature', 'care', 'follow_up'];
  
  if (categories.some(cat => productCategories.includes(cat))) {
    return 'product_inquiry';
  }

  return 'general_chat';
}

  private extractSearchKeyword(prompt: string): string | null {
    const lower = prompt.toLowerCase();
    
    const productKeywords = this.QUESTION_KEYWORDS.PRODUCT;
    
    for (const keyword of productKeywords) {
      if (lower.includes(keyword)) {
        return keyword;
      }
    }

    return null;
  }

  // =============== TÌM SẢN PHẨM LIÊN QUAN - ĐÃ BỎ FUZZY ===============
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
        return [product];
      }
    }

    // 2. Slug trong prompt
    const promptSlug = this.extractSlug(prompt);
    if (promptSlug) {
      const product = await this.findBySlug(promptSlug, ownerEmail);
      if (product) {
        return [product];
      }
    }

   // 3. TÌM THEO KEYWORD - CHỈ DÙNG SIMPLE SEARCH (CÓ DẤU)
  if (searchKeyword) {
    const products = await this.searchProductsByKeyword(searchKeyword, ownerEmail);
    
    if (products.length > 0) {
      return products;
    }
  }

    // 4. History
    if (history) {
      const historyProducts = await this.extractProductsFromHistory(history, ownerEmail);
      if (historyProducts.length > 0) {
        return [historyProducts[0]];
      }
    }

    return [];
  }

  // =============== TÌM SẢN PHẨM THEO KEYWORD - ĐÃ ĐƠN GIẢN HÓA ===============
private async searchProductsByKeyword(
  keyword: string,
  ownerEmail?: string
): Promise<any[]> {
  
  const lowerKeyword = keyword.toLowerCase();
  
  // 1. Primary search using the raw keyword (case-insensitive)
  const primaryConditions: Prisma.ProductWhereInput[] = [
    { name: { contains: keyword, mode: 'insensitive' as const} }, 
    { category: { contains: keyword, mode: 'insensitive' as const} },
    { description: { contains: keyword, mode: 'insensitive' as const} },
  ];

  // 2. Add keyword mappings conditions
  const mappings = this.getKeywordMappings(lowerKeyword);
  const mappingConditions = mappings.flatMap(mapping => [
    { name: { contains: mapping, mode: 'insensitive' as const} },
    { category: { contains: mapping, mode: 'insensitive' as const} },
    { description: { contains: mapping, mode: 'insensitive' as const} },
  ]);
  
  const products = await this.prisma.product.findMany({
    where: {
      isActive: true,
      OR: [...primaryConditions, ...mappingConditions],
      ...(ownerEmail && { ownerEmail }),
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  return products;
}


private getKeywordMappings(keyword: string): string[] {
  const lowerKeyword = keyword.toLowerCase();
  const mappings: Record<string, string[]> = {
    // ============ ÁO ============
    'áo': ['áo', 'shirt', 'top', 'tee', 'tshirt', 'thun', 'ao'],
    'ao': ['áo', 'shirt', 'top', 'tee', 'tshirt', 'thun', 'ao'],
    'áo thun': ['áo thun', 't-shirt', 'tee shirt', 'cotton shirt', 'tank top', 'sleeveless'],
    'áo sơ mi': ['áo sơ mi', 'dress shirt', 'formal shirt', 'button-down', 'somi'],
    'áo sơ mi nam': ['áo sơ mi nam', 'men shirt', 'business shirt'],
    'áo sơ mi nữ': ['áo sơ mi nữ', 'women blouse', 'ladies shirt'],
    'áo polo': ['áo polo', 'polo shirt', 'tennis shirt', 'golf shirt'],
    'áo khoác': ['áo khoác', 'jacket', 'outerwear', 'coat', 'blazer', 'windbreaker'],
    'áo len': ['áo len', 'sweater', 'jumper', 'pullover', 'wool'],
    'áo hoodie': ['áo hoodie', 'hooded sweater', 'hoodie', 'sweatshirt'],
    'áo cardigan': ['áo cardigan', 'cardigan', 'knit jacket'],
    'áo vest': ['áo vest', 'vest', 'waistcoat'],
    'áo bò': ['áo bò', 'denim shirt', 'jeans shirt'],
    'áo phông': ['áo phông', 't-shirt', 'cotton tee'],
    'áo ba lỗ': ['áo ba lỗ', 'tank top', 'sleeveless'],
    'áo croptop': ['áo croptop', 'crop top', 'short top'],
    'áo dài': ['áo dài', 'vietnamese dress', 'traditional'],
    'áo kiểu': ['áo kiểu', 'fashion top', 'designer top'],
    'áo tay dài': ['áo tay dài', 'long sleeve'],
    'áo tay ngắn': ['áo tay ngắn', 'short sleeve'],
    'áo tay lỡ': ['áo tay lỡ', 'three-quarter sleeve'],
    'áo cổ lọ': ['áo cổ lọ', 'turtle neck', 'polo neck'],
    'áo cổ tròn': ['áo cổ tròn', 'crew neck', 'round neck'],
    'áo cổ tim': ['áo cổ tim', 'v-neck'],
    'áo cổ thuyền': ['áo cổ thuyền', 'boat neck'],
    'áo cổ vuông': ['áo cổ vuông', 'square neck'],

    // ============ QUẦN ============
    'quần': ['quần', 'pants', 'trousers', 'jeans', 'shorts', 'quan'],
    'quan': ['quần', 'pants', 'trousers', 'jeans', 'shorts', 'quan'],
    'quần jean': ['quần jean', 'jeans', 'denim pants', 'blue jeans'],
    'quần tây': ['quần tây', 'trousers', 'dress pants', 'slacks'],
    'quần kaki': ['quần kaki', 'chinos', 'khaki pants'],
    'quần short': ['quần short', 'shorts', 'bermuda', 'short pants'],
    'quần jogger': ['quần jogger', 'joggers', 'sweatpants'],
    'quần legging': ['quần legging', 'leggings', 'yoga pants'],
    'quần ống rộng': ['quần ống rộng', 'wide leg', 'baggy'],
    'quần ống suông': ['quần ống suông', 'straight leg'],
    'quần ống côn': ['quần ống côn', 'tapered', 'skinny'],
    'quần ống loe': ['quần ống loe', 'flare', 'bell bottom'],
    'quần culottes': ['quần culottes', 'culottes', 'wide-leg shorts'],
    'quần váy': ['quần váy', 'skirt pants', 'palazzo'],
    'quần yếm': ['quần yếm', 'overalls', 'dungarees'],
    'quần boxer': ['quần boxer', 'boxer shorts', 'underwear'],
    'quần lót': ['quần lót', 'underwear', 'briefs', 'boxers'],
    'quần thể thao': ['quần thể thao', 'sport pants', 'training pants'],

    // ============ VÁY - ĐẦM ============
    'váy': ['váy', 'skirt', 'dress'],
    'đầm': ['đầm', 'dress', 'gown', 'frock'],
    'đầm dự tiệc': ['đầm dự tiệc', 'party dress', 'evening gown'],
    'đầm công sở': ['đầm công sở', 'office dress', 'work dress'],
    'đầm maxi': ['đầm maxi', 'maxi dress', 'long dress'],
    'đầm midi': ['đầm midi', 'midi dress', 'knee-length'],
    'đầm mini': ['đầm mini', 'mini dress', 'short dress'],
    'đầm body': ['đầm body', 'bodycon dress', 'fitted dress'],
    'đầm xòe': ['đầm xòe', 'flare dress', 'a-line dress'],
    'đầm ôm': ['đầm ôm', 'tight dress', 'fitted dress'],
    'váy ngắn': ['váy ngắn', 'mini skirt', 'short skirt'],
    'váy dài': ['váy dài', 'long skirt', 'maxi skirt'],
    'váy chữ a': ['váy chữ a', 'a-line skirt'],
    'váy xếp ly': ['váy xếp ly', 'pleated skirt'],
    'váy jeans': ['váy jeans', 'denim skirt'],
    'váy tutu': ['váy tutu', 'tutu skirt', 'ballet skirt'],

    // ============ GIÀY - DÉP ============
    'giày': ['giày', 'shoes', 'footwear', 'giay'],
    'giay': ['giày', 'shoes', 'footwear', 'giay'],
    'giày thể thao': ['giày thể thao', 'sneakers', 'athletic shoes', 'trainers'],
    'giày sneaker': ['giày sneaker', 'sneakers', 'casual shoes'],
    'giày cao gót': ['giày cao gót', 'high heels', 'heels', 'stilettos'],
    'giày búp bê': ['giày búp bê', 'mary janes', 'doll shoes'],
    'giày boot': ['giày boot', 'boots', 'ankle boots'],
    'giày lười': ['giày lười', 'loafers', 'slip-ons'],
    'giày oxford': ['giày oxford', 'oxford shoes', 'dress shoes'],
    'giày sandal': ['giày sandal', 'sandals', 'open toe'],
    'giày dép': ['giày dép', 'sandals', 'flip-flops'],
    'dép': ['dép', 'sandals', 'flip-flops', 'slippers'],
    'dép quai hậu': ['dép quai hậu', 'sandals', 'strap sandals'],
    'dép lào': ['dép lào', 'flip-flops', 'thongs'],
    'dép bệt': ['dép bệt', 'flat sandals'],
    'dép cao gót': ['dép cao gót', 'heeled sandals'],
    'giày da': ['giày da', 'leather shoes'],
    'giày vải': ['giày vải', 'canvas shoes', 'fabric shoes'],
    'giày chạy bộ': ['giày chạy bộ', 'running shoes'],
    'giày bóng đá': ['giày bóng đá', 'soccer shoes', 'football boots'],
    'giày bóng rổ': ['giày bóng rổ', 'basketball shoes'],

    // ============ MŨ - NÓN ============
    'mũ': ['mũ', 'hat', 'cap', 'nón', 'mu'],
    'mu': ['mũ', 'hat', 'cap', 'nón', 'mu'],
    'nón': ['nón', 'hat', 'cap', 'mũ'],
    'mũ lưỡi trai': ['mũ lưỡi trai', 'baseball cap', 'cap'],
    'mũ bucket': ['mũ bucket', 'bucket hat', 'fishing hat'],
    'mũ beret': ['mũ beret', 'beret', 'french hat'],
    'mũ len': ['mũ len', 'beanie', 'winter hat', 'wool hat'],
    'mũ rộng vành': ['mũ rộng vành', 'wide brim hat', 'sun hat'],
    'nón bảo hiểm': ['nón bảo hiểm', 'helmet'],
    'nón kết': ['nón kết', 'straw hat', 'summer hat'],

    // ============ TÚI - VÍ ============
    'túi': ['túi', 'bag', 'purse', 'handbag'],
    'ví': ['ví', 'wallet', 'purse'],
    'túi xách': ['túi xách', 'handbag', 'purse'],
    'túi đeo chéo': ['túi đeo chéo', 'crossbody bag', 'shoulder bag'],
    'túi tote': ['túi tote', 'tote bag', 'shopping bag'],
    'túi backpack': ['túi backpack', 'backpack', 'rucksack'],
    'túi clutch': ['túi clutch', 'clutch bag', 'evening bag'],
    'túi bucket': ['túi bucket', 'bucket bag'],
    'túi mini': ['túi mini', 'mini bag', 'small bag'],
    'ví nam': ['ví nam', 'men wallet', 'leather wallet'],
    'ví nữ': ['ví nữ', 'women wallet', 'ladies wallet'],
    'ví da': ['ví da', 'leather wallet'],

    // ============ PHỤ KIỆN ============
    'phụ kiện': ['phụ kiện', 'accessories', 'fashion accessories'],
    'thắt lưng': ['thắt lưng', 'belt', 'waist belt'],
    'khăn': ['khăn', 'scarf', 'shawl', 'wrap'],
    'khăn quàng cổ': ['khăn quàng cổ', 'scarf', 'neck scarf'],
    'khăn tay': ['khăn tay', 'handkerchief'],
    'cà vạt': ['cà vạt', 'tie', 'neck tie'],
    'nơ': ['nơ', 'bow', 'hair bow'],
    'vòng cổ': ['vòng cổ', 'necklace', 'choker'],
    'vòng tay': ['vòng tay', 'bracelet', 'bangle'],
    'vòng chân': ['vòng chân', 'anklet'],
    'bông tai': ['bông tai', 'earrings', 'ear studs'],
    'nhẫn': ['nhẫn', 'ring', 'finger ring'],
    'kính mát': ['kính mát', 'sunglasses', 'sun glasses'],
    'kính cận': ['kính cận', 'glasses', 'spectacles'],
    'găng tay': ['găng tay', 'gloves', 'hand gloves', 'bao tay'],
    'gang tay': ['găng tay', 'gloves', 'hand gloves', 'bao tay'],
    'bao tay': ['bao tay', 'gloves', 'găng tay'],
    'tất': ['tất', 'socks', 'stockings'],
    'vớ': ['vớ', 'socks', 'stockings'],
    'vo': ['vớ', 'socks', 'stockings'],
    'tất dài': ['tất dài', 'stockings', 'pantyhose'],
    'tất lưới': ['tất lưới', 'fishnet stockings'],
    'nịt bụng': ['nịt bụng', 'corset', 'waist trainer'],
    'nịt vú': ['nịt vú', 'bra', 'bralette'],

    // ============ ĐỒ LÓT ============
    'đồ lót': ['đồ lót', 'underwear', 'lingerie'],
    'áo lót': ['áo lót', 'bra', 'brassiere'],
    'nội y': ['nội y', 'lingerie', 'underwear'],
    'bodysuit': ['bodysuit', 'body suit', 'one-piece'],
    'áo ngực': ['áo ngực', 'bra', 'brassiere'],

    // ============ ĐỒ BƠI ============
    'đồ bơi': ['đồ bơi', 'swimwear', 'bathing suit'],
    'bikini': ['bikini', 'two-piece', 'swimsuit'],
    'áo tắm': ['áo tắm', 'swimsuit', 'bathing suit'],
    'quần bơi': ['quần bơi', 'swim trunks', 'bathing shorts'],

    // ============ THỜI TRANG TRẺ EM ============
    'đồ trẻ em': ['đồ trẻ em', 'kids clothing', 'children wear'],
    'đồ sơ sinh': ['đồ sơ sinh', 'baby clothes', 'infant wear'],
    'đồ bé trai': ['đồ bé trai', 'boys clothing'],
    'đồ bé gái': ['đồ bé gái', 'girls clothing'],
    'bộ bodysuit': ['bộ bodysuit', 'baby onesie'],

    // ============ FORM DÁNG ============
    'form': ['form', 'fit', 'cut', 'silhouette'],
    'oversize': ['oversize', 'loose fit', 'baggy'],
    'regular': ['regular', 'regular fit', 'standard fit'],
    'slim': ['slim', 'slim fit', 'tight fit'],
    'skinny': ['skinny', 'skinny fit', 'very tight'],
    'relax': ['relax', 'relaxed fit', 'comfort fit'],
    'boxy': ['boxy', 'square fit', 'straight cut'],

    // ============ CHẤT LIỆU ============
    'cotton': ['cotton', 'bông', 'vải cotton'],
    'len': ['len', 'wool', 'dệt kim'],
    'denim': ['denim', 'jeans', 'vải bò'],
    'kaki': ['kaki', 'khaki', 'chino'],
    'lụa': ['lụa', 'silk', 'lụa tơ tằm'],
    'da': ['da', 'leather', 'genuine leather'],
    'da lộn': ['da lộn', 'suede'],
    'nỉ': ['nỉ', 'felt', 'fleece'],
    'jean': ['jean', 'denim', 'vải jeans'],
    'thun': ['thun', 'knit', 'jersey'],
    'lưới': ['lưới', 'mesh', 'net'],
    'voan': ['voan', 'chiffon', 'sheer'],
    'nhung': ['nhung', 'velvet', 'velour'],
    'lanh': ['lanh', 'linen', 'vải lanh'],
    'polyester': ['polyester', 'poly', 'synthetic'],
    'spandex': ['spandex', 'elastane', 'lycra'],

    // ============ MÀU SẮC ============
    'đen': ['đen', 'black'],
    'trắng': ['trắng', 'white'],
    'xám': ['xám', 'gray', 'grey'],
    'xanh': ['xanh', 'blue', 'green'],
    'xanh dương': ['xanh dương', 'blue', 'navy'],
    'xanh lá': ['xanh lá', 'green', 'emerald'],
    'đỏ': ['đỏ', 'red', 'crimson'],
    'hồng': ['hồng', 'pink', 'rose'],
    'tím': ['tím', 'purple', 'violet'],
    'vàng': ['vàng', 'yellow', 'gold'],
    'cam': ['cam', 'orange', 'tangerine'],
    'nâu': ['nâu', 'brown', 'chocolate'],
    'be': ['be', 'beige', 'tan'],
    'kem': ['kem', 'cream', 'ivory'],
    'pastel': ['pastel', 'soft color', 'light color'],
    'hoạ tiết': ['hoạ tiết', 'pattern', 'print', 'design'],
    'kẻ sọc': ['kẻ sọc', 'striped', 'stripes'],
    'caro': ['caro', 'checkered', 'plaid'],
    'chấm bi': ['chấm bi', 'polka dot', 'dots'],

    // ============ THƯƠNG HIỆU ============
    'nike': ['nike', 'swoosh'],
    'adidas': ['adidas', 'three stripes'],
    'gucci': ['gucci', 'luxury brand'],
    'lv': ['lv', 'louis vuitton'],
    'chanel': ['chanel', 'french luxury'],
    'zara': ['zara', 'fast fashion'],
    'h&m': ['h&m', 'hm', 'h and m'],
    'uniqlo': ['uniqlo', 'japanese brand'],
    'puma': ['puma', 'sport brand'],
    'converse': ['converse', 'all star'],
    'vans': ['vans', 'skate shoes'],
    'levis': ['levis', 'levi\'s', 'jeans brand'],
    'ck': ['ck', 'calvin klein'],

    // ============ DỊP ============
    'đi làm': ['đi làm', 'office', 'work', 'business'],
    'đi chơi': ['đi chơi', 'casual', 'hangout', 'outing'],
    'dự tiệc': ['dự tiệc', 'party', 'event', 'gala'],
    'đi học': ['đi học', 'school', 'university', 'campus'],
    'du lịch': ['du lịch', 'travel', 'vacation', 'holiday'],
    'thể thao': ['thể thao', 'sport', 'gym', 'workout'],
    'cưới': ['cưới', 'wedding', 'bridal', 'marriage'],
    'mùa hè': ['mùa hè', 'summer', 'hot weather'],
    'mùa đông': ['mùa đông', 'winter', 'cold weather'],
    'mùa thu': ['mùa thu', 'autumn', 'fall'],
    'mùa xuân': ['mùa xuân', 'spring'],

    // ============ TÍNH NĂNG ============
    'chống nước': ['chống nước', 'waterproof', 'water-resistant'],
    'chống UV': ['chống UV', 'UV protection', 'sun protection'],
    'thoáng khí': ['thoáng khí', 'breathable', 'airy'],
    'co giãn': ['co giãn', 'stretch', 'elastic'],
    'giữ ấm': ['giữ ấm', 'warm', 'insulated'],
    'mát': ['mát', 'cool', 'lightweight'],
    'bền': ['bền', 'durable', 'long-lasting'],
    'dễ giặt': ['dễ giặt', 'easy care', 'washable'],
    'không nhăn': ['không nhăn', 'wrinkle-free', 'non-iron'],

    // ============ KÍCH THƯỚC ============
    'size': ['size', 'kích thước', 'measurement'],
    'S': ['S', 'small', 'nhỏ'],
    'M': ['M', 'medium', 'vừa'],
    'L': ['L', 'large', 'lớn'],
    'XL': ['XL', 'extra large', 'rất lớn'],
    'XS': ['XS', 'extra small', 'rất nhỏ'],
    'XXL': ['XXL', 'double extra large'],
    'free size': ['free size', 'one size', 'uni-size'],

    // ============ TỪ KHÓA CHUNG ============
    'thời trang': ['thời trang', 'fashion', 'style', 'trend'],
    'thời trang nam': ['thời trang nam', 'men fashion', 'menswear'],
    'thời trang nữ': ['thời trang nữ', 'women fashion', 'womenswear'],
    'phong cách': ['phong cách', 'style', 'look', 'aesthetic'],
    'bộ sưu tập': ['bộ sưu tập', 'collection', 'line'],
    'hàng mới': ['hàng mới', 'new arrival', 'latest'],
    'sale': ['sale', 'giảm giá', 'discount', 'khuyến mãi'],
    'giá rẻ': ['giá rẻ', 'cheap', 'affordable', 'budget'],
    'cao cấp': ['cao cấp', 'premium', 'luxury', 'high-end'],
    'basic': ['basic', 'cơ bản', 'essential'],
    'trendy': ['trendy', 'hợp thời', 'hot trend'],
    'vintage': ['vintage', 'retro', 'cổ điển'],
    'streetwear': ['streetwear', 'urban', 'street style'],
    'casual': ['casual', 'thường ngày', 'everyday'],
    'formal': ['formal', 'trang trọng', 'official'],
    'sporty': ['sporty', 'thể thao', 'athleisure'],
    'elegant': ['elegant', 'thanh lịch', 'sophisticated'],
    'sexy': ['sexy', 'quyến rũ', 'seductive'],
    'cute': ['cute', 'dễ thương', 'adorable'],
  };

  // Tìm kiếm không chỉ exact match mà còn partial match
  for (const [key, synonyms] of Object.entries(mappings)) {
    if (lowerKeyword.includes(key) || key.includes(lowerKeyword)) {
      return synonyms;
    }
  }

  return [];
}


// --- Các hàm hỗ trợ AI (Đã bỏ console.log) ---

private async generateAIResponse(
  prompt: string,
  context: ChatContext,
  ownerEmail?: string,
  metadata?: any
) {
  if (context.userIntent !== 'qa_match') {
    const aiPrompt = this.buildDynamicAIPrompt(prompt, context, metadata || {});
    
    try {
      const ai = await this.openai.callOpenAI(aiPrompt, {
        maxTokens: 250,
        temperature: 0.7,
      });

      const answer = ai.text.trim();
      
      if (this.isInvalidResponse(answer, aiPrompt)) {
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
      return this.getFallbackResponse(prompt, context);
    }
  }
  
  return {
    answer: context.qaMatch?.answer || '',
    confidence: context.qaMatch?.confidence || 0,
    metadata: context.qaMatch?.metadata || {},
  };
}

private isInvalidResponse(answer: string, originalPrompt: string): boolean {
  if (answer.includes('Bạn là trợ lý bán hàng') || 
      answer.includes('📦 SẢN PHẨM CÓ SẴN:') ||
      answer.includes('📝 HƯỚNG DẪN TRẢ LỜI:') ||
      answer.includes('💬 PHẢN HỒI XÃ GIAO:') ||
      answer.includes('❓ CÂU HỎI:') ||
      answer.includes('✍️ CHỈ TRẢ LỜI:')) {
    return true;
  }

  if (answer.length < 5 && !this.isLikelySocialResponse(answer)) {
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

private isLikelySocialResponse(answer: string): boolean {
  const socialPatterns = [
    /^không có gì/i, /^cảm ơn/i, /^xin chào/i, /^tạm biệt/i,
    /^chào bạn/i, /^vâng/i, /^dạ/i, /^ok/i, /^ừ/i, /^uh/i
  ];
  
  return socialPatterns.some(pattern => pattern.test(answer));
}

private getFallbackResponse(prompt: string, context: ChatContext): any {
  let fallbackAnswer = '';
  const socialCategories = ['greeting', 'thanks', 'goodbye'];
  const isSocialInteraction = context.questionCategories.some(cat => socialCategories.includes(cat));

  if (isSocialInteraction && context.questionCategories.length === 1) {
    if (context.questionCategories.includes('thanks')) {
      fallbackAnswer = 'Không có gì đâu ạ! Rất vui được hỗ trợ bạn. 😊';
    } else if (context.questionCategories.includes('greeting')) {
      fallbackAnswer = 'Xin chào bạn! Tôi có thể giúp gì cho bạn hôm nay?';
    } else if (context.questionCategories.includes('goodbye')) {
      fallbackAnswer = 'Tạm biệt bạn! Hẹn gặp lại! 👋';
    }
  } else if (context.userIntent === 'policy_question') {
    fallbackAnswer = 'Tôi chưa rõ lắm về vấn đề này. Bạn vui lòng liên hệ shop qua hotline hoặc Zalo để được hỗ trợ tốt nhất nhé! 💬';
  } else if (context.userIntent === 'product_inquiry') {
    if (context.currentProducts.length > 0) {
      const product = context.currentProducts[0];
      fallbackAnswer = `Về sản phẩm ${product.name} (${this.fmt(product.price)}). Bạn vui lòng liên hệ shop để được tư vấn kỹ hơn nhé! 📦`;
    } else if (context.searchKeyword) {
      fallbackAnswer = `Shop hiện chưa có sản phẩm "${context.searchKeyword}" bạn tìm. Bạn có thể xem các sản phẩm khác hoặc liên hệ shop để đặt hàng riêng nhé! 🛍️`;
    } else {
      fallbackAnswer = 'Tôi chưa hiểu rõ sản phẩm bạn đang hỏi. Bạn có thể mô tả cụ thể hơn hoặc liên hệ shop để được tư vấn trực tiếp nhé! 💁‍♀️';
    }
  } else {
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
      fallback: true,
    },
  };
}

private isAskingForLink(prompt: string, categories: string[]): boolean {
  const lower = prompt.toLowerCase();
  const linkKeywords = ['link', 'xem chi tiết', 'xem thêm', 'xem sản phẩm',
    'cho tui xem', 'cho tôi xem', 'muốn xem', 'tham khảo',
    'đường dẫn', 'url', 'trang sản phẩm'
  ];
  return linkKeywords.some(keyword => lower.includes(keyword));
}

private buildDynamicAIPrompt(prompt: string, context: ChatContext, metadata: any): string {
  if (context.userIntent === 'qa_match') return '';

  let systemPrompt = `Bạn là trợ lý bán hàng thông minh, thân thiện và tự nhiên.\n\n`;
  const socialCategories = ['greeting', 'thanks', 'goodbye'];
  const isSocialInteraction = context.questionCategories.some(cat => socialCategories.includes(cat));

  if (isSocialInteraction && context.questionCategories.length === 1) {
    return this.buildSocialPrompt(context.questionCategories[0], prompt);
  }

  if (context.currentProducts.length > 0) {
    systemPrompt += this.buildProductInfoPrompt(context.currentProducts, metadata);
  } else if (context.searchKeyword) {
    systemPrompt += `⚠️ LƯU Ý: Khách tìm "${context.searchKeyword}" nhưng hiện shop KHÔNG CÓ.\n\n`;
  }

  if (context.questionCategories.length > 0) {
    systemPrompt += `🎯 KHÁCH ĐANG HỎI VỀ: ${context.questionCategories.join(', ').toUpperCase()}\n`;
    if (context.specificQuestions.length > 0) {
      systemPrompt += `🔑 Từ khóa quan trọng: ${context.specificQuestions.slice(0, 5).join(', ')}\n`;
    }
    systemPrompt += `\n`;
  }

  systemPrompt += this.buildContextGuidance(context);

  const hasUrlSlug = metadata?.slug && metadata.slug !== 'none';
  const isAskingForLink = this.isAskingForLink(prompt, context.questionCategories);
  
  if (hasUrlSlug && !isAskingForLink) {
    systemPrompt += `\n🔗 QUAN TRỌNG - KHÔNG THÊM LINK:\n`;
    systemPrompt += `- Khách đang ở trang sản phẩm này rồi\n`;
    systemPrompt += `- KHÔNG cần thêm slug vào câu trả lời\n`;
    systemPrompt += `- Tập trung vào tư vấn nội dung sản phẩm\n\n`;
  } else if (isAskingForLink) {
    systemPrompt += `\n🔗 KHÁCH HỎI VỀ LINK - PHẢI TRẢ LINK:\n`;
    systemPrompt += `- Khách muốn xem link/chi tiết sản phẩm\n`;
    systemPrompt += `- BẮT BUỘC thêm slug sau tên sản phẩm\n`;
    systemPrompt += `- Format: "Tên sản phẩm (giá) \`slug-san-pham\`"\n\n`;
  }

  systemPrompt += `\n⚠️ QUAN TRỌNG - NẾU KHÔNG BIẾT:\n`;
  systemPrompt += `- Nếu không có đủ thông tin để trả lời chính xác\n`;
  systemPrompt += `- Nói thẳng: "Tôi chưa rõ lắm về vấn đề này"\n`;
  systemPrompt += `- Đề xuất: "Bạn vui lòng liên hệ shop để được tư vấn chi tiết nhé!"\n`;
  systemPrompt += `- KHÔNG bịa đặt thông tin\n\n`;

  if (context.conversationHistory) {
    const recentHistory = context.conversationHistory.split('\n').slice(-6).join('\n');
    systemPrompt += `💬 HỘI THOẠI GẦN ĐÂY:\n${recentHistory}\n`;
  }

  systemPrompt += `\n❓ CÂU HỎI: "${prompt}"\n\n`;
  systemPrompt += `✍️ CHỈ TRẢ LỜI (tự nhiên, ${hasUrlSlug && !isAskingForLink ? 'KHÔNG thêm slug' : 'thêm slug nếu cần'}, 50-80 từ):`;

  return systemPrompt;
}

// --- Các hàm Build Prompt chi tiết (Đã bỏ console.log) ---
private buildSocialPrompt(category: string, prompt: string): string {
  const prompts: Record<string, string> = {
    greeting: `💬 CÂU XÃ GIAO - TRẢ LỜI TỰ NHIÊN:
- Khách đang chào hỏi
- Chào lại thân thiện: "Xin chào! Chào bạn!"
- Hỏi thăm: "Bạn cần tôi tư vấn sản phẩm gì không?"
- Giữ giọng điệu vui vẻ, ấm áp
- KHÔNG đề cập đến liên hệ shop trừ khi khách hỏi

❓ CÂU HỎI: "${prompt}"

✍️ CHỈ TRẢ LỜI (tự nhiên, thân thiện, ngắn gọn 10-30 từ, KHÔNG đề cập liên hệ shop):`,

    thanks: `💬 CẢM ƠN - TRẢ LỜI TỰ NHIÊN:
- Khách đang cảm ơn
- Đáp lại: "Không có gì đâu ạ! 😊"
- Tiếp lời: "Rất vui được hỗ trợ bạn!"
- Nếu cần: "Bạn còn cần tôi giúp gì nữa không?"
- Giữ câu ngắn gọn, thân thiện
- KHÔNG chuyển hướng sang liên hệ shop

❓ CÂU HỎI: "${prompt}"

✍️ CHỈ TRẢ LỜI (tự nhiên, thân thiện, ngắn gọn 10-30 từ, KHÔNG đề cập liên hệ shop):`,

    goodbye: `💬 TẠM BIỆT - TRẢ LỜI TỰ NHIÊN:
- Khách đang chào tạm biệt
- Chúc: "Tạm biệt bạn! Chúc bạn một ngày tốt lành!"
- Mời: "Hẹn gặp lại bạn nhé! 👋"
- Giọng điệu tích cực, ấm áp

❓ CÂU HỎI: "${prompt}"

✍️ CHỈ TRẢ LỜI (tự nhiên, thân thiện, ngắn gọn 10-30 từ):`
  };

  return prompts[category] || prompts.greeting;
}

private buildProductInfoPrompt(products: any[], metadata: any): string {
  let prompt = `📦 SẢN PHẨM CÓ SẴN:\n`;
  products.forEach((p, i) => {
    prompt += `${i + 1}. ${p.name} - ${this.fmt(p.price)}\n`;
    
    const hasUrlSlug = metadata?.slug && metadata.slug !== 'none';
    if (!hasUrlSlug) {
      prompt += `   Slug: ${p.slug}\n`;
    }
    
    if (p.description) {
      prompt += `   ${p.description.substring(0, 200)}...\n`;
    }
  });
  prompt += `\n`;
  return prompt;
}

private buildContextGuidance(context: ChatContext): string {
  const { questionCategories, currentProducts, userIntent, searchKeyword } = context;
  
  let guidance = `📝 HƯỚNG DẪN TRẢ LỜI:\n`;

  const socialCategories = ['greeting', 'thanks', 'goodbye'];
  const isSocialInteraction = questionCategories.some(cat => socialCategories.includes(cat));

  if (isSocialInteraction && questionCategories.length === 1) {
    return this.buildSocialGuidance(questionCategories[0]);
  }

  switch(userIntent) {
    case 'product_inquiry':
      return this.buildProductInquiryGuidance(context);
    case 'policy_question':
      return this.buildPolicyQuestionGuidance(context);
    case 'general_chat':
    default:
      return this.buildGeneralChatGuidance(context);
  }
}

private buildSocialGuidance(category: string): string {
  const guidance: Record<string, string> = {
    greeting: `💬 CHÀO HỎI - TRẢ LỜI TỰ NHIÊN:
- Chào lại thân thiện: "Xin chào! Chào bạn!"
- Hỏi thăm: "Bạn cần tôi tư vấn sản phẩm gì không?"
- Giọng điệu: Vui vẻ, ấm áp
- KHÔNG đề cập đến liên hệ shop trừ khi khách hỏi\n\n`,

    thanks: `💬 CẢM ƠN - TRẢ LỜI TỰ NHIÊN:
- Đáp lại: "Không có gì đâu ạ! 😊"
- Tiếp lời: "Rất vui được hỗ trợ bạn!"
- Nếu cần: "Bạn còn cần tôi giúp gì nữa không?"
- Giọng điệu: Thân thiện, khiêm tốn
- KHÔNG chuyển hướng sang liên hệ shop\n\n`,

    goodbye: `💬 TẠM BIỆT - TRẢ LỜI TỰ NHIÊN:
- Chúc: "Tạm biệt bạn! Chúc bạn một ngày tốt lành!"
- Mời: "Hẹn gặp lại bạn nhé! 👋"
- Giọng điệu: Tích cực, ấm áp\n\n`
  };

  return guidance[category] || guidance.greeting;
}

private buildProductInquiryGuidance(context: ChatContext): string {
  const { questionCategories, specificQuestions, currentProducts, searchKeyword } = context;
  let guidance = `🎯 TƯ VẤN SẢN PHẨM:\n`;
  const questionType = this.analyzeQuestionType(questionCategories, specificQuestions);
  
  if (currentProducts.length > 0) {
    guidance += `✅ CÓ ${currentProducts.length} SẢN PHẨM LIÊN QUAN:\n`;
    if (questionType === 'general_advice' && currentProducts.length > 1) {
      guidance += this.buildGeneralAdviceGuidance(currentProducts);
    } else if (questionType === 'price_inquiry') {
      guidance += this.buildPriceGuidance(currentProducts, specificQuestions);
    } else if (questionType === 'purchase_inquiry') {
      guidance += this.buildPurchaseGuidance(currentProducts);
    } else if (questionType === 'size_inquiry') {
      guidance += this.buildSizeGuidance(currentProducts);
    } else if (questionType === 'style_inquiry') {
      guidance += this.buildStyleGuidance(currentProducts);
    } else if (questionType === 'feature_inquiry') {
      guidance += this.buildFeatureGuidance(currentProducts);
    } else if (questionType === 'follow_up') {
      guidance += this.buildFollowUpGuidance(currentProducts);
    } else if (questionType === 'care_inquiry') {
      guidance += this.buildCareGuidance();
    } else {
      guidance += this.buildDefaultProductGuidance(currentProducts);
    }
  } else if (searchKeyword) {
    guidance += `❌ KHÔNG CÓ SẢN PHẨM "${searchKeyword}":\n`;
    guidance += `- Thông báo lịch sự: "Shop hiện chưa có sản phẩm ${searchKeyword}"\n`;
    guidance += `- Hỏi lại: "Bạn muốn tìm sản phẩm nào khác không?"\n`;
    guidance += `- Giọng điệu: Thân thiện, sẵn sàng hỗ trợ\n`;
    guidance += `- Đề xuất: "Bạn có thể xem các sản phẩm khác hoặc liên hệ shop để đặt hàng riêng"\n`;
  } else {
    guidance += `🤔 KHÔNG RÕ SẢN PHẨM:\n`;
    guidance += `- Hỏi lại: "Bạn đang muốn tìm sản phẩm gì ạ?"\n`;
    guidance += `- Gợi ý: "Shop có nhiều loại áo, quần, giày dép, phụ kiện..."\n`;
    guidance += `- Giọng điệu: Thân thiện, tận tình\n`;
  }

  guidance += `\n🎯 NGUYÊN TẮC CHUNG:\n`;
  guidance += `- Giọng điệu: Nhiệt tình, tự tin, thân thiện\n`;
  guidance += `- Ngôn ngữ: Tự nhiên như người thật, không robot\n`;
  guidance += `- Độ dài: 50-100 từ là tốt nhất\n`;
  guidance += `- Luôn sẵn sàng hỏi lại nếu chưa rõ\n`;
  guidance += `- KHÔNG bịa đặt thông tin\n`;
  
  return guidance;
}

private buildPolicyQuestionGuidance(context: ChatContext): string {
  const { questionCategories } = context;
  let guidance = `📋 CÂU HỎI CHÍNH SÁCH:\n`;

  if (questionCategories.includes('shipping')) {
    guidance += `🚚 VẬN CHUYỂN:\n`;
    guidance += `- Thời gian giao: Thông báo thời gian dự kiến\n`;
    guidance += `- Phí ship: Nêu rõ phí ship, điều kiện freeship\n`;
    guidance += `- Nếu không rõ: "Bạn vui lòng liên hệ shop để biết chi tiết cho khu vực của bạn"\n`;
  }
  
  if (questionCategories.includes('return')) {
    guidance += `🔄 ĐỔI TRẢ:\n`;
    guidance += `- Thời gian: Thông báo thời hạn đổi trả\n`;
    guidance += `- Điều kiện: Nêu điều kiện đổi trả (còn tem, nguyên seal...)\n`;
    guidance += `- Nếu không rõ: "Bạn vui lòng liên hệ shop để biết chính sách cụ thể"\n`;
  }
  
  if (questionCategories.includes('promotion')) {
    guidance += `🎁 KHUYẾN MÃI:\n`;
    guidance += `- Chương trình: Giới thiệu các chương trình hiện có\n`;
    guidance += `- Nếu không rõ: "Bạn vui lòng liên hệ shop để biết các ưu đãi mới nhất"\n`;
  }
  
  if (questionCategories.includes('account')) {
    guidance += `👤 TÀI KHOẢN:\n`;
    guidance += `- Đăng ký: Hướng dẫn cách đăng ký đơn giản\n`;
    guidance += `- Nếu không rõ: "Bạn vui lòng liên hệ admin để được hỗ trợ"\n`;
  }
  
  if (questionCategories.includes('policy')) {
    guidance += `📞 LIÊN HỆ HỖ TRỢ:\n`;
    guidance += `- Hotline: Cung cấp số hotline nếu có\n`;
    guidance += `- Nếu không rõ: "Bạn vui lòng liên hệ shop để được hỗ trợ tốt nhất"\n`;
  }
  
  guidance += `\n🎯 NGUYÊN TẮC CHUNG:\n`;
  guidance += `- Chính xác: Chỉ cung cấp thông tin chính xác\n`;
  guidance += `- Rõ ràng: Trình bày rõ ràng, dễ hiểu\n`;
  guidance += `- Nếu không biết: Thẳng thắn nói "Tôi chưa rõ" và hướng dẫn liên hệ\n`;
  guidance += `- KHÔNG đề cập sản phẩm cụ thể\n`;
  
  return guidance;
}

private buildGeneralChatGuidance(context: ChatContext): string {
  return `💬 CHAT TỰ NHIÊN:\n
- Trả lời thân thiện, tự nhiên như người bạn
- Giữ giọng điệu tích cực, chuyên nghiệp
- Sẵn sàng hỗ trợ khi khách cần
- Nếu không hiểu: Hỏi lại "Ý bạn là gì ạ?" hoặc "Bạn có thể nói rõ hơn được không?"
- Luôn giữ thái độ lịch sự, tôn trọng\n`;
}

private analyzeQuestionType(categories: string[], specificQuestions: string[]): string {
  const hasAdvice = categories.includes('advice');
  const hasPrice = categories.includes('price');
  const hasPurchase = categories.includes('purchase');
  const hasSize = categories.includes('size');
  const hasStyle = categories.includes('style');
  const hasFeature = categories.includes('feature');
  const hasCare = categories.includes('care');
  const hasFollowUp = categories.includes('follow_up');
  
  if (hasFollowUp) return 'follow_up';
  if (hasPrice) return 'price_inquiry';
  if (hasPurchase) return 'purchase_inquiry';
  if (hasSize) return 'size_inquiry';
  if (hasStyle) return 'style_inquiry';
  if (hasFeature) return 'feature_inquiry';
  if (hasCare) return 'care_inquiry';
  if (hasAdvice) return 'general_advice';
  
  return 'default_product';
}

private buildGeneralAdviceGuidance(products: any[]): string {
  return `🎯 TƯ VẤN ĐA DẠNG SẢN PHẨM:
- Giới thiệu NGẮN GỌN 2-3 sản phẩm nổi bật nhất
- Mỗi sản phẩm chỉ 1-2 câu: tên, giá, đặc điểm CHÍNH
- Kết thúc bằng CÂU HỎI MỞ: "Bạn thích phong cách nào?" hoặc "Bạn muốn dùng cho dịp gì?"\n`;
}

private buildPriceGuidance(products: any[], specificQuestions: string[]): string {
  const hasCompare = specificQuestions.some(q => ['rẻ', 'đắt', 'so sánh'].includes(q));
  let guidance = `💰 THÔNG TIN GIÁ:\n`;
  guidance += `- Nêu rõ giá từng sản phẩm\n`;
  if (hasCompare && products.length > 1) {
    guidance += `- So sánh giá trị: "Sản phẩm này đắt hơn vì..." hoặc "Sản phẩm này rẻ hơn nhưng vẫn..."\n`;
  }
  guidance += `- Giải thích tại sao đáng giá tiền (chất liệu, thiết kế, thương hiệu)\n`;
  return guidance;
}

private buildPurchaseGuidance(products: any[]): string {
  return `🛒 HƯỚNG DẪN MUA HÀNG:
- Hướng dẫn đơn giản: "Bạn có thể thêm vào giỏ hàng và thanh toán"
- Nêu các bước cơ bản: chọn size/màu → thêm giỏ → thanh toán
- Giọng điệu: Khuyến khích, hỗ trợ\n`;
}

private buildSizeGuidance(products: any[]): string {
  return `📏 TƯ VẤN SIZE:
- Hướng dẫn cách chọn size: "Bạn có thể dựa vào số đo..."
- Cung cấp bảng size nếu có thông tin
- Khuyên nên thử hoặc đo trước khi mua\n`;
}

private buildStyleGuidance(products: any[]): string {
  return `🎨 THÔNG TIN MÀU SẮC & CHẤT LIỆU:
- Mô tả màu sắc có sẵn
- Giải thích chất liệu: "Chất liệu cotton giúp thoáng mát..."
- Tư vấn phối đồ: "Màu này dễ phối với quần jeans..."\n`;
}

private buildFeatureGuidance(products: any[]): string {
  return `⚙️ TÍNH NĂNG & CHẤT LƯỢNG:
- Nêu 3-5 tính năng NỔI BẬT nhất
- Nhấn mạnh LỢI ÍCH cho người dùng: "Giúp bạn..." "Mang lại..."\n`;
}

private buildFollowUpGuidance(products: any[]): string {
  return `🔄 CÂU HỎI TIẾP THEO:
- Hiểu ngữ cảnh: Khách đang hỏi tiếp về sản phẩm đã đề cập
- Trả lời CỤ THỂ hơn về sản phẩm đó
- Nếu câu hỏi mơ hồ: "Ý bạn là về giá, chất liệu hay cách sử dụng ạ?"\n`;
}

private buildCareGuidance(): string {
  return `🧼 HƯỚNG DẪN BẢO QUẢN:
- Hướng dẫn giặt: "Nên giặt tay/giặt máy nhẹ..."
- Nhiệt độ: "Giặt ở nhiệt độ thấp..."
- Lưu ý đặc biệt: "Không ngâm quá lâu", "Tránh ánh nắng trực tiếp"\n`;
}

private buildDefaultProductGuidance(products: any[]): string {
  return `📦 TƯ VẤN SẢN PHẨM CHI TIẾT:
- Giới thiệu sản phẩm phù hợp nhất
- Nêu 3-4 ưu điểm nổi bật
- Đề xuất cách sử dụng/phối đồ"\n`;
}

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

  // --- Các hàm Helper cuối cùng (Đã bỏ console.log) ---
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

  // --- Các hàm Database (Không đổi) ---
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