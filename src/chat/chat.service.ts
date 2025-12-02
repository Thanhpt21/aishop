import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DedupService } from './dedup.service';
import { OpenAiService } from './openai.service';
import * as natural from 'natural';
import { SmartAdjusterService } from './smart-adjuster.service';

interface ProductSearchResult {
  found: boolean;
  products: any[];
  exactMatchProduct?: any;
  searchQuery: string;
}

@Injectable()
export class ChatService {
  private tokenizer: natural.WordTokenizer;
  private stemmer = {
  stem: (word: string): string => {
    // Từ điển mapping từ dạng biến thể → dạng chuẩn (tự bổ sung dần)
    const synonymMap: Record<string, string> = {
      'số đo': 'size',
      'vòng 1': 'size',
      'vòng ngực': 'size',
      'vòng eo': 'size',
      'vòng mông': 'size',
      'bao nhiêu': 'giá',
      'giá tiền': 'giá',
      'mấy giờ': 'giờ làm',
      'mấyh': 'giờ làm',
      'mấy giờ mở cửa': 'giờ làm',
      'đặt hàng': 'mua',
      'order': 'mua',
      'đổi trả': 'trả hàng',
      'hoàn tiền': 'trả hàng',
    };

    const lower = word.toLowerCase();
    return synonymMap[lower] || lower;
  }
};
  
  constructor(
    private prisma: PrismaService,
    private dedup: DedupService,
    private openai: OpenAiService,
     private smartAdjuster: SmartAdjusterService
  ) {
    this.tokenizer = new natural.WordTokenizer();
  }

    async handleChat(body: any) {
    const { conversationId, prompt, metadata, userId } = body;
    if (!prompt?.trim()) throw new Error('prompt required');

    const normalized = this.dedup.normalizePrompt(prompt);
    const hash = this.dedup.hashPrompt(normalized);

    // 1. TẠO HOẶC LẤY CONVERSATION
    let convId: string;
    if (conversationId) {
      convId = conversationId;
    } else {
      const conv = await this.prisma.conversation.create({
        data: {
          tags: [],
          title: this.generateConversationTitle(prompt)
        }
      });
      convId = conv.id;
    }

    const followUpContext = await this.detectFollowUpIntent(prompt, convId);
  
    if (followUpContext.isFollowUp && followUpContext.referencedProducts) {
      return this.handleFollowUpResponse(
        prompt,
        convId,
        followUpContext.followUpType!,
        followUpContext.referencedProducts
      );
    }

    // 2. PHÂN TÍCH PROMPT VÀ TÌM CÂU TRẢ LỜI TỪ EXAMPLE QA
    const exampleQAAnalysis = await this.findAnswerFromExampleQA(prompt);
    
    // 3. TÌM KIẾM SẢN PHẨM (ƯU TIÊN SAU EXAMPLE QA)
    const productSearch = await this.findProductsForPrompt(prompt, exampleQAAnalysis);

    // 4. NẾU TÌM THẤY SẢN PHẨM VÀ KHÔNG CÓ EXAMPLE QA MATCH
    if (productSearch.found && !exampleQAAnalysis.foundMatch && productSearch.confidence >= 0.5) {
      const productResponse = this.formatProductResponse(productSearch.products, prompt);
      
      // Lưu tin nhắn user
      const userMessage = await this.prisma.message.create({
        data: {
          conversationId: convId,
          role: 'user',
          content: prompt,
          source: 'user',
          intent: 'tim_kiem_san_pham',
          category: 'san_pham',
          sentiment: exampleQAAnalysis.sentiment,
          confidence: productSearch.confidence,
          isTrainingExample: false,
          metadata: {
            searchQuery: productSearch.query,
            matchedKeywords: productSearch.matchedKeywords,
            productCount: productSearch.products.length,
            originalQuestion: prompt
          }
        },
      });

      // Tạo response từ sản phẩm
      const assistantMessage = await this.prisma.message.create({
        data: {
          conversationId: convId,
          userId: null,
          role: 'assistant',
          content: productResponse,
          source: 'product_search',
          intent: 'tu_van_san_pham',
          category: 'san_pham',
          tokens: this.countWords(productResponse),
          metadata: {
            products: productSearch.products.map(p => ({
              id: p.id,
              name: p.name,
              price: p.price,
              description: p.description,
              slug: p.slug,
            })),
            productIds: productSearch.products.map(p => p.id),
            query: productSearch.query,
            confidence: productSearch.confidence,
            searchMethod: productSearch.method,
            expectsFollowUp: true,                        
            followUpType: 'product_detail_confirmation'   
          }
        },
      });
      return {
        cached: false,
        fromExampleQA: false,
        fromProductSearch: true,
        conversationId: convId,
        response: {
          id: assistantMessage.id,
          text: productResponse,
          wordCount: this.countWords(productResponse),
        },
        analysis: {
          ...exampleQAAnalysis,
          productSearch: {
            found: true,
            query: productSearch.query,
            confidence: productSearch.confidence,
            products: productSearch.products,
            matchedKeywords: productSearch.matchedKeywords
          }
        },
        usage: {},
      };
    }

    // 5. LƯU TIN NHẮN USER
    const userMessage = await this.prisma.message.create({
      data: {
        conversationId: convId,
        role: 'user',
        content: prompt,
        source: 'user',
        intent: exampleQAAnalysis.intent,
        category: exampleQAAnalysis.category,
        sentiment: exampleQAAnalysis.sentiment,
        confidence: exampleQAAnalysis.confidence,
        isTrainingExample: exampleQAAnalysis.isTrainingExample,
        metadata: {
          matchedQuestion: exampleQAAnalysis.matchedQuestion,
          similarity: exampleQAAnalysis.similarity,
          matchingMethod: exampleQAAnalysis.matchingMethod,
          originalQuestion: prompt,
          productSearch: productSearch.found ? {
            found: true,
            query: productSearch.query,
            productCount: productSearch.products.length
          } : { found: false }
        }
      },
    });

    // 6. NẾU TÌM THẤY CÂU TRẢ LỜI TỪ EXAMPLE QA
    if (exampleQAAnalysis.foundMatch && exampleQAAnalysis.answer) {
      let finalAnswer = exampleQAAnalysis.answer;

      if (exampleQAAnalysis.similarity >= 0.7) {
        try {
          finalAnswer = await this.smartAdjuster.adjustAnswerWithAI(
            prompt,
            exampleQAAnalysis.answer,
            exampleQAAnalysis.matchedQuestion,
            exampleQAAnalysis.intent,
            exampleQAAnalysis.category
          );
        } catch (error) {
          console.error('❌ Failed to adjust answer, using original:', error);
          finalAnswer = exampleQAAnalysis.answer;
        }
      }

      // NẾU CÓ SẢN PHẨM LIÊN QUAN, THÊM VÀO CUỐI CÂU TRẢ LỜI
      if (productSearch.found && productSearch.confidence >= 0.4) {
        const productSuggestion = this.getProductSuggestion(productSearch.products, prompt);
        if (productSuggestion) {
          finalAnswer += `\n\n${productSuggestion}`;
        }
      }

      const limitedAnswer = this.limitWords(finalAnswer, 50);

      const assistantMessage = await this.prisma.message.create({
        data: {
          conversationId: convId,
          userId: null,
          role: 'assistant',
          content: limitedAnswer,
          source: 'example_qa',
          intent: exampleQAAnalysis.intent,
          category: exampleQAAnalysis.category,
          tokens: this.countWords(limitedAnswer),
          metadata: {
            originalAnswer: exampleQAAnalysis.answer,
            adjustedAnswer: finalAnswer,
            matchedQuestionId: exampleQAAnalysis.matchedQuestionId,
            confidence: exampleQAAnalysis.confidence,
            similarity: exampleQAAnalysis.similarity,
            adjustmentApplied: finalAnswer !== exampleQAAnalysis.answer,
            productSearch: productSearch.found ? {
              found: true,
              products: productSearch.products.map(p => p.id),
              confidence: productSearch.confidence
            } : null
          }
        },
      });

      // Tạo training data
      await this.createTrainingDataFromMessage(userMessage, exampleQAAnalysis);

      return {
        cached: false,
        fromExampleQA: true,
        fromProductSearch: productSearch.found,
        conversationId: convId,
        response: {
          id: assistantMessage.id,
          text: limitedAnswer,
          wordCount: this.countWords(limitedAnswer),
        },
        analysis: {
          ...exampleQAAnalysis,
          answer: limitedAnswer,
          originalAnswer: exampleQAAnalysis.answer,
          adjustedAnswer: finalAnswer,
          adjustmentApplied: finalAnswer !== exampleQAAnalysis.answer,
          matchingMethod: exampleQAAnalysis.matchingMethod,
          productSearch: productSearch.found ? {
            found: true,
            query: productSearch.query,
            products: productSearch.products,
            confidence: productSearch.confidence
          } : null
        },
        usage: {},
      };
    }

    // 7. KIỂM TRA CACHE
    const cached = await this.dedup.checkCache(hash);
    if (cached) {
      // Thêm đề xuất sản phẩm nếu có
      let cachedText = cached.text;
      if (productSearch.found && productSearch.confidence >= 0.4) {
        const productSuggestion = this.getProductSuggestion(productSearch.products, prompt);
        if (productSuggestion) {
          cachedText += `\n\n${productSuggestion}`;
        }
      }

      const limitedCachedText = this.limitWords(cachedText, 50);

      const assistantMessage = await this.prisma.message.create({
        data: {
          conversationId: convId,
          userId: null,
          role: 'assistant',
          content: limitedCachedText,
          source: 'cached',
          intent: exampleQAAnalysis.intent,
          category: exampleQAAnalysis.category,
          tokens: this.countWords(limitedCachedText),
          metadata: {
            productSearch: productSearch.found ? {
              found: true,
              products: productSearch.products.map(p => p.id),
              confidence: productSearch.confidence
            } : null
          }
        },
      });

      return {
        cached: true,
        fromExampleQA: false,
        fromProductSearch: productSearch.found,
        conversationId: convId,
        response: {
          id: assistantMessage.id,
          text: limitedCachedText,
          wordCount: this.countWords(limitedCachedText),
        },
        analysis: exampleQAAnalysis,
        usage: {},
      };
    }

    // 8. GỌI OPENAI
    let aiResponse = await this.openai.callOpenAI(prompt, metadata);

    // Thêm thông tin sản phẩm vào AI response nếu có
    if (productSearch.found && productSearch.confidence >= 0.4) {
      const productInfo = this.formatProductsForAI(productSearch.products);
      const enhancedPrompt = `${prompt}\n\nThông tin sản phẩm liên quan:\n${productInfo}`;
      
      // Gọi lại OpenAI với thông tin sản phẩm
      aiResponse = await this.openai.callOpenAI(enhancedPrompt, {
        ...metadata,
        hasProductInfo: true,
        productCount: productSearch.products.length
      });
    }

    // 9. LƯU TẤT CẢ TRONG TRANSACTION
    const result = await this.prisma.$transaction(async (tx) => {
      const assistantMessage = await tx.message.create({
        data: {
          conversationId: convId,
          userId: null,
          role: 'assistant',
          content: aiResponse.text,
          source: 'openai',
          intent: exampleQAAnalysis.intent,
          category: exampleQAAnalysis.category,
          tokens: this.countWords(aiResponse.text),
          metadata: {
            productSearch: productSearch.found ? {
              found: true,
              products: productSearch.products.map(p => p.id),
              confidence: productSearch.confidence,
              usedInResponse: true
            } : null
          }
        },
      });

      const resp = await tx.response.upsert({
        where: { hash },
        update: {},
        create: {
          hash,
          content: aiResponse.text,
          usage: aiResponse.usage || {}
        },
      });

      await tx.promptHash.create({
        data: {
          promptHash: hash,
          responseId: resp.id,
          normalizedPrompt: normalized,
        },
      });

      await this.dedup.setCache(hash, resp.id);

      return resp;
    });

    return {
      cached: false,
      fromExampleQA: false,
      fromProductSearch: productSearch.found,
      conversationId: convId,
      response: {
        id: result.id,
        text: result.content,
        wordCount: this.countWords(result.content),
      },
      analysis: exampleQAAnalysis,
      usage: aiResponse.usage || {},
    };
  }

