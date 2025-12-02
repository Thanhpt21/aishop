import { Injectable } from '@nestjs/common';
import { OpenAiService } from './openai.service';

@Injectable()
export class SmartAdjusterService {
  constructor(private openai: OpenAiService) {}

  async adjustAnswerWithAI(
    userQuestion: string,
    exampleAnswer: string,
    exampleQuestion: string,
    intent: string,
    category: string
  ): Promise<string> {
    // Kiểm tra nếu cần điều chỉnh
    if (!this.needsAdjustment(userQuestion, exampleQuestion, exampleAnswer)) {
      return exampleAnswer;
    }

    try {
      // Phân tích loại câu hỏi để có prompt phù hợp
      const adjustmentPrompt = this.createAdjustmentPrompt(
        userQuestion,
        exampleAnswer,
        exampleQuestion,
        intent,
        category
      );

      const response = await this.openai.callOpenAIWithSystemPrompt({
        userPrompt: `Điều chỉnh câu trả lời cho: "${userQuestion}"`,
        systemPrompt: adjustmentPrompt,
        temperature: 0.2,
        maxTokens: 300
      });

      return response.text?.trim() || exampleAnswer;
    } catch (error) {
      console.error('AI adjustment failed, using fallback:', error);
      return this.fallbackAdjustment(userQuestion, exampleAnswer, exampleQuestion, intent);
    }
  }

  private needsAdjustment(
    userQuestion: string, 
    exampleQuestion: string, 
    exampleAnswer: string
  ): boolean {
    // Không điều chỉnh nếu:
    // 1. Câu hỏi giống hệt nhau
    if (userQuestion.toLowerCase() === exampleQuestion.toLowerCase()) {
      return false;
    }

    // 2. Kiểm tra các yếu tố cần điều chỉnh
    const needsAdjust = this.checkAdjustmentFactors(userQuestion, exampleQuestion, exampleAnswer);
    
    return needsAdjust;
  }

  private checkAdjustmentFactors(
    userQuestion: string, 
    exampleQuestion: string, 
    exampleAnswer: string
  ): boolean {
    // 1. Kiểm tra số đo
    if (this.hasMeasurements(userQuestion) && this.hasMeasurements(exampleQuestion)) {
      const userMeasurements = this.extractMeasurements(userQuestion);
      const exampleMeasurements = this.extractMeasurements(exampleQuestion);
      
      // Nếu số đo khác nhau => cần điều chỉnh
      if (!this.areMeasurementsSimilar(userMeasurements, exampleMeasurements)) {
        return true;
      }
    }

    // 2. Kiểm tra số liệu/thời gian/giá cả
    if (this.hasNumbers(userQuestion) && this.hasNumbers(exampleQuestion)) {
      const userNumbers = this.extractAllNumbers(userQuestion);
      const exampleNumbers = this.extractAllNumbers(exampleQuestion);
      
      // Nếu số liệu quan trọng khác nhau
      if (!this.areNumbersSimilar(userNumbers, exampleNumbers)) {
        return true;
      }
    }

    // 3. Kiểm tra tên riêng/sản phẩm
    const userSpecifics = this.extractSpecificEntities(userQuestion);
    const exampleSpecifics = this.extractSpecificEntities(exampleQuestion);
    
    if (userSpecifics.length > 0 && exampleSpecifics.length > 0) {
      // Nếu có tên riêng/sản phẩm khác nhau
      if (!this.areEntitiesSimilar(userSpecifics, exampleSpecifics)) {
        return true;
      }
    }

    return false;
  }

