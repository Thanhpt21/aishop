import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAiService } from './openai.service';
import { Prisma } from '@prisma/client';

interface ChatContext {
  conversationHistory: string;
  currentProducts: any[];
  userIntent: 'product_inquiry' | 'policy_question' | 'general_chat' | 'qa_match'; // 🆕 THÊM 'qa_match'
  searchKeyword: string | null;
  questionCategories: string[]; // 🆕 Các category từ khóa
  specificQuestions: string[];  // 🆕 Câu hỏi cụ thể
  qaMatch: { // 🆕 THÊM khối này
    answer: string;
    confidence: number;
    metadata: any;
  } | null;
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
    ],
    WORKING_HOURS: [ // 🆕 hoi_gio_lam
      'mấy giờ', 'giờ mở cửa', 'giờ đóng cửa', 'làm việc',
      'mở cửa', 'đóng cửa', 'online', 'trực page',
      'giờ làm việc', 'khung giờ', 'chủ nhật',
      'cuối tuần', 'nghỉ trưa', 'tối muộn', 'ngày lễ',
      'lễ tết', 'tết', 'nghỉ lễ', 'có làm không',
      'trả lời', 'nhắn tin', 'check tin nhắn',
      'sáng', 'tối', 'trưa', 'thời gian làm việc'
    ],

    LOCATION: [ // 🆕 hoi_dia_chi
      'địa chỉ', 'ở đâu', 'đường nào', 'vị trí',
      'kho hàng', 'cửa hàng', 'chi nhánh',
      'hà nội', 'hồ chí minh', 'tp.hcm', 'sài gòn',
      'ghé kho', 'xem hàng', 'location', 'thử đồ',
      'trực tiếp', 'store', 'offline', 'văn phòng',
      'nhà', 'lấy hàng', 'tỉnh', 'thành phố',
      'kho hàng ở đâu', 'cửa hàng ở đâu'
    ],

    TRUST: [ // 🆕 hoi_uy_tin
      'uy tín', 'tin tưởng', 'có uy tín không',
      'chất lượng', 'ảnh thật', 'ảnh mạng',
      'giống hình', 'như ảnh', 'đúng hình',
      'feedback', 'đánh giá', 'review',
      'khách cũ', 'shop có uy tín',
      'hàng chất lượng', 'sợ hàng kém'
    ],

    PAYMENT: [ // 🆕 thanh_toan
      'thanh toán', 'tiền mặt', 'chuyển khoản',
      'cod', 'ship cod', 'thẻ ngân hàng',
      'cà thẻ', 'đặt cọc', 'trả tiền trước',
      'số tài khoản', 'banking', 'tài khoản',
      'kiểm tra hàng', 'xem hàng', 'thử đồ',
      'shipper', 'nhận hàng rồi thanh toán',
      'trả lại shipper', 'lỗi', 'từ chối nhận',
      'không ưng', 'không vừa'
    ],

    DELIVERY: [ // 🆕 van_chuyen (bổ sung thêm)
      'giao hàng', 'ship', 'vận chuyển', 'delivery',
      'phí ship', 'cước phí', 'tiền vận chuyển',
      'freeship', 'miễn phí ship', 'giảm tiền ship',
      'giá ship', 'thời gian giao', 'bao lâu nhận',
      'khi nào giao', 'gửi hàng', 'đi tỉnh',
      'nội thành', 'ngoại thành', 'hỏa tốc',
      'giao nhanh', 'xe khách', 'đơn nhỏ',
      'đơn lớn', 'xem hàng trước', 'kiểm tra hàng'
    ],

    PRODUCT_CARE: [ // 🆕 care (bổ sung thêm)
      'bảo quản', 'giặt', 'sử dụng', 'care',
      'wash', 'ủi', 'là', 'phơi', 'tẩy',
      'dry clean', 'vệ sinh', 'làm sạch',
      'giặt như thế nào', 'bảo quản sao',
      'có giặt máy được không', 'giặt tay',
      'nhiệt độ giặt', 'chất tẩy rửa'
    ],

    EXCHANGE: [ // 🆕 Bổ sung cho đổi trả
      'đổi', 'trả', 'hoàn', 'đổi trả',
      'không vừa size', 'chính sách đổi',
      'phí ship đổi', 'size không vừa',
      'đổi size', 'trả hàng', 'hoàn hàng',
      'thời gian đổi trả', 'điều kiện đổi'
    ],

    WARRANTY: [ // 🆕 Bổ sung cho bảo hành
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
  
  console.log('🔍 =============== NEW CHAT REQUEST ===============');
  console.log('🔍 Prompt:', prompt);

  const convId = await this.getOrCreateConv(conversationId, prompt);
  await this.saveUserMessage(convId, prompt);

  // 🎯 PHÂN TÍCH: Đây có phải câu hỏi về SẢN PHẨM không?
  console.log('🔍 Step 1: Check if this is a PRODUCT question');
  const keywordAnalysis = this.analyzeQuestionKeywords(prompt);
  console.log('🔍 Categories:', keywordAnalysis.categories);
  console.log('🔍 Keywords:', keywordAnalysis.specificQuestions);

  // 🎯 QUYẾT ĐỊNH FLOW: Sản phẩm → AI, Khác → QA trước
  const isProductQuestion = this.isProductQuestion(prompt, keywordAnalysis.categories);
  
  if (isProductQuestion) {
    console.log('🎯 Step 2: PRODUCT QUESTION → Going straight to AI');
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
          isProductQuestion: true,
        }
      },
      usage: result.metadata?.usage || {},
    };
  } else {
    console.log('🎯 Step 2: NON-PRODUCT QUESTION → Checking QA first');
    // 🎯 ƯU TIÊN TÌM QA CHO CÂU HỎI KHÔNG PHẢI SẢN PHẨM
    const qaMatch = await this.findQAMatch(prompt, ownerEmail);
    
    if (qaMatch) {
      console.log('✅ Found QA match, returning QA answer');
      console.log('✅ QA Answer:', qaMatch.answer);
      
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

    console.log('❌ No QA match found, using AI for non-product question');
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
  
  console.log('🔍 Checking if this is a product question...');
  
  // 🎯 TỪ KHÓA SẢN PHẨM RÕ RÀNG
  const STRONG_PRODUCT_KEYWORDS = [
    // Tên sản phẩm cụ thể
    'áo', 'quần', 'giày', 'dép', 'mũ', 'nón', 'túi', 'ví', 'váy', 'đầm',
    'thun', 'sơ mi', 'jeans', 'kaki', 'short', 'hoodie', 'jacket',
    'vớ', 'tất', 'phụ kiện', 'thắt lưng', 'khăn', 'găng tay',
    
    // Từ khóa tư vấn sản phẩm
    'tư vấn sản phẩm', 'giới thiệu sản phẩm', 'có sản phẩm nào',
    'xem sản phẩm', 'xem hàng', 'xem đồ', 'sản phẩm này',
    
    // Hỏi cụ thể về sản phẩm
    'áo nào', 'quần nào', 'giày nào', 'mẫu nào', 'kiểu nào',
    
    // Follow-up về sản phẩm đã đề cập
    'nó', 'cái này', 'sản phẩm này', 'cái đó'
  ];

  // 🎯 CATEGORIES về sản phẩm
  const PRODUCT_CATEGORIES = [
    'product', 'price', 'size', 'style', 'feature'
  ];

  // 1. Kiểm tra từ khóa mạnh
  const hasStrongProductKeyword = STRONG_PRODUCT_KEYWORDS.some(keyword => 
    lowerPrompt.includes(keyword.toLowerCase())
  );

  // 2. Kiểm tra categories
  const hasProductCategory = categories.some(cat => 
    PRODUCT_CATEGORIES.includes(cat)
  );

  // 3. Kiểm tra cấu trúc câu
  const isProductQueryPattern = 
    (lowerPrompt.includes('tư vấn') && (lowerPrompt.includes('áo') || lowerPrompt.includes('quần') || lowerPrompt.includes('giày'))) ||
    (lowerPrompt.includes('có') && lowerPrompt.includes('gì') && (lowerPrompt.includes('sản phẩm') || lowerPrompt.includes('hàng'))) ||
    (lowerPrompt.includes('sản phẩm') && (lowerPrompt.includes('nào') || lowerPrompt.includes('gì')));

  const result = hasStrongProductKeyword || hasProductCategory || isProductQueryPattern;
  
  console.log('🔍 Product question check result:', {
    hasStrongProductKeyword,
    hasProductCategory,
    isProductQueryPattern,
    result
  });

  return result;
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
  
  // 🎯 Kiểm tra QA match trước (tìm trong bảng example_qa)
  const qaMatch = await this.findQAMatch(prompt, ownerEmail);
  
  // Phân loại ý định (nếu có QA match thì là qa_match)
  const userIntent = qaMatch 
    ? 'qa_match' 
    : this.classifyIntent(prompt, keywordAnalysis.categories);
  
  // Trích xuất keyword tìm kiếm sản phẩm
  const searchKeyword = this.extractSearchKeyword(prompt);
  
  console.log('🔍 Context analysis:', {
    qaMatch: !!qaMatch,
    userIntent,
    searchKeyword,
    categories: keywordAnalysis.categories
  });

  // Tìm sản phẩm liên quan (chỉ khi không phải QA match)
  const currentProducts = qaMatch 
    ? [] // Không cần sản phẩm nếu đã có QA match
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
    qaMatch, // 🆕 Thêm QA match vào context
  };
}