  // ==================== NÂNG CẤP PRODUCT SEARCH ====================

private async findProductsForPrompt(
  prompt: string,
  analysis: any
): Promise<{
  found: boolean;
  products: any[];
  query: string;
  confidence: number;
  matchedKeywords: string[];
  method: string;
}> {
  try {
    const lowerPrompt = prompt.toLowerCase();
    
    // Danh sách từ khóa chỉ tìm sản phẩm
    const productIntentKeywords = [
      'có sản phẩm', 'bạn có', 'shop có', 'tìm sản phẩm', 'mua sản phẩm',
      'giới thiệu sản phẩm', 'sản phẩm nào', 'mặt hàng nào', 'hàng nào',
      'có bán', 'bán gì', 'có loại', 'có kiểu', 'có mẫu', 'có dòng',
      'gợi ý sản phẩm', 'sản phẩm gì', 'hãng nào', 'thương hiệu nào'
    ];

    // Danh sách từ khóa chỉ KHÔNG tìm sản phẩm
    const nonProductKeywords = [
      'cách sử dụng', 'hướng dẫn', 'tư vấn size', 'size nào',
      'giờ làm việc', 'địa chỉ', 'liên hệ', 'chính sách', 'đổi trả',
      'vận chuyển', 'thanh toán', 'giá cả', 'khuyến mãi', 'mã giảm giá',
      'tài khoản', 'đăng nhập', 'đăng ký', 'đánh giá', 'feedback',
      'bảo hành', 'chất lượng', 'xuất xứ', 'nơi sản xuất'
    ];

    // Kiểm tra nếu prompt KHÔNG phải là tìm sản phẩm
    const hasNonProductIntent = nonProductKeywords.some(keyword => 
      lowerPrompt.includes(keyword)
    );

    if (hasNonProductIntent) {
      return {
        found: false,
        products: [],
        query: '',
        confidence: 0,
        matchedKeywords: [],
        method: 'non_product_intent'
      };
    }

    // 1. Trích xuất từ khóa sản phẩm từ prompt
    const keywords = this.extractProductKeywords(prompt);
    
    
    const hasProductIntent = productIntentKeywords.some(k => lowerPrompt.includes(k));
    
    if (keywords.length === 0 && !hasProductIntent) {
      return {
        found: false,
        products: [],
        query: '',
        confidence: 0,
        matchedKeywords: [],
        method: 'no_keywords'
      };
    }

    // 2. Tìm kiếm sản phẩm theo độ ưu tiên MỚI
    let products: any[] = [];
    let searchMethod = 'keyword';
    let confidence = 0.3;

    // **ƯU TIÊN 1: Tìm theo tên sản phẩm CHÍNH XÁC HƠN**
    if (keywords.length > 0) {

      
      const searchPromises = keywords.map(keyword => {
        return this.prisma.product.findMany({
          where: {
            isActive: true,
            OR: [
              { 
                name: { 
                  contains: keyword, 
                  mode: 'insensitive' 
                } 
              },
              { 
                // Ưu tiên tìm theo từ khóa trong danh mục
                category: { 
                  contains: keyword, 
                  mode: 'insensitive' 
                } 
              },
            ]
          },
          take: 5
        });
      });

      const results = await Promise.all(searchPromises);
      results.forEach(found => {

        products.push(...found);
      });
      
      if (products.length > 0) {
        confidence = 0.7;
        searchMethod = 'product_name_or_category';

      }
    }

    // **ƯU TIÊN 2: Tìm theo description (chỉ khi không tìm thấy theo name/category)**
    if (products.length === 0 && keywords.length > 0) {

      
      const descriptionPromises = keywords.map(keyword => {
        return this.prisma.product.findMany({
          where: {
            isActive: true,
            description: { 
              contains: keyword, 
              mode: 'insensitive' 
            }
          },
          take: 3
        });
      });

      const descriptionResults = await Promise.all(descriptionPromises);
      descriptionResults.forEach(found => {
        products.push(...found);
      });
      
      if (products.length > 0) {
        confidence = 0.5; // Confidence thấp hơn vì match trong description
        searchMethod = 'product_description';
      }
    }

    // **ƯU TIÊN 3: Nếu có intent là tìm sản phẩm nhưng không có keyword cụ thể**
    if (products.length === 0 && hasProductIntent) {
      
      products = await this.prisma.product.findMany({
        where: { isActive: true },
        take: 5,
        orderBy: { createdAt: 'desc' }
      });
      
      if (products.length > 0) {
        confidence = 0.6;
        searchMethod = 'general_product_query';

      }
    }

    // **ƯU TIÊN 4: Tìm theo category từ intent analysis**
    if (products.length === 0 && analysis.category && analysis.category !== 'general') {

      
      products = await this.prisma.product.findMany({
        where: {
          isActive: true,
          OR: [
            { category: { contains: analysis.category, mode: 'insensitive' } },
          ]
        },
        take: 3
      });
      
      if (products.length > 0) {
        confidence = 0.5;
        searchMethod = 'category_match';

      }
    }

    // 3. SCORING và SẮP XẾP THÔNG MINH

    
    // Tính điểm cho từng sản phẩm
    const scoredProducts = products.map(product => {
      const score = this.calculateProductScore(product, keywords, lowerPrompt);
      return { ...product, score };
    });

    // Debug: log tất cả sản phẩm và điểm số


    // Sắp xếp theo score giảm dần
    scoredProducts.sort((a, b) => b.score - a.score);

    // ==================== LOGIC MỚI: CHỈ LẤY SẢN PHẨM CHẤT LƯỢNG CAO ====================
    // Chỉ lấy sản phẩm có điểm cao (ngưỡng 8 điểm)
    const highQualityProducts = scoredProducts
      .filter(p => p.score >= 8)
      .slice(0, 3); // Tối đa 3

    // Nếu không có sản phẩm điểm cao, lấy 1 sản phẩm tốt nhất
    const finalProducts = highQualityProducts.length > 0 
      ? highQualityProducts 
      : scoredProducts.slice(0, 1);

    // Loại bỏ trùng lặp theo ID
    const uniqueProducts = Array.from(
      new Map(finalProducts.map(p => [p.id, p])).values()
    );


    // Điều chỉnh confidence dựa trên số lượng và chất lượng kết quả
    let finalConfidence = confidence;
    if (uniqueProducts.length > 0) {
      // Tăng confidence nếu có sản phẩm match tốt
      const averageScore = uniqueProducts.reduce((sum, p) => sum + (p.score || 0), 0) / uniqueProducts.length;
      
      if (averageScore >= 10) {
        finalConfidence = Math.min(confidence + 0.3, 0.95);
      } else if (averageScore >= 8) {
        finalConfidence = Math.min(confidence + 0.25, 0.9);
      } else if (averageScore >= 5) {
        finalConfidence = Math.min(confidence + 0.15, 0.85);
      } else if (averageScore >= 3) {
        finalConfidence = Math.min(confidence + 0.1, 0.8);
      }
      
      // Tăng confidence nếu có exact match
      const hasExactNameMatch = uniqueProducts.some(p => 
        keywords.some(kw => p.name.toLowerCase().includes(kw.toLowerCase()))
      );
      
      if (hasExactNameMatch) {
        finalConfidence = Math.max(finalConfidence, 0.85);
      }
      
      // Giảm confidence nếu chỉ có 1 sản phẩm và điểm thấp
      if (uniqueProducts.length === 1 && uniqueProducts[0].score < 5) {
        finalConfidence = Math.max(0.4, finalConfidence - 0.1);
      }
    } else {
      // Không có sản phẩm phù hợp
      finalConfidence = 0.1;
    }

    return {
      found: uniqueProducts.length > 0,
      products: uniqueProducts,
      query: keywords.join(', '),
      confidence: finalConfidence,
      matchedKeywords: keywords,
      method: searchMethod
    };

  } catch (error) {
    console.error('❌ [Product Search] Error searching products:', error);
    return {
      found: false,
      products: [],
      query: '',
      confidence: 0,
      matchedKeywords: [],
      method: 'error'
    };
  }
}

private calculateProductScore(product: any, keywords: string[], lowerPrompt: string): number {
  const productName = product.name.toLowerCase();
  const productCategory = (product.category || '').toLowerCase();
  const productDescription = (product.description || '').toLowerCase();
  
  let score = 0;
  
  // Kiểm tra từng keyword
  keywords.forEach(keyword => {
    const kw = keyword.toLowerCase();
    
    // 1. Exact match trong tên (quan trọng nhất - 6 điểm)
    if (productName === kw) {
      score += 6;

    }
    
    // 2. Phần của tên chứa keyword (5 điểm)
    else if (productName.includes(kw)) {
      score += 5;

    }
    
    // 3. Match trong category (4 điểm)
    if (productCategory.includes(kw)) {
      score += 4;

    }
    
    // 4. Match trong description (2 điểm - giảm xuống)
    if (productDescription.includes(kw)) {
      score += 2;

    }
    
    // 5. Bonus cho từ ghép trong description
    if (kw.includes(' ') && productDescription.includes(kw)) {
      score += 3; // Thêm điểm cho match cụm từ

    }
  });
  
  // Bonus cho match giới tính
  if (lowerPrompt.includes('nam') && productName.includes('nam')) {
    score += 3;

  }
  if (lowerPrompt.includes('nữ') && productName.includes('nữ')) {
    score += 3;

  }
  
  // Bonus cho sản phẩm mới (tạo trong 30 ngày)
  if (product.createdAt) {
    const daysOld = (new Date().getTime() - new Date(product.createdAt).getTime()) / (1000 * 3600 * 24);
    if (daysOld < 30) {
      score += 1;

    }
  }
  
  // Bonus cho sản phẩm có giá tốt (dưới 200k)
  if (product.price < 200000) {
    score += 1;

  }
  
  return score;
}
private extractProductKeywords(text: string): string[] {
  const lowerText = text.toLowerCase();
  
  // Từ điển từ khóa sản phẩm đầy đủ hơn
  const productKeywords = [
    // Quần
    'quần', 'quần jogger', 'quần jean', 'quần tây', 'quần short', 'quần kaki', 
    'quần legging', 'quần yếm', 'quần đùi', 'quần dài', 'quần lửng',
    
    // Áo
    'áo', 'áo thun', 'áo sơ mi', 'áo khoác', 'áo len', 'áo vest', 'áo hoodie',
    'áo tanktop', 'áo ba lỗ', 'áo cổ tròn', 'áo cổ tim', 'áo polo', 'áo ba lỗ',
    'áo tay dài', 'áo tay ngắn',
    
    // Váy đầm
    'váy', 'đầm', 'váy ngắn', 'váy dài', 'váy xòe', 'váy ôm', 'đầm body',
    'đầm suông', 'đầm xòe', 'đầm công sở',
    
    // Giày dép
    'giày', 'dép', 'giày thể thao', 'giày cao gót', 'giày bata', 'sandal',
    'giày lười', 'giày boots', 'giày công sở', 'giày chạy bộ',
    
    // Phụ kiện
    'túi', 'ví', 'balo', 'túi xách', 'mũ', 'nón', 'kính', 'thắt lưng',
    'vòng', 'nhẫn', 'bông tai', 'khăn', 'tất', 'vớ', 'thắt lưng'
  ];

  // Từ cần loại bỏ
  const stopWords = new Set([
    'có', 'bán', 'shop', 'bạn', 'tôi', 'muốn', 'cần', 'tìm', 'mua',
    'sản phẩm', 'mặt hàng', 'hàng hóa', 'loại', 'kiểu', 'mẫu', 'dòng',
    'nào', 'gì', 'không', 'vậy', 'ạ', 'cho', 'hỏi', 'về', 'bao nhiêu',
    'như thế nào', 'kích thước', 'size', 'số đo', 'màu sắc', 'màu',
    'chất liệu', 'xuất xứ', 'hãng', 'thương hiệu', 'giá', 'tiền'
  ]);

  // Tách từ
  const tokens = lowerText.split(/[\s,.!?]+/);
  
  // Lọc từ khóa sản phẩm
  const singleKeywords = tokens.filter(token => {
    if (token.length <= 1 || stopWords.has(token)) {
      return false;
    }
    
    // Kiểm tra xem token có phải là từ khóa sản phẩm không
    return productKeywords.some(kw => 
      kw === token || kw.includes(token) || token.includes(kw)
    );
  });

  // Thêm từ ghép
  const compoundKeywords: string[] = [];
  for (let i = 0; i < tokens.length - 1; i++) {
    const compound = `${tokens[i]} ${tokens[i + 1]}`;
    if (productKeywords.includes(compound)) {
      compoundKeywords.push(compound);
    }
  }

  // Kết hợp và loại bỏ trùng lặp
  const allKeywords = [...new Set([...singleKeywords, ...compoundKeywords])];
  
  // Ưu tiên từ ghép trước
  const sortedKeywords = [
    ...compoundKeywords,
    ...singleKeywords.filter(kw => !compoundKeywords.some(ckw => ckw.includes(kw)))
  ];


  return sortedKeywords;
}

private formatProductResponse(products: any[], prompt: string): string {
  if (products.length === 0) {
    return 'Hiện tại shop chưa có sản phẩm phù hợp...';
  }

  if (products.length === 1) {
    const product = products[0];
    const slug = product.slug || '';
    
    // ✅ ĐẶT SLUG SAU TÊN SẢN PHẨM
    return `Tìm thấy sản phẩm **${product.name}** (\`${slug}\`) với giá ${this.formatPrice(product.price)}. 

Bạn có muốn biết thêm thông tin chi tiết về sản phẩm này không?`;
  } 
  else if (products.length === 2) {
    const productList = products.map((p, i) => {
      const slug = p.slug || '';
      // ✅ ĐẶT SLUG SAU TÊN SẢN PHẨM
      return `${i + 1}. **${p.name}** (\`${slug}\`) - ${this.formatPrice(p.price)}`;
    }).join('\n');
    
    return `Tìm thấy 2 sản phẩm phù hợp:\n\n${productList}\n\nBạn muốn xem thông tin chi tiết sản phẩm nào?`;
  }
  else {
    const productList = products.map((p, i) => {
      const slug = p.slug || '';
      return `${i + 1}. **${p.name}** (\`${slug}\`) - ${this.formatPrice(p.price)}`;
    }).join('\n');
    
    return `Tìm thấy ${products.length} sản phẩm phù hợp:\n\n${productList}\n\nBạn có thể hỏi thêm về thông tin chi tiết của bất kỳ sản phẩm nào!`;
  }
}
  private getProductSuggestion(products: any[], prompt: string): string | null {
    if (products.length === 0) return null;

    const lowerPrompt = prompt.toLowerCase();
    
    // Kiểm tra xem prompt có phải về sản phẩm không
    const isProductRelated = [
      'size', 'số đo', 'vòng', 'mặc', 'mặc đẹp', 'phù hợp',
      'phối đồ', 'mix đồ', 'kết hợp', 'outfit'
    ].some(keyword => lowerPrompt.includes(keyword));

    if (!isProductRelated) return null;

    // Chọn sản phẩm có giá tốt nhất hoặc phù hợp nhất
    const bestProduct = products[0]; // Sản phẩm đầu tiên từ kết quả tìm kiếm

    if (lowerPrompt.includes('size') || lowerPrompt.includes('số đo')) {
      return `💡 **Gợi ý:** Nếu bạn đang tìm size phù hợp, sản phẩm **${bestProduct.name}** có thể là lựa chọn tốt với giá ${this.formatPrice(bestProduct.price)}.`;
    }

    if (lowerPrompt.includes('mặc đẹp') || lowerPrompt.includes('phối đồ')) {
      return `👗 **Gợi ý phối đồ:** Bạn có thể tham khảo sản phẩm **${bestProduct.name}** để mix đồ đẹp hơn.`;
    }

    return `🛍️ **Gợi ý sản phẩm:** ${bestProduct.name} - ${this.formatPrice(bestProduct.price)}`;
  }