  private createAdjustmentPrompt(
    userQuestion: string,
    exampleAnswer: string,
    exampleQuestion: string,
    intent: string,
    category: string
  ): string {
    // Template prompt theo loại câu hỏi
    const templates: Record<string, string> = {
      'tu_van_size': `Bạn là chuyên gia tư vấn size quần áo. Hãy điều chỉnh câu trả lời dựa trên số đo mới:

NGUYÊN TẮC:
1. PHÂN TÍCH: So sánh số đo trong hai câu hỏi
2. ĐIỀU CHỈNH: Thay đổi size và số đo trong câu trả lời
3. GIỮ NGUYÊN: Phong cách, cấu trúc, độ dài câu
4. CHÍNH XÁC: Đảm bảo size phù hợp với số đo mới

THÔNG TIN:
- Câu hỏi mẫu: "${exampleQuestion}"
- Câu trả lời mẫu: "${exampleAnswer}"
- Câu hỏi thực tế: "${userQuestion}"

YÊU CẦU:
Chỉ trả về câu trả lời đã điều chỉnh, không giải thích thêm.`,

      'hỏi_giá': `Bạn là chuyên viên tư vấn giá. Hãy điều chỉnh câu trả lời:

NGUYÊN TẮC:
1. Xác định sản phẩm/dịch vụ được hỏi
2. Nếu cùng sản phẩm, giữ nguyên thông tin giá
3. Nếu khác sản phẩm, đề xuất cách tìm hiểu giá
4. Giữ nguyên cấu trúc và độ tin cậy

THÔNG TIN:
- Câu hỏi mẫu: "${exampleQuestion}"
- Câu trả lời mẫu: "${exampleAnswer}"
- Câu hỏi thực tế: "${userQuestion}"

YÊU CẦU:
Chỉ trả về câu trả lời đã điều chỉnh.`,

      'hỏi_giờ_làm': `Bạn là trợ lý thông tin. Điều chỉnh câu trả lời:

NGUYÊN TẮC:
1. So sánh thời gian/ngày được hỏi
2. Điều chỉnh thông tin nếu khác nhau
3. Giữ nguyên độ chính xác
4. Lịch sự và rõ ràng

THÔNG TIN:
- Câu hỏi mẫu: "${exampleQuestion}"
- Câu trả lời mẫu: "${exampleAnswer}"
- Câu hỏi thực tế: "${userQuestion}"

YÊU CẦU:
Chỉ trả về câu trả lời cuối cùng.`,

      'đăng_ký': `Bạn là trợ lý hướng dẫn. Điều chỉnh câu trả lời:

NGUYÊN TẮC:
1. Xác định loại đăng ký được hỏi
2. Giữ nguyên các bước hướng dẫn
3. Điều chỉnh nếu có chi tiết khác biệt
4. Rõ ràng, dễ hiểu

THÔNG TIN:
- Câu hỏi mẫu: "${exampleQuestion}"
- Câu trả lời mẫu: "${exampleAnswer}"
- Câu hỏi thực tế: "${userQuestion}"

YÊU CẦU:
Chỉ trả về câu trả lời đã điều chỉnh.`,

      'default': `Bạn là trợ lý thông minh. Hãy điều chỉnh câu trả lời sau cho phù hợp với câu hỏi mới:

NGUYÊN TẮC:
1. PHÂN TÍCH: So sánh hai câu hỏi, tìm điểm khác biệt chính
2. ĐIỀU CHỈNH: Sửa câu trả lời để phù hợp với câu hỏi mới
3. GIỮ NGUYÊN: Phong cách, độ dài, tính chuyên nghiệp
4. CHÍNH XÁC: Thông tin phải đúng với câu hỏi mới

THÔNG TIN:
- Câu hỏi mẫu: "${exampleQuestion}"
- Câu trả lời mẫu: "${exampleAnswer}"
- Câu hỏi thực tế: "${userQuestion}"

YÊU CẦU:
Chỉ trả về câu trả lời đã điều chỉnh, không thêm giải thích.`
    };

    return templates[intent] || templates.default;
  }

  private fallbackAdjustment(
    userQuestion: string,
    exampleAnswer: string,
    exampleQuestion: string,
    intent: string
  ): string {
    // Fallback logic khi AI fails
    switch(intent) {
      case 'tu_van_size':
        return this.adjustSizeAnswer(userQuestion, exampleAnswer, exampleQuestion);
      case 'hỏi_giá':
        return this.adjustPriceAnswer(userQuestion, exampleAnswer);
      case 'hỏi_giờ_làm':
        return this.adjustTimeAnswer(userQuestion, exampleAnswer);
      default:
        return exampleAnswer;
    }
  }

  private adjustSizeAnswer(
    userQuestion: string,
    exampleAnswer: string,
    exampleQuestion: string
  ): string {
    const userMeasurements = this.extractMeasurements(userQuestion);
    const exampleMeasurements = this.extractMeasurements(exampleQuestion);
    
    if (userMeasurements.length >= 3 && exampleMeasurements.length >= 3) {
      // Thay thế số đo trong câu trả lời
      let result = exampleAnswer;
      
      // Thay thế từng số đo
      exampleMeasurements.forEach((exampleNum, index) => {
        if (index < userMeasurements.length) {
          const userNum = userMeasurements[index];
          // Tìm và thay thế số đo
          const regex = new RegExp(`\\b${exampleNum}\\b`, 'g');
          result = result.replace(regex, userNum.toString());
        }
      });
      
      // Thay thế chuỗi số đo (90-70-95 -> 90-75-95)
      if (exampleMeasurements.length >= 3 && userMeasurements.length >= 3) {
        const oldPattern = exampleMeasurements.slice(0, 3).join('-');
        const newPattern = userMeasurements.slice(0, 3).join('-');
        result = result.replace(new RegExp(oldPattern, 'g'), newPattern);
      }
      
      return result;
    }
    
    return exampleAnswer;
  }