private async findQAMatch(prompt: string, ownerEmail?: string): Promise<any> {
  try {
    const lowerPrompt = prompt.toLowerCase();
    console.log(`🔍 Searching QA for: "${prompt}"`);
    
    // 🚨 KIỂM TRA TRƯỚC: Đây có phải câu hỏi về sản phẩm không?
    if (this.isProductQuestion(prompt, [])) {
      console.log('🚫 Skipping QA - this is a product question');
      return null;
    }

    // 🎯 Tìm EXACT MATCH đơn giản
    const exactMatch = await this.prisma.exampleQA.findFirst({
      where: {
        isActive: true,
        question: { equals: prompt, mode: 'insensitive' },
        ...(ownerEmail && { ownerEmail }),
      },
    });

    if (exactMatch) {
      console.log(`✅ Exact QA match: "${exactMatch.question}"`);
      return {
        answer: exactMatch.answer,
        confidence: 0.99,
        metadata: {
          source: 'exact_qa',
          qaId: exactMatch.id,
          question: exactMatch.question,
        },
      };
    }

    // 🎯 Tìm CONTAINS MATCH
    const containsMatch = await this.prisma.exampleQA.findFirst({
      where: {
        isActive: true,
        question: { contains: prompt, mode: 'insensitive' },
        ...(ownerEmail && { ownerEmail }),
      },
    });

    if (containsMatch) {
      console.log(`✅ Contains QA match: "${containsMatch.question}"`);
      return {
        answer: containsMatch.answer,
        confidence: 0.95,
        metadata: {
          source: 'contains_qa',
          qaId: containsMatch.id,
          question: containsMatch.question,
        },
      };
    }

    // 🎯 Tìm bằng từ khóa chính (chỉ cho non-product questions)
    const keywords = this.extractNonProductKeywords(prompt);
    if (keywords.length > 0) {
      console.log(`🔍 Searching QA by keywords:`, keywords);
      
      const keywordMatch = await this.prisma.exampleQA.findFirst({
        where: {
          isActive: true,
          OR: keywords.map(keyword => ({
            question: { contains: keyword, mode: 'insensitive' }
          })),
          ...(ownerEmail && { ownerEmail }),
        },
        orderBy: { createdAt: 'desc' },
      });

      if (keywordMatch) {
        console.log(`✅ Keyword QA match: "${keywordMatch.question}"`);
        return {
          answer: keywordMatch.answer,
          confidence: 0.85,
          metadata: {
            source: 'keyword_qa',
            qaId: keywordMatch.id,
            question: keywordMatch.question,
            keywords: keywords,
          },
        };
      }
    }

    console.log(`❌ No QA match found for: "${prompt}"`);
    return null;
    
  } catch (error) {
    console.error('❌ Error finding QA match:', error);
    return null;
  }
}