  private formatProductsForAI(products: any[]): string {
    return products.map((product, index) => {
      return `Sản phẩm ${index + 1}:
- Tên: ${product.name}
- Giá: ${this.formatPrice(product.price)}
- Danh mục: ${product.category || 'Không có'}
- Mô tả: ${product.description || 'Không có mô tả'}
- Tags: ${(product.tags || []).join(', ')}`;
    }).join('\n\n');
  }

  private formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(price);
  }

private async detectFollowUpIntent(
  prompt: string,
  conversationId: string
): Promise<{
  isFollowUp: boolean;
  followUpType?: string;
  referencedProducts?: any[];
}> {
  const lowerPrompt = prompt.toLowerCase().trim();
  
  
  // Từ khóa cho mọi loại follow-up (kết hợp cả xác nhận và yêu cầu chi tiết)
  const followUpKeywords = [
    'có', 'được', 'ok', 'oke', 'yes', 'ừ', 'uhm', 
    'đồng ý', 'muốn', 'chi tiết', 'thông tin thêm',
    'cho tôi biết thêm', 'nói thêm', 'mô tả',
    'cho tui', 'cho em', 'cho mình', 'cho anh',
    'thông tin chi tiết', 'giới thiệu kỹ hơn',
    'kể thêm', 'nói kỹ', 'mô tả chi tiết',
    'về', 'áo', 'quần', 'sản phẩm' // Thêm từ chung về sản phẩm
  ];
  
  // Các từ khóa từ chối "không"
  const rejectionKeywords = [
    'không', 'thôi', 'không cần', 'ko', 'no',
    'để sau', 'không muốn', 'khỏi'
  ];
  
  const isFollowUpRequest = followUpKeywords.some(kw => lowerPrompt.includes(kw));
  const isRejection = rejectionKeywords.some(kw => lowerPrompt.includes(kw));
  
  if (!isFollowUpRequest && !isRejection) {
    return { isFollowUp: false };
  }
  
  // Lấy tin nhắn cuối cùng của assistant
  const lastAssistantMessage = await this.prisma.message.findFirst({
    where: { 
      conversationId,
      role: 'assistant'
    },
    orderBy: { createdAt: 'desc' }
  });
  
  if (!lastAssistantMessage || !lastAssistantMessage.metadata) {
    return { isFollowUp: false };
  }
  
  const metadata = lastAssistantMessage.metadata as any;

  
  // Kiểm tra nếu tin nhắn trước có expectsFollowUp
  if (metadata.expectsFollowUp === true) {
    let referencedProducts = [];
    
    // Ưu tiên lấy sản phẩm từ metadata
    if (metadata.products && metadata.products.length > 0) {
      referencedProducts = metadata.products;
    } 
    // Nếu không có trong metadata, thử tìm từ content
    else if (lastAssistantMessage.content) {
      // Trích xuất tên sản phẩm từ content
      const productNames = this.extractProductNamesFromMessage(lastAssistantMessage.content);
      
      if (productNames.length > 0) {
        // Tìm sản phẩm phù hợp
        for (const productName of productNames) {
          const product = await this.prisma.product.findFirst({
            where: {
              name: {
                contains: productName,
                mode: 'insensitive'
              }
            }
          });
          
          if (product && !referencedProducts.some(p => p.id === product.id)) {
            referencedProducts.push({
              id: product.id,
              name: product.name,
              price: product.price,
              description: product.description
            });
          }
        }
        

      }
    }
    
    if (isFollowUpRequest) {
      return {
        isFollowUp: true,
        followUpType: 'product_detail_request',
        referencedProducts: referencedProducts.length > 0 ? referencedProducts : []
      };
    }
    
    if (isRejection) {
      return {
        isFollowUp: true,
        followUpType: 'product_detail_rejection',
        referencedProducts: []
      };
    }
  }
  

  return { isFollowUp: false };
}