  private adjustPriceAnswer(userQuestion: string, exampleAnswer: string): string {
    // Đơn giản: trả về câu trả lời gốc, thêm note
    if (userQuestion.toLowerCase().includes('giá') || userQuestion.includes('bao nhiêu')) {
      return exampleAnswer + " (Vui lòng liên hệ shop để biết giá chính xác cho sản phẩm cụ thể)";
    }
    return exampleAnswer;
  }

  private adjustTimeAnswer(userQuestion: string, exampleAnswer: string): string {
    // Điều chỉnh thời gian nếu có
    const userDays = this.extractDays(userQuestion);
    const answerDays = this.extractDays(exampleAnswer);
    
    if (userDays.length > 0 && answerDays.length > 0) {
      let result = exampleAnswer;
      userDays.forEach(userDay => {
        answerDays.forEach(answerDay => {
          // Thay thế ngày trong tuần
          if (answerDay && userDay) {
            const regex = new RegExp(answerDay, 'gi');
            result = result.replace(regex, userDay);
          }
        });
      });
      return result;
    }
    
    return exampleAnswer;
  }

  // Helper methods
  private hasMeasurements(text: string): boolean {
    return /\d+-\d+-\d+/.test(text) || text.includes('số đo');
  }

  private extractMeasurements(text: string): number[] {
    const matches = text.match(/\d+/g);
    return matches ? matches.map(m => parseInt(m, 10)) : [];
  }

  private areMeasurementsSimilar(m1: number[], m2: number[]): boolean {
    if (m1.length !== m2.length) return false;
    for (let i = 0; i < m1.length; i++) {
      if (Math.abs(m1[i] - m2[i]) > 5) return false;
    }
    return true;
  }

  private hasNumbers(text: string): boolean {
    return /\d+/.test(text);
  }

  private extractAllNumbers(text: string): number[] {
    const matches = text.match(/\d+/g);
    return matches ? matches.map(m => parseInt(m, 10)) : [];
  }

  private areNumbersSimilar(n1: number[], n2: number[]): boolean {
    if (n1.length !== n2.length) return false;
    // For prices/dates, require exact match
    for (let i = 0; i < n1.length; i++) {
      if (n1[i] !== n2[i]) return false;
    }
    return true;
  }

  private extractSpecificEntities(text: string): string[] {
    // Extract product names, brands, etc.
    const productPatterns = [
      /sản phẩm\s+([^\s,.!?]+)/i,
      /mẫu\s+([^\s,.!?]+)/i,
      /áo\s+([^\s,.!?]+)/i,
      /quần\s+([^\s,.!?]+)/i,
      /đầm\s+([^\s,.!?]+)/i,
      /váy\s+([^\s,.!?]+)/i
    ];
    
    const entities: string[] = [];
    for (const pattern of productPatterns) {
      const match = text.match(pattern);
      if (match) entities.push(match[1]);
    }
    
    return entities;
  }

  private areEntitiesSimilar(e1: string[], e2: string[]): boolean {
    if (e1.length === 0 || e2.length === 0) return true;
    return e1.some(entity1 => 
      e2.some(entity2 => 
        entity1.toLowerCase() === entity2.toLowerCase() ||
        entity2.toLowerCase().includes(entity1.toLowerCase())
      )
    );
  }

  private extractDays(text: string): string[] {
    const days = ['thứ 2', 'thứ 3', 'thứ 4', 'thứ 5', 'thứ 6', 'thứ 7', 'chủ nhật', 'thứ hai', 'thứ ba', 'thứ tư', 'thứ năm', 'thứ sáu', 'thứ bảy'];
    const foundDays: string[] = [];
    
    days.forEach(day => {
      if (text.toLowerCase().includes(day)) {
        foundDays.push(day);
      }
    });
    
    return foundDays;
  }
}