// Hàm trích xuất từ khóa NON-PRODUCT
private extractNonProductKeywords(prompt: string): string[] {
  const lower = prompt.toLowerCase();
  const keywords: string[] = [];
  
  // Các từ khóa về chính sách, thông tin shop (KHÔNG phải sản phẩm)
  const NON_PRODUCT_KEYWORDS = [
    'địa chỉ', 'ở đâu', 'đường nào', 'vị trí',
    'lễ tết', 'ngày lễ', 'làm việc', 'mở cửa', 'đóng cửa',
    'giờ làm', 'khung giờ', 'trực', 'online',
    'ship', 'giao hàng', 'vận chuyển', 'phí ship',
    'thanh toán', 'cod', 'chuyển khoản', 'tiền mặt',
    'đổi trả', 'bảo hành', 'chính sách',
    'liên hệ', 'hotline', 'zalo', 'facebook', 'email',
    'trả lời', 'nhắn tin', 'check tin',
    'shop', 'cửa hàng', 'store', 'kho hàng',
    'chi nhánh', 'tỉnh', 'thành phố', 'quận'
  ];
  
  NON_PRODUCT_KEYWORDS.forEach(word => {
    if (lower.includes(word)) {
      keywords.push(word);
    }
  });
  
  return keywords;
}




  // =============== PHÂN LOẠI Ý ĐỊNH - CẢI TIẾN ===============