// Thêm phương thức trích xuất tên sản phẩm từ tin nhắn
private extractProductNamesFromMessage(content: string): string[] {
  // Tìm các tên sản phẩm trong định dạng **Tên sản phẩm**
  const productNameRegex = /\*\*([^*]+)\*\*/g;
  const matches = content.match(productNameRegex);
  
  if (!matches) return [];
  
  return matches.map(match => match.replace(/\*\*/g, '').trim());
}
private async handleFollowUpResponse(
  prompt: string,
  conversationId: string,
  followUpType: string,
  referencedProducts: any[]
): Promise<any> {
  
  // Lưu tin nhắn user
  const userMessage = await this.prisma.message.create({
    data: {
      conversationId,
      role: 'user',
      content: prompt,
      source: 'user',
      intent: 'follow_up_response',
      category: 'san_pham',
      sentiment: 'positive',
      confidence: 0.9,
      metadata: {
        followUpType,
        referencedProductIds: referencedProducts.map(p => p.id)
      }
    }
  });

  let responseText = '';

  if (followUpType === 'product_detail_request') {
    // User muốn biết chi tiết
    let targetProduct = referencedProducts[0];
    
    // Nếu có nhiều sản phẩm, kiểm tra xem user muốn sản phẩm nào
    if (referencedProducts.length > 1) {
      const lowerPrompt = prompt.toLowerCase();
      const targetProductName = referencedProducts.find(p => 
        lowerPrompt.includes(p.name.toLowerCase())
      );
      
      if (targetProductName) {
        targetProduct = targetProductName;
      }
    }
    
    // Lấy thông tin đầy đủ từ database
    const fullProduct = await this.prisma.product.findUnique({
      where: { id: targetProduct.id }
    });
    
    if (!fullProduct) {
      responseText = `Xin lỗi, không tìm thấy thông tin chi tiết về sản phẩm này.`;
    } else {
      responseText = this.formatProductDetail(fullProduct);
    }

  } else if (followUpType === 'product_detail_rejection') {
    // User không muốn biết chi tiết
    responseText = `Không sao ạ! Nếu bạn cần tìm sản phẩm khác hoặc có thắc mắc gì, cứ hỏi tôi nhé! 😊`;
  }

  // Lưu tin nhắn assistant
  const assistantMessage = await this.prisma.message.create({
    data: {
      conversationId,
      userId: null,
      role: 'assistant',
      content: responseText,
      source: 'follow_up_handler',
      intent: 'tu_van_chi_tiet',
      category: 'san_pham',
      tokens: this.countWords(responseText),
      metadata: {
        followUpType,
        productDetailsProvided: followUpType === 'product_detail_request',
        referencedProducts: referencedProducts.map(p => ({ id: p.id, name: p.name }))
      }
    }
  });

  return {
    cached: false,
    fromExampleQA: false,
    fromProductSearch: false,
    isFollowUp: true,
    conversationId,
    response: {
      id: assistantMessage.id,
      text: responseText,
      wordCount: this.countWords(responseText)
    },
    analysis: {
      intent: 'follow_up_response',
      category: 'san_pham',
      followUpType,
      referencedProducts
    },
    usage: {}
  };
}

