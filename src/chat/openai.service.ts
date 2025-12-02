import { Injectable } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class OpenAiService {
  private apiKey: string;
  private model: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY || '';
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    if (!this.apiKey) console.warn('OPENAI_API_KEY not set - using echo fallback');
  }

  async callOpenAI(prompt: string, metadata?: any) {
    if (!this.apiKey) {
      const echoResponse = this.limitWords(`Echo: ${prompt}`, 50);
      return { text: echoResponse, usage: {} };
    }
    
    try {
      const systemMessage = this.buildSystemMessage(metadata?.system);
      
      const body = {
        model: this.model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: prompt }
        ],
        max_tokens: metadata?.max_tokens || 150, // Giảm max_tokens để hạn chế độ dài
        temperature: metadata?.temperature ?? 0.2
      };
      
      const resp = await axios.post('https://api.openai.com/v1/chat/completions', body, {
        headers: { Authorization: `Bearer ${this.apiKey}` }
      });
      
      const choices = resp.data?.choices || [];
      const rawText = (choices[0] && (choices[0].message?.content || choices[0].text)) || resp.data?.text || '';
      
      // Giới hạn câu trả lời không quá 50 từ
      const limitedText = this.limitWords(rawText, 50);
      
      return { 
        text: limitedText, 
        originalText: rawText, // Giữ nguyên để debug
        usage: resp.data?.usage || {} 
      };
      
    } catch (err: any) {
      console.error('OpenAI call failed', err?.response?.data || err.message);
      
      // Fallback: giới hạn echo response
      const fallbackResponse = this.limitWords(`Xin lỗi, tôi gặp sự cố kỹ thuật. Câu hỏi của bạn: ${prompt}`, 50);
      return { text: fallbackResponse, usage: {} };
    }
  }

  // THÊM PHƯƠNG THỨC MỚI: Gọi OpenAI với system prompt riêng
  async callOpenAIWithSystemPrompt(params: {
    userPrompt: string;
    systemPrompt: string;
    temperature?: number;
    maxTokens?: number;
  }) {
    if (!this.apiKey) {
      const echoResponse = this.limitWords(`Echo: ${params.userPrompt}`, 50);
      return { text: echoResponse, usage: {} };
    }
    
    try {
      const body = {
        model: this.model,
        messages: [
          { role: 'system', content: params.systemPrompt },
          { role: 'user', content: params.userPrompt }
        ],
        max_tokens: params.maxTokens || 300, // Tăng lên để đủ cho điều chỉnh
        temperature: params.temperature || 0.2 // Thấp để giữ tính nhất quán
      };
      
      console.log('Calling OpenAI with system prompt for answer adjustment');
      
      const resp = await axios.post('https://api.openai.com/v1/chat/completions', body, {
        headers: { Authorization: `Bearer ${this.apiKey}` }
      });
      
      const choices = resp.data?.choices || [];
      const rawText = (choices[0] && (choices[0].message?.content || choices[0].text)) || resp.data?.text || '';
      
      // KHÔNG giới hạn từ ở đây, để SmartAdjuster tự xử lý
      return { 
        text: rawText.trim(), 
        originalText: rawText,
        usage: resp.data?.usage || {} 
      };
      
    } catch (err: any) {
      console.error('OpenAI call with system prompt failed:', err?.response?.data || err.message);
      
      // Fallback đơn giản
      const fallbackResponse = `Xin lỗi, tôi gặp sự cố khi điều chỉnh câu trả lời.`;
      return { text: fallbackResponse, usage: {} };
    }
  }

  // System message yêu cầu trả lời ngắn gọn
  private buildSystemMessage(customSystem?: string): string {
    const baseMessage = 'Bạn là trợ lý AI hữu ích. Hãy trả lời ngắn gọn, súc tích, không quá 50 từ. Tập trung vào thông tin chính.';
    
    if (customSystem) {
      return `${baseMessage} ${customSystem}`;
    }
    
    return baseMessage;
  }

  // Hàm giới hạn số từ
  private limitWords(text: string, maxWords: number): string {
    if (!text) return '';
    
    const words = text.trim().split(/\s+/);
    
    if (words.length <= maxWords) {
      return text;
    }
    
    // Cắt đến từ thứ maxWords và thêm dấu ... nếu cần
    const limitedWords = words.slice(0, maxWords);
    let result = limitedWords.join(' ');
    
    // Đảm bảo kết thúc bằng dấu câu hợp lý
    if (!/[.!?]$/.test(result)) {
      // Tìm vị trí dấu câu gần nhất từ cuối
      const lastSentenceEnd = Math.max(
        result.lastIndexOf('.'),
        result.lastIndexOf('!'),
        result.lastIndexOf('?')
      );
      
      if (lastSentenceEnd > result.length * 0.7) {
        // Nếu có dấu câu ở phần cuối, cắt tại đó
        result = result.substring(0, lastSentenceEnd + 1);
      } else {
        // Nếu không, thêm dấu ...
        result += '...';
      }
    }
    
    return result;
  }

  // Helper method để đếm số từ
  public countWords(text: string): number {
    if (!text) return 0;
    return text.trim().split(/\s+/).length;
  }

  async analyzeIntentWithContext(params: {
  userPrompt: string;
  conversationHistory: Array<{role: 'user' | 'assistant', content: string}>;
  lastProducts?: any[]; // Sản phẩm vừa được đề cập
}): Promise<{
  intent: string;
  confidence: number;
  extractedProductName?: string;
  isFollowUp: boolean;
  needsProductSearch: boolean;
  responseType: 'product_detail' | 'product_list' | 'general_answer' | 'confirmation';
}> {
  if (!this.apiKey) {
    // Fallback đơn giản
    return {
      intent: 'general_question',
      confidence: 0.5,
      isFollowUp: false,
      needsProductSearch: this.hasProductKeywords(params.userPrompt),
      responseType: 'general_answer'
    };
  }

  try {
    const systemPrompt = `Bạn là AI phân tích intent cho chatbot bán hàng. 
    PHÂN TÍCH ngữ cảnh và xác định ý định người dùng.

    LỊCH SỬ TRÒ CHUYỆN (mới nhất ở dưới):
    ${params.conversationHistory.map((msg, i) => 
      `${msg.role === 'user' ? 'User' : 'Bot'}: ${msg.content}`
    ).join('\n')}

    ${params.lastProducts ? `SẢN PHẨM VỪA ĐỀ CẬP: ${params.lastProducts.map(p => p.name).join(', ')}` : ''}

    PROMPT HIỆN TẠI: "${params.userPrompt}"

    TRẢ VỀ JSON với cấu trúc:
    {
      "intent": "search_product" | "ask_product_detail" | "confirm_yes" | "confirm_no" | "ask_price" | "general_question",
      "confidence": số từ 0.0 đến 1.0,
      "extractedProductName": "tên sản phẩm nếu có" (hoặc null),
      "isFollowUp": true/false,
      "needsProductSearch": true/false,
      "responseType": "product_detail" | "product_list" | "general_answer" | "confirmation"
    }

    CÁC INTENT:
    - search_product: tìm sản phẩm mới (vd: "áo thun", "quần jean")
    - ask_product_detail: hỏi chi tiết sản phẩm đang nói (vd: "có", "chi tiết", "kích thước")
    - confirm_yes: xác nhận có (vd: "có", "được", "ok")
    - confirm_no: từ chối (vd: "không", "thôi")
    - ask_price: hỏi giá
    - general_question: câu hỏi chung khác

    Phân tích kỹ: Nếu người dùng nói "có" sau khi bot hỏi "Bạn có muốn biết thêm...?" → intent là "ask_product_detail"`;

    const body = {
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Phân tích intent cho prompt trên' }
      ],
      max_tokens: 300,
      temperature: 0.1,
      response_format: { type: 'json_object' }
    };

    const resp = await axios.post('https://api.openai.com/v1/chat/completions', body, {
      headers: { Authorization: `Bearer ${this.apiKey}` }
    });

    const content = resp.data?.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const result = JSON.parse(content);
    return {
      intent: result.intent || 'general_question',
      confidence: result.confidence || 0.5,
      extractedProductName: result.extractedProductName,
      isFollowUp: result.isFollowUp || false,
      needsProductSearch: result.needsProductSearch || false,
      responseType: result.responseType || 'general_answer'
    };

  } catch (err: any) {
    console.error('OpenAI intent analysis failed:', err.message);
    
    // Fallback đơn giản
    const hasProductKeywords = this.hasProductKeywords(params.userPrompt);
    return {
      intent: hasProductKeywords ? 'search_product' : 'general_question',
      confidence: 0.3,
      isFollowUp: false,
      needsProductSearch: hasProductKeywords,
      responseType: hasProductKeywords ? 'product_list' : 'general_answer'
    };
  }
  }

  private hasProductKeywords(text: string): boolean {
    const lowerText = text.toLowerCase();
    const productKeywords = ['áo', 'quần', 'váy', 'giày', 'dép', 'túi', 'mũ', 'kính', 'sản phẩm', 'hàng'];
    return productKeywords.some(keyword => lowerText.includes(keyword));
  }
}