private classifyIntent(
  prompt: string,
  categories: string[]
): ChatContext['userIntent'] {
  // 🎯 ƯU TIÊN SOCIAL INTERACTIONS
  const socialCategories = ['greeting', 'thanks', 'goodbye'];
  const isSocialInteraction = categories.some(cat => socialCategories.includes(cat));
  
  if (isSocialInteraction && categories.length === 1) {
    return 'general_chat';
  }

  // 🎯 PHÂN LOẠI THEO CÁC CATEGORY MỚI
  // Nếu có category về giờ làm việc, địa chỉ, uy tín, thanh toán, vận chuyển, care
  // → policy_question (vì các câu hỏi này có trong QA)
  const policyCategories = [
    'policy', 'shipping', 'return', 'account', 'promotion',
    'working_hours', 'location', 'trust', 'payment', 'delivery',
    'product_care', 'exchange', 'warranty'
  ];
  
  if (categories.some(cat => policyCategories.includes(cat))) {
    return 'policy_question';
  }

  // Nếu có category PRODUCT, PRICE, PURCHASE, SIZE, STYLE, etc → product inquiry
  const productCategories = ['product', 'price', 'purchase', 'size', 'style', 'advice', 'feature', 'care', 'follow_up'];
  
  if (categories.some(cat => productCategories.includes(cat))) {
    return 'product_inquiry';
  }

  // Các câu chung → general_chat
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

   // 3. 🎯 TÌM THEO KEYWORD - DÙNG FUZZY SEARCH
  if (searchKeyword) {
    console.log(`🔍 FUZZY SEARCH for keyword: "${searchKeyword}"`);
    
    // Thử fuzzy search trước
    const products = await this.fuzzySearchProducts(searchKeyword, ownerEmail);
    
    if (products.length > 0) {
      console.log(`✅ FUZZY Found ${products.length} products:`, 
        products.map(p => `${p.name} (${p.category || 'no category'})`));
      return products;
    }
    
    // Nếu fuzzy không tìm được, thử search thông thường
    console.log(`🔄 Fuzzy search failed, trying regular search...`);
    const regularProducts = await this.searchProductsByKeyword(searchKeyword, ownerEmail);
    
    if (regularProducts.length > 0) {
      console.log(`✅ Regular search found ${regularProducts.length} products`);
      return regularProducts;
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
  console.log(`🔍 SEARCH for: "${keyword}"`);
  
  // 1. Thử fuzzy search trước (tìm mạnh mẽ nhất)
  const fuzzyResults = await this.fuzzySearchProducts(keyword, ownerEmail);
  
  if (fuzzyResults.length > 0) {
    console.log(`✅ Fuzzy search successful: ${fuzzyResults.length} products`);
    return fuzzyResults;
  }
  
  // 2. Nếu fuzzy không tìm được, thử tìm đơn giản
  console.log(`🔄 Fuzzy search failed, trying simple search...`);
  
  const normalizedKeyword = keyword.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim();

  const products = await this.prisma.product.findMany({
    where: {
      isActive: true,
      OR: [
        { name: { contains: normalizedKeyword, mode: 'insensitive' } },
        { category: { contains: normalizedKeyword, mode: 'insensitive' } },
        { description: { contains: normalizedKeyword, mode: 'insensitive' } },
      ],
      ...(ownerEmail && { ownerEmail }),
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  // 3. Nếu vẫn không tìm được, thử với keyword mappings
  if (products.length === 0) {
    console.log(`🔄 Simple search failed, trying keyword mappings...`);
    
    const mappings = this.getKeywordMappings(normalizedKeyword);
    if (mappings.length > 0) {
      const mappedProducts = await this.prisma.product.findMany({
        where: {
          isActive: true,
          OR: mappings.flatMap(mapping => [
            { name: { contains: mapping, mode: 'insensitive' } },
            { category: { contains: mapping, mode: 'insensitive' } },
            { description: { contains: mapping, mode: 'insensitive' } },
          ]),
          ...(ownerEmail && { ownerEmail }),
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
      
      return mappedProducts;
    }
  }

  console.log(`📊 Final results: ${products.length} products for "${keyword}"`);
  return products;
}

// Hàm fuzzy search - chỉ cần có ký tự giống là được
private async fuzzySearchProducts(keyword: string, ownerEmail?: string): Promise<any[]> {
  const normalizedKeyword = keyword.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remove accents
    .replace(/[^a-z0-9\s]/g, '') // Remove special chars
    .trim();

  console.log(`🎯 FUZZY SEARCH for: "${keyword}" -> normalized: "${normalizedKeyword}"`);

  // Tách thành các từ khóa
  const words = normalizedKeyword.split(/\s+/).filter(w => w.length >= 2);
  
  // Tạo các điều kiện OR
  const orConditions: Prisma.ProductWhereInput[] = [];

  // 1. Tìm EXACT match toàn bộ keyword
  orConditions.push(
    { name: { contains: normalizedKeyword, mode: 'insensitive' } },
    { category: { contains: normalizedKeyword, mode: 'insensitive' } },
    { description: { contains: normalizedKeyword, mode: 'insensitive' } }
  );

  // 2. Tìm với từng từ riêng lẻ (AND logic)
  if (words.length > 1) {
    // Tìm sản phẩm có CHỨA TẤT CẢ các từ
    orConditions.push({
      AND: words.map(word => ({
        OR: [
          { name: { contains: word, mode: 'insensitive' } },
          { category: { contains: word, mode: 'insensitive' } },
          { description: { contains: word, mode: 'insensitive' } }
        ]
      }))
    });
  }

  // 3. Tìm với bất kỳ từ nào (OR logic)
  words.forEach(word => {
    orConditions.push({
      OR: [
        { name: { contains: word, mode: 'insensitive' } },
        { category: { contains: word, mode: 'insensitive' } },
        { description: { contains: word, mode: 'insensitive' } }
      ]
    });
  });

  // 4. 🆕 THÊM: Tìm với keyword mappings (từ đồng nghĩa)
  const keywordMappings = this.getKeywordMappings(normalizedKeyword);
  
  keywordMappings.forEach(mappedKeyword => {
    orConditions.push(
      { name: { contains: mappedKeyword, mode: 'insensitive' } },
      { category: { contains: mappedKeyword, mode: 'insensitive' } },
      { description: { contains: mappedKeyword, mode: 'insensitive' } }
    );
  });

  // 5. 🆕 THÊM: Tìm với các biến thể viết liền/viết rời
  const wordVariants = this.generateWordVariants(words);
  wordVariants.forEach(variant => {
    orConditions.push(
      { name: { contains: variant, mode: 'insensitive' } },
      { category: { contains: variant, mode: 'insensitive' } }
    );
  });

  console.log(`🔍 Search conditions count: ${orConditions.length}`);

  const products = await this.prisma.product.findMany({
    where: {
      isActive: true,
      OR: orConditions,
      ...(ownerEmail && { ownerEmail }),
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  console.log(`✅ FUZZY SEARCH found ${products.length} products for "${keyword}"`);
  products.forEach(p => {
    console.log(`   - ${p.name} (${p.category || 'no category'})`);
  });

  return products;
}

private getKeywordMappings(keyword: string): string[] {
  const mappings: Record<string, string[]> = {
    // Áo thun
    'ao': ['áo', 'shirt', 't-shirt', 'tee', 'tshirt', 'thun'],
    'thun': ['thun', 't-shirt', 'tee', 'cotton'],
    'ao thun': ['áo thun', 't-shirt', 'tee shirt', 'cotton shirt'],
    
    // Quần
    'quan': ['quần', 'pants', 'trousers', 'jeans', 'shorts'],
    'jean': ['jean', 'denim', 'quần jean'],
    
    // Giày dép
    'giay': ['giày', 'shoes', 'sneakers', 'boots'],
    'dep': ['dép', 'sandals', 'flip flops'],
    
    // Phụ kiện
    'gang tay': ['găng tay', 'gloves', 'bao tay'],
    'vo': ['vớ', 'socks', 'tất'],
    'mu': ['mũ', 'hat', 'cap', 'nón'],
    'tui': ['túi', 'bag', 'backpack'],
    'vi': ['ví', 'wallet'],
    'that lung': ['thắt lưng', 'belt'],
    'khan': ['khăn', 'scarf'],
  };

  return mappings[keyword] || [];
}

// 🆕 Tạo các biến thể từ
private generateWordVariants(words: string[]): string[] {
  const variants: string[] = [];
  
  // Tạo các biến thể viết liền/viết rời
  if (words.length === 2) {
    const [word1, word2] = words;
    variants.push(`${word1}${word2}`); // aothun
    variants.push(`${word1} ${word2}`); // ao thun
    variants.push(`${word2} ${word1}`); // thun ao (đảo ngược)
  }
  
  // Thêm biến thể không dấu
  words.forEach(word => {
    if (word.includes('ao')) variants.push(word.replace('ao', 'áo'));
    if (word.includes('áo')) variants.push(word.replace('áo', 'ao'));
  });

  return variants;
}
  // =============== 🆕 GENERATE AI RESPONSE - LINH HOẠT ===============
private async generateAIResponse(
  prompt: string,
  context: ChatContext,
  ownerEmail?: string,
  metadata?: any
) {
  // Chỉ gọi AI khi không có QA match
  if (context.userIntent !== 'qa_match') {
    // Build dynamic AI prompt
    const aiPrompt = this.buildDynamicAIPrompt(prompt, context, metadata || {});
    
    console.log('🤖 AI Prompt (first 600 chars):\n', aiPrompt.substring(0, 600) + '...');

    try {
      // Call OpenAI
      const ai = await this.openai.callOpenAI(aiPrompt, {
        maxTokens: 150,
        temperature: 0.75,
      });

      // ✅ VALIDATE RESPONSE
      const answer = ai.text.trim();
      
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
  
  // Nếu là QA match, không gọi AI
  return {
    answer: context.qaMatch?.answer || '',
    confidence: context.qaMatch?.confidence || 0,
    metadata: context.qaMatch?.metadata || {},
  };
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
  // Nếu là QA match, không cần build prompt
  if (context.userIntent === 'qa_match') {
    return '';
  }

  let systemPrompt = `Bạn là trợ lý bán hàng thông minh, thân thiện và tự nhiên.\n\n`;

  // 🎯 XỬ LÝ CHÀO HỎI, CẢM ƠN, TẠM BIỆT
  const socialCategories = ['greeting', 'thanks', 'goodbye'];
  const isSocialInteraction = context.questionCategories.some(cat => 
    socialCategories.includes(cat)
  );

  if (isSocialInteraction && context.questionCategories.length === 1) {
    systemPrompt += this.buildSocialPrompt(context.questionCategories[0], prompt);
    return systemPrompt;
  }

  // 🎯 THÔNG TIN SẢN PHẨM
  if (context.currentProducts.length > 0) {
    systemPrompt += this.buildProductInfoPrompt(context.currentProducts, metadata);
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

  // 🆕 THÊM HƯỚNG DẪN FALLBACK
  systemPrompt += `\n⚠️ QUAN TRỌNG - NẾU KHÔNG BIẾT:\n`;
  systemPrompt += `- Nếu không có đủ thông tin để trả lời chính xác\n`;
  systemPrompt += `- Nói thẳng: "Tôi chưa rõ lắm về vấn đề này"\n`;
  systemPrompt += `- Đề xuất: "Bạn vui lòng liên hệ shop để được tư vấn chi tiết nhé!"\n`;
  systemPrompt += `- KHÔNG bịa đặt thông tin\n\n`;

  // 📜 LỊCH SỬ
  if (context.conversationHistory) {
    const recentHistory = context.conversationHistory.split('\n').slice(-6).join('\n');
    systemPrompt += `💬 HỘI THOẠI GẦN ĐÂY:\n${recentHistory}\n`;
  }

  systemPrompt += `\n❓ CÂU HỎI: "${prompt}"\n\n`;
  systemPrompt += `✍️ CHỈ TRẢ LỜI (tự nhiên, ${hasUrlSlug && !isAskingForLink ? 'KHÔNG thêm slug' : 'thêm slug nếu cần'}, 50-80 từ):`;

  return systemPrompt;
}

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
      prompt += `   Slug: ${p.slug}\n`;
    }
    
    if (p.description) {
      prompt += `   ${p.description.substring(0, 120)}...\n`;
    }
  });
  prompt += `\n`;
  return prompt;
}


  // =============== 🆕 BUILD CONTEXT GUIDANCE ===============
private buildContextGuidance(context: ChatContext): string {
  const { questionCategories, specificQuestions, currentProducts, userIntent, searchKeyword } = context;
  
  let guidance = `📝 HƯỚNG DẪN TRẢ LỜI:\n`;

  // 🎯 XỬ LÝ SOCIAL INTERACTIONS TRƯỚC
  const socialCategories = ['greeting', 'thanks', 'goodbye'];
  const isSocialInteraction = questionCategories.some(cat => 
    socialCategories.includes(cat)
  );

  if (isSocialInteraction && questionCategories.length === 1) {
    return this.buildSocialGuidance(questionCategories[0]);
  }

  // 🎯 PHÂN LOẠI THEO USER INTENT
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

// =============== SOCIAL GUIDANCE ===============
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

// =============== PRODUCT INQUIRY GUIDANCE ===============
private buildProductInquiryGuidance(context: ChatContext): string {
  const { questionCategories, specificQuestions, currentProducts, searchKeyword } = context;
  
  let guidance = `🎯 TƯ VẤN SẢN PHẨM:\n`;

  // 🔍 PHÂN TÍCH LOẠI CÂU HỎI
  const questionType = this.analyzeQuestionType(questionCategories, specificQuestions);
  
  console.log('🔍 Question type analysis:', {
    type: questionType,
    categories: questionCategories,
    specific: specificQuestions,
    productCount: currentProducts.length
  });

  // 📦 CÓ SẢN PHẨM
  if (currentProducts.length > 0) {
    guidance += `✅ CÓ ${currentProducts.length} SẢN PHẨM LIÊN QUAN:\n`;

    // 🎯 TƯ VẤN CHUNG (advice + nhiều sản phẩm)
    if (questionType === 'general_advice' && currentProducts.length > 1) {
      guidance += this.buildGeneralAdviceGuidance(currentProducts);
    }
    
    // 💰 HỎI GIÁ
    else if (questionType === 'price_inquiry') {
      guidance += this.buildPriceGuidance(currentProducts, specificQuestions);
    }
    
    // 🛒 HỎI MUA HÀNG
    else if (questionType === 'purchase_inquiry') {
      guidance += this.buildPurchaseGuidance(currentProducts);
    }
    
    // 📏 HỎI KÍCH THƯỚC
    else if (questionType === 'size_inquiry') {
      guidance += this.buildSizeGuidance(currentProducts);
    }
    
    // 🎨 HỎI MÀU SẮC/CHẤT LIỆU
    else if (questionType === 'style_inquiry') {
      guidance += this.buildStyleGuidance(currentProducts);
    }
    
    // ⚙️ HỎI TÍNH NĂNG/CHẤT LƯỢNG
    else if (questionType === 'feature_inquiry') {
      guidance += this.buildFeatureGuidance(currentProducts);
    }
    
    // 🔄 FOLLOW-UP (hỏi tiếp về sản phẩm cụ thể)
    else if (questionType === 'follow_up') {
      guidance += this.buildFollowUpGuidance(currentProducts);
    }
    
    // 🧼 HỎI BẢO QUẢN/SỬ DỤNG
    else if (questionType === 'care_inquiry') {
      guidance += this.buildCareGuidance();
    }
    
    // DEFAULT: Tư vấn chi tiết 1 sản phẩm
    else {
      guidance += this.buildDefaultProductGuidance(currentProducts);
    }

  } 
  // ❌ KHÔNG CÓ SẢN PHẨM
  else if (searchKeyword) {
    guidance += `❌ KHÔNG CÓ SẢN PHẨM "${searchKeyword}":\n`;
    guidance += `- Thông báo lịch sự: "Shop hiện chưa có sản phẩm ${searchKeyword}"\n`;
    guidance += `- Hỏi lại: "Bạn muốn tìm sản phẩm nào khác không?"\n`;
    guidance += `- Giọng điệu: Thân thiện, sẵn sàng hỗ trợ\n`;
    guidance += `- Đề xuất: "Bạn có thể xem các sản phẩm khác hoặc liên hệ shop để đặt hàng riêng"\n`;
  }
  // 🤔 KHÔNG RÕ SẢN PHẨM
  else {
    guidance += `🤔 KHÔNG RÕ SẢN PHẨM:\n`;
    guidance += `- Hỏi lại: "Bạn đang muốn tìm sản phẩm gì ạ?"\n`;
    guidance += `- Gợi ý: "Shop có nhiều loại áo, quần, giày dép, phụ kiện..."\n`;
    guidance += `- Giọng điệu: Thân thiện, tận tình\n`;
  }

  // 🎯 THÊM HƯỚNG DẪN CHUNG
  guidance += `\n🎯 NGUYÊN TẮC CHUNG:\n`;
  guidance += `- Giọng điệu: Nhiệt tình, tự tin, thân thiện\n`;
  guidance += `- Ngôn ngữ: Tự nhiên như người thật, không robot\n`;
  guidance += `- Độ dài: 50-100 từ là tốt nhất\n`;
  guidance += `- Luôn sẵn sàng hỏi lại nếu chưa rõ\n`;
  guidance += `- KHÔNG bịa đặt thông tin\n`;
  
  return guidance;
}

// =============== POLICY QUESTION GUIDANCE ===============
private buildPolicyQuestionGuidance(context: ChatContext): string {
  const { questionCategories } = context;
  
  let guidance = `📋 CÂU HỎI CHÍNH SÁCH:\n`;

  // 🚚 VẬN CHUYỂN
  if (questionCategories.includes('shipping')) {
    guidance += `🚚 VẬN CHUYỂN:\n`;
    guidance += `- Thời gian giao: Thông báo thời gian dự kiến\n`;
    guidance += `- Phí ship: Nêu rõ phí ship, điều kiện freeship\n`;
    guidance += `- Khu vực: Xác nhận khu vực giao hàng\n`;
    guidance += `- Nếu không rõ: "Bạn vui lòng liên hệ shop để biết chi tiết cho khu vực của bạn"\n`;
  }
  
  // 🔄 ĐỔI TRẢ
  if (questionCategories.includes('return')) {
    guidance += `🔄 ĐỔI TRẢ:\n`;
    guidance += `- Thời gian: Thông báo thời hạn đổi trả\n`;
    guidance += `- Điều kiện: Nêu điều kiện đổi trả (còn tem, nguyên seal...)\n`;
    guidance += `- Quy trình: Hướng dẫn quy trình đơn giản\n`;
    guidance += `- Nếu không rõ: "Bạn vui lòng liên hệ shop để biết chính sách cụ thể"\n`;
  }
  
  // 🎁 KHUYẾN MÃI
  if (questionCategories.includes('promotion')) {
    guidance += `🎁 KHUYẾN MÃI:\n`;
    guidance += `- Chương trình: Giới thiệu các chương trình hiện có\n`;
    guidance += `- Điều kiện: Nêu điều kiện áp dụng\n`;
    guidance += `- Thời hạn: Thông báo thời hạn khuyến mãi\n`;
    guidance += `- Nếu không rõ: "Bạn vui lòng liên hệ shop để biết các ưu đãi mới nhất"\n`;
  }
  
  // 👤 TÀI KHOẢN
  if (questionCategories.includes('account')) {
    guidance += `👤 TÀI KHOẢN:\n`;
    guidance += `- Đăng ký: Hướng dẫn cách đăng ký đơn giản\n`;
    guidance += `- Đăng nhập: Hướng dẫn cách đăng nhập\n`;
    guidance += `- Quên mật khẩu: Hướng dẫn khôi phục\n`;
    guidance += `- Nếu không rõ: "Bạn vui lòng liên hệ admin để được hỗ trợ"\n`;
  }
  
  // 📞 HỖ TRỢ/LIÊN HỆ
  if (questionCategories.includes('policy')) {
    guidance += `📞 LIÊN HỆ HỖ TRỢ:\n`;
    guidance += `- Hotline: Cung cấp số hotline nếu có\n`;
    guidance += `- Zalo/Facebook: Cung cấp thông tin liên hệ\n`;
    guidance += `- Email: Cung cấp email hỗ trợ\n`;
    guidance += `- Thời gian: Thông báo thời gian làm việc\n`;
  }
  
  // 🎯 NGUYÊN TẮC CHUNG
  guidance += `\n🎯 NGUYÊN TẮC CHUNG:\n`;
  guidance += `- Chính xác: Chỉ cung cấp thông tin chính xác\n`;
  guidance += `- Rõ ràng: Trình bày rõ ràng, dễ hiểu\n`;
  guidance += `- An toàn: KHÔNG cung cấp thông tin nhạy cảm\n`;
  guidance += `- Nếu không biết: Thẳng thắn nói "Tôi chưa rõ" và hướng dẫn liên hệ\n`;
  guidance += `- KHÔNG đề cập sản phẩm cụ thể\n`;
  
  return guidance;
}

// =============== GENERAL CHAT GUIDANCE ===============
private buildGeneralChatGuidance(context: ChatContext): string {
  return `💬 CHAT TỰ NHIÊN:\n
- Trả lời thân thiện, tự nhiên như người bạn
- Giữ giọng điệu tích cực, chuyên nghiệp
- Sẵn sàng hỗ trợ khi khách cần
- Nếu không hiểu: Hỏi lại "Ý bạn là gì ạ?" hoặc "Bạn có thể nói rõ hơn được không?"
- Luôn giữ thái độ lịch sự, tôn trọng\n`;
}

// =============== HELPER FUNCTIONS ===============

// 🎯 PHÂN TÍCH LOẠI CÂU HỎI CHI TIẾT
private analyzeQuestionType(categories: string[], specificQuestions: string[]): string {
  // Kiểm tra các combination quan trọng
  const hasAdvice = categories.includes('advice');
  const hasPrice = categories.includes('price');
  const hasPurchase = categories.includes('purchase');
  const hasSize = categories.includes('size');
  const hasStyle = categories.includes('style');
  const hasFeature = categories.includes('feature');
  const hasCare = categories.includes('care');
  const hasFollowUp = categories.includes('follow_up');
  
  // Ưu tiên theo thứ tự
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

// 📦 TƯ VẤN CHUNG NHIỀU SẢN PHẨM
private buildGeneralAdviceGuidance(products: any[]): string {
  return `🎯 TƯ VẤN ĐA DẠNG SẢN PHẨM:
- Giới thiệu NGẮN GỌN 2-3 sản phẩm nổi bật nhất
- Mỗi sản phẩm chỉ 1-2 câu: tên, giá, đặc điểm CHÍNH
- Nhấn mạnh SỰ KHÁC BIỆT giữa các sản phẩm
- Sắp xếp theo: phổ biến → đặc biệt, rẻ → đắt
- Kết thúc bằng CÂU HỎI MỞ: "Bạn thích phong cách nào?" hoặc "Bạn muốn dùng cho dịp gì?"
- Ví dụ: "Shop có các loại áo: 1) Áo thun casual giá rẻ, 2) Áo sơ mi thanh lịch, 3) Áo hoodie ấm áp"
- KHÔNG đi quá chi tiết từng sản phẩm\n`;
}

// 💰 HƯỚNG DẪN HỎI GIÁ
private buildPriceGuidance(products: any[], specificQuestions: string[]): string {
  const hasCompare = specificQuestions.some(q => ['rẻ', 'đắt', 'so sánh'].includes(q));
  
  let guidance = `💰 THÔNG TIN GIÁ:\n`;
  guidance += `- Nêu rõ giá từng sản phẩm\n`;
  
  if (hasCompare && products.length > 1) {
    guidance += `- So sánh giá trị: "Sản phẩm này đắt hơn vì..." hoặc "Sản phẩm này rẻ hơn nhưng vẫn..."\n`;
  }
  
  guidance += `- Giải thích tại sao đáng giá tiền (chất liệu, thiết kế, thương hiệu)\n`;
  guidance += `- Nếu có khuyến mãi: thông báo\n`;
  guidance += `- KHÔNG hứa hẹn giảm giá nếu không chắc\n`;
  
  return guidance;
}

// 🛒 HƯỚNG DẪN MUA HÀNG
private buildPurchaseGuidance(products: any[]): string {
  return `🛒 HƯỚNG DẪN MUA HÀNG:
- Hướng dẫn đơn giản: "Bạn có thể thêm vào giỏ hàng và thanh toán"
- Nêu các bước cơ bản: chọn size/màu → thêm giỏ → thanh toán
- Thông báo thời gian xử lý đơn hàng
- Nếu hỏi "ở đâu bán": "Bạn có thể mua trực tiếp trên website này"
- Giọng điệu: Khuyến khích, hỗ trợ\n`;
}

// 📏 HƯỚNG DẪN KÍCH THƯỚC
private buildSizeGuidance(products: any[]): string {
  return `📏 TƯ VẤN SIZE:
- Hướng dẫn cách chọn size: "Bạn có thể dựa vào số đo..."
- Cung cấp bảng size nếu có thông tin
- Tư vấn fit: "Nếu thích ôm thì chọn size nhỏ hơn, thoải mái thì size lớn hơn"
- Khuyên nên thử hoặc đo trước khi mua
- Nếu không có thông tin size: "Bạn vui lòng liên hệ shop để được tư vấn cụ thể"\n`;
}

// 🎨 HƯỚNG DẪN MÀU SẮC/CHẤT LIỆU
private buildStyleGuidance(products: any[]): string {
  return `🎨 THÔNG TIN MÀU SẮC & CHẤT LIỆU:
- Mô tả màu sắc có sẵn
- Giải thích chất liệu: "Chất liệu cotton giúp thoáng mát..."
- Tư vấn phối đồ: "Màu này dễ phối với quần jeans..."
- Gợi ý theo mùa/dịp: "Màu tối phù hợp mùa đông, màu sáng cho mùa hè"
- Nếu không rõ: "Bạn có thể xem hình ảnh sản phẩm để thấy rõ màu sắc thực tế"\n`;
}

// ⚙️ HƯỚNG DẪN TÍNH NĂNG
private buildFeatureGuidance(products: any[]): string {
  return `⚙️ TÍNH NĂNG & CHẤT LƯỢNG:
- Nêu 3-5 tính năng NỔI BẬT nhất
- Nhấn mạnh LỢI ÍCH cho người dùng: "Giúp bạn..." "Mang lại..."
- So sánh điểm mạnh so với sản phẩm thông thường
- Nếu hỏi "có tốt không": "Sản phẩm được đánh giá cao vì..."
- Trung thực: Nếu có hạn chế nhỏ, có thể đề cập nhưng tập trung vào ưu điểm\n`;
}

// 🔄 HƯỚNG DẪN FOLLOW-UP
private buildFollowUpGuidance(products: any[]): string {
  return `🔄 CÂU HỎI TIẾP THEO:
- Hiểu ngữ cảnh: Khách đang hỏi tiếp về sản phẩm đã đề cập
- Trả lời CỤ THỂ hơn về sản phẩm đó
- Nếu câu hỏi mơ hồ: "Ý bạn là về giá, chất liệu hay cách sử dụng ạ?"
- Giữ sự liên kết với hội thoại trước
- KHÔNG lặp lại thông tin đã nói, chỉ bổ sung chi tiết mới\n`;
}

// 🧼 HƯỚNG DẪN BẢO QUẢN
private buildCareGuidance(): string {
  return `🧼 HƯỚNG DẪN BẢO QUẢN:
- Hướng dẫn giặt: "Nên giặt tay/giặt máy nhẹ..."
- Nhiệt độ: "Giặt ở nhiệt độ thấp..."
- Chất tẩy rửa: "Sử dụng chất tẩy nhẹ..."
- Phơi/ủi: "Phơi trong bóng râm", "Ủi ở nhiệt độ trung bình..."
- Lưu ý đặc biệt: "Không ngâm quá lâu", "Tránh ánh nắng trực tiếp"
- Nếu không rõ: "Bạn nên xem hướng dẫn trên nhãn mác"\n`;
}

// 📦 HƯỚNG DẪN MẶC ĐỊNH
private buildDefaultProductGuidance(products: any[]): string {
  return `📦 TƯ VẤN SẢN PHẨM CHI TIẾT:
- Giới thiệu sản phẩm phù hợp nhất
- Nêu 3-4 ưu điểm nổi bật
- Giải thích tại sao phù hợp với khách hàng
- Đề xuất cách sử dụng/phối đồ
- Kết thúc bằng lời mời: "Bạn có muốn biết thêm về size/màu không?"
- Giọng điệu: Tự tin, thuyết phục\n`;
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