private formatProductDetail(product: any): string {
  let response = `**${product.name}**\n\n`;
  
  response += `💰 **Giá:** ${this.formatPrice(product.price)}\n`;
  
  if (product.category) {
    response += `📂 **Danh mục:** ${product.category}\n`;
  }
  
  if (product.brand) {
    response += `🏷️ **Thương hiệu:** ${product.brand}\n`;
  }
  
  if (product.description) {
    response += `\n📝 **Mô tả:** ${product.description}\n`;
  }
  
  // Thông tin kích thước nếu có
  if (product.weight || product.length || product.width || product.height) {
    response += `\n📏 **Thông số kỹ thuật:**\n`;
    if (product.weight) response += `- Trọng lượng: ${product.weight} kg\n`;
    if (product.length && product.width && product.height) {
      response += `- Kích thước: ${product.length}cm × ${product.width}cm × ${product.height}cm\n`;
    }
  }
  
  // Câu hỏi tiếp theo
  response += `\nBạn có muốn biết về chính sách đổi trả, vận chuyển hoặc cách đặt hàng không?`;
  
  return response;
}
  // ==================== NÂNG CẤP EXAMPLE QA MATCHING ====================

async findAnswerFromExampleQA(prompt: string): Promise<any> {
  try {
    const exampleQAs = await this.prisma.exampleQA.findMany({
      where: { isActive: true }
    });

    if (exampleQAs.length === 0) {
      return this.advancedPromptAnalysis(prompt);
    }

    // Tìm match với nhiều phương pháp khác nhau
    const matches = await this.findSimilarQuestionsAdvanced(prompt, exampleQAs);
    
    if (matches.length > 0) {
      // Lấy match tốt nhất
      const bestMatch = matches[0];
      
      // Ngưỡng similarity giảm xuống 0.5 để bắt được nhiều hơn
      if (bestMatch.similarity >= 0.5) {
        // Lấy intent và category từ ExampleQA (KHÔNG từ prompt analysis)
        return {
          foundMatch: true,
          answer: bestMatch.answer,
          matchedQuestion: bestMatch.question,
          matchedQuestionId: bestMatch.id,
          similarity: bestMatch.similarity,
          intent: bestMatch.intent || 'other', // Lấy từ ExampleQA
          category: bestMatch.category || 'general', // Lấy từ ExampleQA
          sentiment: 'positive',
          confidence: bestMatch.similarity,
          isTrainingExample: true,
          modelUsed: 'advanced_example_qa_matching',
          matchingMethod: bestMatch.method,
          matchedTags: bestMatch.matchedTags || [],
          scores: bestMatch.scores
        };
      }
    }

    // Nếu không tìm thấy match, trả về analysis từ prompt
    const promptAnalysis = this.advancedPromptAnalysis(prompt);
    return {
      foundMatch: false,
      answer: null,
      matchedQuestion: null,
      similarity: 0,
      ...promptAnalysis
    };

  } catch (error) {
    console.error('Error finding answer from ExampleQA:', error);
    const promptAnalysis = this.advancedPromptAnalysis(prompt);
    return {
      foundMatch: false,
      answer: null,
      ...promptAnalysis
    };
  }
}

private async findSimilarQuestionsAdvanced(userQuestion: string, exampleQAs: any[]): Promise<any[]> {
  const normalizedUserQuestion = this.advancedNormalizeText(userQuestion);
  const userKeywords = this.extractKeywords(normalizedUserQuestion);
  
  const matches = [];

  for (const example of exampleQAs) {
    const normalizedExampleQuestion = this.advancedNormalizeText(example.question);
    const exampleKeywords = this.extractKeywords(normalizedExampleQuestion);
    const exampleTags = example.tags || [];

    // 1. Cosine similarity
    const cosineSimilarityScore = this.calculateCosineSimilarity(
      normalizedUserQuestion,
      normalizedExampleQuestion
    );

    // 2. Jaccard similarity với stemming
    const jaccardScore = this.calculateJaccardSimilarityWithStemming(
      normalizedUserQuestion,
      normalizedExampleQuestion
    );

    // 3. Keyword overlap (quan trọng nhất)
    const keywordOverlapScore = this.calculateKeywordOverlap(
      userKeywords,
      exampleKeywords
    );

    // 4. String similarity (đơn giản)
    const stringSimilarityScore = this.calculateStringSimilarity(
      normalizedUserQuestion,
      normalizedExampleQuestion
    );

    // 5. Phrase matching (tìm cụm từ giống nhau)
    const phraseMatchScore = this.calculatePhraseMatching(
      userQuestion,
      example.question
    );

    // Kết hợp scores - TĂNG weight cho keyword và phrase matching
    const combinedScore = (
      cosineSimilarityScore * 0.15 +
      jaccardScore * 0.20 +
      keywordOverlapScore * 0.35 + // Tăng weight cho keyword
      stringSimilarityScore * 0.15 +
      phraseMatchScore * 0.15 // Thêm phrase matching
    );


    // Giảm threshold xuống 0.3 để bắt nhiều hơn
    if (combinedScore > 0.3) {
      matches.push({
        ...example,
        similarity: combinedScore,
        scores: {
          cosineSimilarity: cosineSimilarityScore,
          jaccard: jaccardScore,
          keywordOverlap: keywordOverlapScore,
          stringSimilarity: stringSimilarityScore,
          phraseMatch: phraseMatchScore
        },
        method: 'combined',
        matchedTags: this.findMatchingTags(userKeywords, exampleTags)
      });
    }
  }

  // Sắp xếp theo similarity giảm dần
  return matches.sort((a, b) => b.similarity - a.similarity);
}

private extractPhrases(text: string): string[] {
  // Các cụm từ quan trọng trong tiếng Việt
  const importantPhrases = [
    'size chuẩn việt nam',
    'size âu mỹ', 
    'size âu',
    'size mỹ',
    'chuẩn việt nam',
    'chuẩn âu mỹ',
    'tư vấn size',
    'số đo 3 vòng',
    'vòng ngực',
    'vòng eo',
    'vòng mông',
    'giờ làm việc',
    'đăng ký tài khoản',
    'trả hàng',
    'đổi trả',
    'hoàn tiền'
  ];
  
  const foundPhrases: string[] = [];
  
  for (const phrase of importantPhrases) {
    if (text.includes(phrase)) {
      foundPhrases.push(phrase);
    }
  }
  
  return foundPhrases;
}

private calculatePhraseMatching(str1: string, str2: string): number {
  const phrases1 = this.extractPhrases(str1.toLowerCase());
  const phrases2 = this.extractPhrases(str2.toLowerCase());
  
  if (phrases1.length === 0 || phrases2.length === 0) return 0;
  
  const commonPhrases = phrases1.filter(phrase1 => 
    phrases2.some(phrase2 => 
      phrase2.includes(phrase1) || phrase1.includes(phrase2)
    )
  );
  
  return commonPhrases.length / Math.max(phrases1.length, phrases2.length);
}

// Thay thế Levenshtein bằng string similarity đơn giản hơn
private calculateStringSimilarity(str1: string, str2: string): number {
  // Đơn giản hóa: so sánh độ dài và ký tự chung
  const shorter = str1.length < str2.length ? str1 : str2;
  const longer = str1.length < str2.length ? str2 : str1;
  
  if (shorter.length === 0) return longer.length === 0 ? 1 : 0;
  
  // Tính % ký tự giống nhau
  let matchingChars = 0;
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) {
      matchingChars++;
    }
  }
  
  return matchingChars / Math.max(str1.length, str2.length);
}

// Thêm phương thức get common keywords cho debug
private getCommonKeywords(keywords1: string[], keywords2: string[]): string[] {
  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);
  return [...set1].filter(keyword => set2.has(keyword));
}


  private calculateCosineSimilarity(str1: string, str2: string): number {
    // Tạo vector từ vựng
    const tokens1 = this.tokenizer.tokenize(str1);
    const tokens2 = this.tokenizer.tokenize(str2);
    
    const allTokens = [...new Set([...tokens1, ...tokens2])];
    
    // Tạo vector tần suất
    const vector1 = allTokens.map(token => 
      tokens1.filter(t => t === token).length
    );
    const vector2 = allTokens.map(token => 
      tokens2.filter(t => t === token).length
    );
    
    // Tính cosine similarity
    const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0);
    const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));
    
    if (magnitude1 === 0 || magnitude2 === 0) return 0;
    
    return dotProduct / (magnitude1 * magnitude2);
  }

  private calculateJaccardSimilarityWithStemming(str1: string, str2: string): number {
    const tokens1 = this.tokenizer.tokenize(str1).map(token => this.stemmer.stem(token));
    const tokens2 = this.tokenizer.tokenize(str2).map(token => this.stemmer.stem(token));
    
    const set1 = new Set(tokens1.filter(token => token.length > 1));
    const set2 = new Set(tokens2.filter(token => token.length > 1));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size === 0 ? 0 : intersection.size / union.size;
  }

  private extractKeywords(text: string): string[] {
    const lowerText = text.toLowerCase();
    
    // Từ cần loại bỏ
    const stopWords = new Set([
      'có', 'và', 'là', 'của', 'cho', 'với', 'như', 'từ', 'đến', 'được',
      'một', 'các', 'hay', 'hoặc', 'nếu', 'thì', 'mà', 'ở', 'trong', 'ngoài',
      'trên', 'dưới', 'giữa', 'bằng', 'về', 'để', 'khi', 'nào', 'ai', 'gì',
      'ở đâu', 'tại sao', 'như thế nào', 'bao nhiêu', 'mấy', 'nè', 'ạ', 'vậy'
    ]);

    // Tách từ theo khoảng trắng (đơn giản hóa)
    const tokens = lowerText.split(/\s+/).filter(token => 
      token.length > 1 && !stopWords.has(token)
    );

    return [...new Set(tokens)]; // Remove duplicates
  }

  private calculateKeywordOverlap(keywords1: string[], keywords2: string[]): number {
    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size === 0 ? 0 : intersection.size / union.size;
  }


  private findMatchingTags(userKeywords: string[], tags: string[]): string[] {
    if (!tags || tags.length === 0) return [];
    
    const normalizedTags = tags.map(tag => 
      this.stemmer.stem(tag.toLowerCase().trim())
    );
    
    const userKeywordsSet = new Set(userKeywords);
    return tags.filter((tag, index) => userKeywordsSet.has(normalizedTags[index]));
  }

  private calculateMeasurementSimilarity(str1: string, str2: string): number {
    // Đặc biệt cho các câu hỏi về số đo
    const measurements1 = this.extractMeasurements(str1);
    const measurements2 = this.extractMeasurements(str2);
    
    if (measurements1.length === 0 || measurements2.length === 0) {
      return 0;
    }
    
    // Kiểm tra nếu có cùng pattern số đo (vd: 90-75-95 vs 90-70-95)
    const patternMatch = this.checkMeasurementPattern(measurements1, measurements2);
    
    if (patternMatch) {
      return 0.9; // Tăng score cho matching số đo
    }
    
    // Nếu có ít nhất một số đo trùng
    const commonMeasurements = measurements1.filter(m1 => 
      measurements2.some(m2 => Math.abs(m1 - m2) <= 5)
    );
    
    return commonMeasurements.length / Math.max(measurements1.length, measurements2.length);
  }

  private hasMeasurements(text: string): boolean {
    const measurements = this.extractMeasurements(text);
    return measurements.length >= 2; // Có ít nhất 2 số đo
  }

  private extractMeasurements(text: string): number[] {
    // Tìm tất cả các số trong text
    const matches = text.match(/\d+/g);
    return matches ? matches.map(m => parseInt(m, 10)) : [];
  }

  private checkMeasurementPattern(nums1: number[], nums2: number[]): boolean {
    // Kiểm tra nếu cả hai đều có 3 số (số đo 3 vòng)
    if (nums1.length >= 3 && nums2.length >= 3) {
      // So sánh các số đầu tiên (vòng ngực)
      const chestDiff = Math.abs(nums1[0] - nums2[0]);
      // So sánh các số thứ ba (vòng mông)
      const hipDiff = Math.abs(nums1[2] - nums2[2]);
      
      // Nếu chênh lệch trong vòng 10cm và có cùng pattern
      const isPatternMatch = chestDiff <= 10 && hipDiff <= 10;
      
      
      return isPatternMatch;
    }
    
    // Kiểm tra nếu có 2 số đo
    if (nums1.length >= 2 && nums2.length >= 2) {
      const firstDiff = Math.abs(nums1[0] - nums2[0]);
      const secondDiff = Math.abs(nums1[1] - nums2[1]);
      return firstDiff <= 10 && secondDiff <= 10;
    }
    
    return false;
  }

  private calculateNormalizedLevenshtein(str1: string, str2: string): number {
    // Implement Levenshtein distance
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;
    
    // Tạo matrix
    const matrix: number[][] = [];
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }
    
    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,     // deletion
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j - 1] + cost // substitution
        );
      }
    }
    
    const distance = matrix[len1][len2];
    const maxLength = Math.max(len1, len2);
    
    // Normalize to 0-1 (1 means identical, 0 means completely different)
    return maxLength === 0 ? 1 : 1 - (distance / maxLength);
  }

  private advancedNormalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\w\s]/g, ' ')
      .replace(/\d+/g, ' ') // Giữ số cho measurement matching (tách riêng)
      .replace(/\s+/g, ' ')
      .trim();
  }

  private advancedPromptAnalysis(prompt: string): any {
    const lowerPrompt = prompt.toLowerCase();
    const normalizedPrompt = this.advancedNormalizeText(prompt);
    const keywords = this.extractKeywords(normalizedPrompt);
    
    // Intent detection nâng cao
    let intent = 'other';
    let category = 'general';
    
    // Kiểm tra các intent dựa trên keywords
    if (keywords.includes('size') || keywords.includes('số đo') || keywords.includes('vòng')) {
      intent = 'tu_van_size';
      category = 'size';
    } else if (keywords.includes('giờ') || keywords.includes('mấy giờ') || keywords.includes('thời gian')) {
      intent = 'hỏi_giờ_làm';
      category = 'thông_tin';
    } else if (keywords.includes('đăng ký') || keywords.includes('register') || keywords.includes('tạo tài khoản')) {
      intent = 'đăng_ký';
      category = 'hướng_dẫn';
    } else if (keywords.includes('chào') || keywords.includes('hello') || keywords.includes('xin chào')) {
      intent = 'chào_hỏi';
      category = 'giao_tiếp';
    } else if (keywords.includes('giá') || keywords.includes('bao nhiêu') || keywords.includes('cost')) {
      intent = 'hỏi_giá';
      category = 'giá_cả';
    } else if (keywords.includes('mua') || keywords.includes('đặt hàng') || keywords.includes('order')) {
      intent = 'mua_hàng';
      category = 'đơn_hàng';
    } else if (keywords.includes('trả hàng') || keywords.includes('đổi') || keywords.includes('hoàn tiền')) {
      intent = 'trả_đổi';
      category = 'dịch_vụ';
    }

    return {
      intent,
      category,
      sentiment: 'neutral',
      confidence: 0.5,
      modelUsed: 'advanced_analysis',
      isTrainingExample: false,
      detectedKeywords: keywords
    };
  }

  // ==================== TRAINING DATA CREATION ====================

  private async createTrainingDataFromMessage(message: any, analysis: any) {
    try {
      // Chỉ tạo training data nếu confidence cao và là example tốt
      if (analysis.confidence > 0.7 && analysis.foundMatch) {
        // Tìm training session active
        const trainingSession = await this.prisma.trainingSession.findFirst({
          where: {
            modelType: 'classification',
            status: { in: ['collecting_data', 'training'] }
          },
          orderBy: { createdAt: 'desc' }
        });

        if (trainingSession) {
          await this.prisma.trainingData.create({
            data: {
              messageId: message.id,
              input: message.content,
              output: analysis.answer,
              category: analysis.category,
              intent: analysis.intent,
              qualityScore: analysis.confidence,
              source: 'example_qa_match',
              language: 'vi',
              trainingSessionId: trainingSession.id,
              metadata: {
                matchedQuestion: analysis.matchedQuestion,
                similarity: analysis.similarity,
                originalQuestion: message.content
              }
            },
          });

          
          // Tăng usage count của ExampleQA được match
          if (analysis.matchedQuestionId) {
            await this.prisma.exampleQA.update({
              where: { id: analysis.matchedQuestionId },
              data: {
                usageCount: { increment: 1 }
              }
            });
          }
        }
      }
    } catch (error) {
      console.error('Error creating training data:', error);
    }
  }

  // ==================== HELPER METHODS ====================

  private limitWords(text: string, maxWords: number): string {
    if (!text) return '';
    
    const words = text.trim().split(/\s+/);
    
    if (words.length <= maxWords) {
      return text;
    }
    
    const limitedWords = words.slice(0, maxWords);
    let result = limitedWords.join(' ');
    
    if (!/[.!?]$/.test(result)) {
      const lastSentenceEnd = Math.max(
        result.lastIndexOf('.'),
        result.lastIndexOf('!'),
        result.lastIndexOf('?')
      );
      
      if (lastSentenceEnd > result.length * 0.7) {
        result = result.substring(0, lastSentenceEnd + 1);
      } else {
        result += '...';
      }
    }
    
    return result;
  }

  private countWords(text: string): number {
    if (!text) return 0;
    return text.trim().split(/\s+/).length;
  }

  private generateConversationTitle(prompt: string): string {
    return prompt.length > 20 ? prompt.substring(0, 20) + '...' : prompt;
  }

  // ==================== EXISTING METHODS ====================

  async getConversation(id: string) {
    return this.prisma.conversation.findUnique({ 
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });
  }

  async getMessages(id: string) {
    return this.prisma.message.findMany({ 
      where: { conversationId: id }, 
      orderBy: { createdAt: 'asc' }
    });
  }

  async getMessagesByUser(userId: string) {
    const conversations = await this.prisma.conversation.findMany({
      where: { userId },
      select: { id: true },
    });

    const conversationIds = conversations.map(c => c.id);

    if (!conversationIds.length) {
      return [];
    }

    return this.prisma.message.findMany({
      where: {
        conversationId: { in: conversationIds },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // ==================== ANALYTICS METHODS ====================

  async getConversationAnalytics(conversationId: string) {
    const messages = await this.prisma.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' }
    });

    const userMessages = messages.filter(m => m.role === 'user');
    
    const analytics = {
      totalMessages: messages.length,
      userMessages: userMessages.length,
      assistantMessages: messages.length - userMessages.length,
      sources: this.countSources(messages),
      detectedIntents: this.countIntents(userMessages),
      sentimentDistribution: this.countSentiments(userMessages),
      averageConfidence: this.calculateAverageConfidence(userMessages),
      exampleQAMatches: messages.filter(m => m.source === 'example_qa').length,
    };

    return analytics;
  }

  private countSources(messages: any[]): any {
    const sources: any = {};
    messages.forEach(msg => {
      if (msg.source) {
        sources[msg.source] = (sources[msg.source] || 0) + 1;
      }
    });
    return sources;
  }

  private countIntents(messages: any[]): any {
    const intents: any = {};
    messages.forEach(msg => {
      if (msg.intent) {
        intents[msg.intent] = (intents[msg.intent] || 0) + 1;
      }
    });
    return intents;
  }

  private countSentiments(messages: any[]): any {
    const sentiments: any = {};
    messages.forEach(msg => {
      if (msg.sentiment) {
        sentiments[msg.sentiment] = (sentiments[msg.sentiment] || 0) + 1;
      }
    });
    return sentiments;
  }

  private calculateAverageConfidence(messages: any[]): number {
    const confidences = messages
      .filter(msg => msg.confidence)
      .map(msg => msg.confidence);
    
    if (confidences.length === 0) return 0;
    
    return confidences.reduce((a, b) => a + b, 0) / confidences.length;
  }

  // ==================== EXAMPLE QA MANAGEMENT ====================

  async getExampleQAAnalytics() {
    const totalExampleQAs = await this.prisma.exampleQA.count();
    const activeExampleQAs = await this.prisma.exampleQA.count({
      where: { isActive: true }
    });
    
    const intents = await this.prisma.exampleQA.groupBy({
      by: ['intent'],
      _count: { id: true },
      where: { isActive: true }
    });

    const categories = await this.prisma.exampleQA.groupBy({
      by: ['category'],
      _count: { id: true },
      where: { isActive: true }
    });

    // Top 10 most used ExampleQAs
    const mostUsed = await this.prisma.exampleQA.findMany({
      where: { isActive: true },
      orderBy: { usageCount: 'desc' },
      take: 10,
      select: {
        id: true,
        question: true,
        intent: true,
        category: true,
        usageCount: true
      }
    });

    return {
      total: totalExampleQAs,
      active: activeExampleQAs,
      inactive: totalExampleQAs - activeExampleQAs,
      intents: intents.reduce((acc, item) => {
        acc[item.intent || 'unknown'] = item._count.id;
        return acc;
      }, {}),
      categories: categories.reduce((acc, item) => {
        acc[item.category || 'unknown'] = item._count.id;
        return acc;
      }, {}),
      mostUsed
    };
  }

  // ==================== ENHANCED MATCHING DEBUG ====================

  async debugSimilarityMatching(userQuestion: string) {
    const exampleQAs = await this.prisma.exampleQA.findMany({
      where: { isActive: true }
    });

    const matches = await this.findSimilarQuestionsAdvanced(userQuestion, exampleQAs);
    
    return {
      userQuestion,
      totalExampleQAs: exampleQAs.length,
      matches: matches.slice(0, 5).map(match => ({
        question: match.question,
        answer: match.answer.substring(0, 100) + '...',
        intent: match.intent,
        category: match.category,
        similarity: match.similarity,
        scores: match.scores,
        matchedTags: match.matchedTags
      })),
      bestMatch: matches[0] ? {
        question: matches[0].question,
        similarity: matches[0].similarity,
        wouldMatch: matches[0].similarity >= 0.5
      } : null
    };
  }
}