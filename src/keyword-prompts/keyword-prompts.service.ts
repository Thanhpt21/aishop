// src/keyword-prompts/keyword-prompts.service.ts
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateKeywordPromptDto } from './dto/create-keyword-prompt.dto';
import { UpdateKeywordPromptDto } from './dto/update-keyword-prompt.dto';
import { KeywordPromptResponseDto } from './dto/keyword-prompt-response.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as XLSX from 'xlsx';

@Injectable()
export class KeywordPromptsService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateKeywordPromptDto, ownerEmail?: string) {
    // Kiểm tra trùng keyword với cùng ownerEmail
    const existing = await this.prisma.keywordPrompt.findFirst({
      where: {
        keyword: dto.keyword,
        ownerEmail: ownerEmail || dto.ownerEmail || null,
      },
    });

    if (existing) {
      throw new BadRequestException(`Keyword "${dto.keyword}" đã tồn tại`);
    }

    const keywordPrompt = await this.prisma.keywordPrompt.create({
      data: {
        keyword: dto.keyword,
        prompt: dto.prompt,
        sampleAnswer: dto.sampleAnswer,
        additionalInfo: dto.additionalInfo || null,
        priority: dto.priority || 0,
        ownerEmail: ownerEmail || dto.ownerEmail || null,
      },
    });

    return {
      success: true,
      message: 'Tạo keyword prompt thành công',
      data: new KeywordPromptResponseDto(keywordPrompt),
    };
  }

  async findAll(
    page = 1,
    limit = 10,
    search = '',
    minPriority?: number,
    maxPriority?: number,
    ownerEmail?: string,
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};

    // Filter by ownerEmail nếu có
    if (ownerEmail) {
      where.ownerEmail = ownerEmail;
    }

    if (search) {
      where.OR = [
        { keyword: { contains: search, mode: 'insensitive' } },
        { prompt: { contains: search, mode: 'insensitive' } },
        { sampleAnswer: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (minPriority !== undefined || maxPriority !== undefined) {
      where.priority = {};
      if (minPriority !== undefined) where.priority.gte = minPriority;
      if (maxPriority !== undefined) where.priority.lte = maxPriority;
    }

    const [keywordPrompts, total] = await this.prisma.$transaction([
      this.prisma.keywordPrompt.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ],
      }),
      this.prisma.keywordPrompt.count({ where }),
    ]);

    return {
      success: true,
      message: 'Lấy danh sách keyword prompt thành công',
      data: {
        data: keywordPrompts.map(item => new KeywordPromptResponseDto(item)),
        total,
        page,
        pageCount: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: number, ownerEmail?: string) {
    const where: any = { id };
    
    // Filter by ownerEmail nếu có
    if (ownerEmail) {
      where.ownerEmail = ownerEmail;
    }
    
    const keywordPrompt = await this.prisma.keywordPrompt.findFirst({
      where,
    });
    
    if (!keywordPrompt) {
      throw new NotFoundException('Keyword prompt không tồn tại hoặc bạn không có quyền truy cập');
    }
    
    return { 
      success: true, 
      data: new KeywordPromptResponseDto(keywordPrompt) 
    };
  }

  async findByKeyword(keyword: string, ownerEmail?: string) {
    const where: any = {
      keyword: { contains: keyword, mode: 'insensitive' }
    };
    
    if (ownerEmail) {
      where.ownerEmail = ownerEmail;
    }

    const keywordPrompts = await this.prisma.keywordPrompt.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ],
    });

    return {
      success: true,
      message: 'Tìm kiếm keyword prompt thành công',
      data: keywordPrompts.map(item => new KeywordPromptResponseDto(item)),
    };
  }

  async update(id: number, dto: UpdateKeywordPromptDto, ownerEmail?: string) {
    const where: any = { id };
    
    // Check ownership nếu có ownerEmail
    if (ownerEmail) {
      where.ownerEmail = ownerEmail;
    }

    const keywordPrompt = await this.prisma.keywordPrompt.findFirst({
      where,
    });
    
    if (!keywordPrompt) {
      throw new NotFoundException('Keyword prompt không tồn tại hoặc bạn không có quyền chỉnh sửa');
    }

    // Kiểm tra trùng keyword nếu có thay đổi
    if (dto.keyword && dto.keyword !== keywordPrompt.keyword) {
      const existing = await this.prisma.keywordPrompt.findFirst({
        where: {
          keyword: dto.keyword,
          ownerEmail: ownerEmail || keywordPrompt.ownerEmail,
          id: { not: id },
        },
      });

      if (existing) {
        throw new BadRequestException(`Keyword "${dto.keyword}" đã tồn tại`);
      }
    }

    const updated = await this.prisma.keywordPrompt.update({
      where: { id },
      data: {
        keyword: dto.keyword ?? keywordPrompt.keyword,
        prompt: dto.prompt ?? keywordPrompt.prompt,
        sampleAnswer: dto.sampleAnswer ?? keywordPrompt.sampleAnswer,
        additionalInfo: dto.additionalInfo ?? keywordPrompt.additionalInfo,
        priority: dto.priority ?? keywordPrompt.priority,
        ownerEmail: dto.ownerEmail ?? keywordPrompt.ownerEmail,
      },
    });

    return {
      success: true,
      message: 'Cập nhật keyword prompt thành công',
      data: new KeywordPromptResponseDto(updated),
    };
  }

  async remove(id: number, ownerEmail?: string) {
    const where: any = { id };
    
    // Check ownership nếu có ownerEmail
    if (ownerEmail) {
      where.ownerEmail = ownerEmail;
    }
    
    const keywordPrompt = await this.prisma.keywordPrompt.findFirst({
      where,
    });
    
    if (!keywordPrompt) {
      throw new NotFoundException('Keyword prompt không tồn tại hoặc bạn không có quyền xóa');
    }

    await this.prisma.keywordPrompt.delete({ where: { id } });
    
    return { 
      success: true, 
      message: 'Xóa keyword prompt thành công' 
    };
  }

  async importKeywordPrompts(file: Express.Multer.File, ownerEmail?: string) {
    if (!file) {
      throw new BadRequestException('File không được tìm thấy');
    }

    try {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json(worksheet);

      const results = {
        total: data.length,
        success: 0,
        errors: [] as string[],
        details: [] as any[]
      };

      // Lấy tất cả keyword prompts hiện có để check trùng
      const existingPrompts = await this.prisma.keywordPrompt.findMany({
        where: ownerEmail ? { ownerEmail } : {},
        select: { keyword: true }
      });
      const existingKeywords = new Set(existingPrompts.map(item => item.keyword.toLowerCase().trim()));

      for (const [index, row] of data.entries()) {
        try {
          const rowData = row as Record<string, any>;

          // Map Excel columns to data
          const promptData: CreateKeywordPromptDto = {
            keyword: String(rowData['Từ khóa'] || '').trim(),
            prompt: String(rowData['Prompt'] || '').trim(),
            sampleAnswer: String(rowData['Câu trả lời mẫu'] || '').trim(),
            additionalInfo: rowData['Thông tin bổ sung'] ? String(rowData['Thông tin bổ sung']).trim() : undefined,
            priority: this.parseOptionalNumber(rowData['Ưu tiên']) || 0,
            ownerEmail: ownerEmail || (rowData['Email chủ sở hữu'] ? String(rowData['Email chủ sở hữu']).trim() : undefined),
          };

          // Validate required fields
          if (!promptData.keyword) {
            throw new Error('Từ khóa là bắt buộc');
          }
          if (!promptData.prompt) {
            throw new Error('Prompt là bắt buộc');
          }
          if (!promptData.sampleAnswer) {
            throw new Error('Câu trả lời mẫu là bắt buộc');
          }

          // Check trùng keyword
          const normalizedKeyword = promptData.keyword.toLowerCase().trim();
          if (existingKeywords.has(normalizedKeyword)) {
            throw new Error('Từ khóa đã tồn tại trong hệ thống');
          }

          // Create keyword prompt
          await this.prisma.keywordPrompt.create({
            data: {
              keyword: promptData.keyword,
              prompt: promptData.prompt,
              sampleAnswer: promptData.sampleAnswer,
              additionalInfo: promptData.additionalInfo,
              priority: promptData.priority,
              ownerEmail: promptData.ownerEmail,
            }
          });

          existingKeywords.add(normalizedKeyword);
          results.success++;
          results.details.push({
            row: index + 2,
            keyword: promptData.keyword.substring(0, 50),
            status: 'SUCCESS',
            message: 'Thành công'
          });

        } catch (error: any) {
          const rowNumber = index + 2;
          const errorMessage = `Dòng ${rowNumber}: ${error.message}`;
          
          results.errors.push(errorMessage);
          results.details.push({
            row: rowNumber,
            keyword: String((row as any)?.['Từ khóa'] || 'N/A').substring(0, 50),
            status: 'ERROR',
            message: error.message
          });
        }
      }

      return {
        success: true,
        message: `Import hoàn tất: ${results.success}/${results.total} keyword prompt thành công`,
        data: results
      };

    } catch (error: any) {
      throw new BadRequestException('Lỗi khi xử lý file Excel: ' + error.message);
    }
  }

  async exportKeywordPrompts(ownerEmail?: string) {
    try {
      const keywordPrompts = await this.prisma.keywordPrompt.findMany({
        where: ownerEmail ? { ownerEmail } : {},
        orderBy: [
          { priority: 'desc' },
          { createdAt: 'desc' }
        ]
      });

      const exportData = keywordPrompts.map(item => ({
        'Từ khóa': item.keyword,
        'Prompt': item.prompt,
        'Câu trả lời mẫu': item.sampleAnswer,
        'Thông tin bổ sung': item.additionalInfo || '',
        'Ưu tiên': item.priority,
        'Email chủ sở hữu': item.ownerEmail || '',
        'Ngày tạo': this.formatDate(item.createdAt),
        'Ngày cập nhật': this.formatDate(item.updatedAt)
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'KeywordPrompts');
      
      const colWidths = [
        { wch: 25 }, // Từ khóa
        { wch: 40 }, // Prompt
        { wch: 40 }, // Câu trả lời mẫu
        { wch: 30 }, // Thông tin bổ sung
        { wch: 10 }, // Ưu tiên
        { wch: 25 }, // Email chủ sở hữu
        { wch: 15 }, // Ngày tạo
        { wch: 15 }, // Ngày cập nhật
      ];
      worksheet['!cols'] = colWidths;
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      return {
        success: true,
        message: 'Export danh sách keyword prompt thành công',
        data: {
          buffer: buffer,
          fileName: `keyword_prompts_export_${new Date().toISOString().split('T')[0]}.xlsx`
        }
      };
    } catch (error: any) {
      throw new BadRequestException('Lỗi khi export: ' + error.message);
    }
  }

async exportTemplate() {
  try {
    const templateData = [
      // I. KỊCH BẢN CHỐT SALE (THEO DẤU HIỆU MUA HÀNG)
      {
        'Từ khóa': 'giá bao nhiêu|sale|giảm giá|khuyến mãi|voucher',
        'Prompt': 'Khách hỏi về giá sản phẩm và chương trình khuyến mãi. Hãy tạo urgency: sale chỉ còn 30 phút và đề nghị lấy thông tin.',
        'Câu trả lời mẫu': '🎯 ƯU ĐÃI ĐỘC QUYỀN: Sản phẩm đang giảm 30% chỉ còn 30 phút nữa! Bạn có thể nhận thêm voucher 50k khi đặt hàng ngay. Để mình giữ ưu đãi này cho bạn, cho mình xin tên và số điện thoại nhé! 📱',
        'Thông tin bổ sung': 'Kịch bản E - Tạo urgency với thời gian giới hạn',
        'Ưu tiên': 10,
        'Email chủ sở hữu': 'admin@example.com'
      },
      {
        'Từ khóa': 'ship hỏa tốc|giao nhanh|2 tiếng|trong ngày',
        'Prompt': 'Khách yêu cầu giao hàng hỏa tốc trong 2 tiếng. Xác nhận khả năng và áp dụng ưu đãi freeship hỏa tốc.',
        'Câu trả lời mẫu': '✅ SHIP HỎA TỐC 2H CÓ SẴN! Shop hỗ trợ giao siêu tốc trong 2 giờ khu vực nội thành. Đặc biệt: Đơn hỏa tốc này được MIỄN PHÍ SHIP 100%! Bạn cần lấy thông tin để xác nhận đơn ngay không ạ? 🚀',
        'Thông tin bổ sung': 'Kịch bản E mục II - Freeship hỏa tốc',
        'Ưu tiên': 9,
        'Email chủ sở hữu': 'admin@example.com'
      },
      {
        'Từ khóa': 'cao 1m|nặng|kg|vòng eo|size nào|chọn size',
        'Prompt': 'Khách cung cấp thông số cơ thể và hỏi size. Chốt size cụ thể và cam kết vừa vặn.',
        'Câu trả lời mẫu': '👕 THEO THÔNG SỐ CỦA BẠN: Chiều cao 1m65, 55kg, eo 70cm - Size M sẽ vừa đẹp nhất! 🎯 CAM KẾT VỪA VẶN: Shop hỗ trợ ship 2 size M/L để bạn thử hoặc MIỄN PHÍ ĐỔI SIZE trọn đời nếu không vừa! Bạn muốn đặt size M chứ ạ?',
        'Thông tin bổ sung': 'Kịch bản H - Cam kết vừa vặn',
        'Ưu tiên': 8,
        'Email chủ sở hữu': 'admin@example.com'
      },
      {
        'Từ khóa': 'mua 3|mua nhiều|cho cả nhà|combo|số lượng',
        'Prompt': 'Khách muốn mua số lượng nhiều cho cả nhà. Áp dụng ưu đãi combo và thúc đẩy lấy thông tin.',
        'Câu trả lời mẫu': '🎁 ƯU ĐÃI COMBO HẤP DẪN: Khi mua 3 sản phẩm trở lên, bạn được GIẢM THÊM 15% + TẶNG VOUCHER 100k cho lần mua sau! Đây là deal chỉ áp dụng cho đơn combo. Cho mình xin tên và SĐT để lưu đơn và ưu đãi nhé! 👨‍👩‍👧‍👦',
        'Thông tin bổ sung': 'Kịch bản D - Ưu đãi combo',
        'Ưu tiên': 7,
        'Email chủ sở hữu': 'admin@example.com'
      },
      {
        'Từ khóa': 'cotton 100|chất liệu|vải|ship tỉnh|phí ship',
        'Prompt': 'Khách hỏi chất liệu rồi ngay lập tức hỏi phí ship - dấu hiệu bỏ qua bước. Chuyển sang chốt sale ngay.',
        'Câu trả lời mẫu': '✅ Chất liệu Cotton 100% cao cấp, co giãn 4 chiều. ⚡ VÀ NGAY BÂY GIỜ: Đơn hàng của bạn được Freeship toàn quốc + Giảm thêm 10% khi đặt ngay! Deal này chỉ có trong hôm nay. Bạn muốn nhận ưu đãi đặc biệt này chứ? 🚀',
        'Thông tin bổ sung': 'Kịch bản K - Xử lý bỏ qua bước',
        'Ưu tiên': 8,
        'Email chủ sở hữu': 'admin@example.com'
      },
      {
        'Từ khóa': 'còn size|giá ship|bao lâu|còn hàng|có sẵn',
        'Prompt': 'Khách hỏi liên tiếp 3 câu trong 1 lần chat. Tổng hợp và kết hợp ưu đãi để chốt đơn.',
        'Câu trả lời mẫu': '💎 TỔNG HỢP THÔNG TIN CHO BẠN: 1) Size M còn 5 chiếc cuối 2) Giá XXXX 3) Ship 2-3 ngày. 🎯 ƯU ĐÃI TỔNG: Freeship + Giảm 10% = Chỉ còn XXXX! Bạn muốn đặt ngay để giữ size và nhận ưu đãi kép này không?',
        'Thông tin bổ sung': 'Kịch bản L - Xử lý câu hỏi liên tiếp',
        'Ưu tiên': 7,
        'Email chủ sở hữu': 'admin@example.com'
      },

      // II. KỊCH BẢN XỬ LÝ TỪ CHỐI
      {
        'Từ khóa': 'giá cao|đắt|so với|đối thủ|chỗ khác rẻ hơn',
        'Prompt': 'Khách phàn nàn giá cao so với đối thủ. Nhấn mạnh giá trị, bảo hành và đưa ra nhượng bộ.',
        'Câu trả lời mẫu': '💎 HIỂU BẠN HOÀN TOÀN! Nhưng sản phẩm của shop có BẢO HÀNH 1 NĂM + CAM KẾT CHỐNG XÙ LÔNG vĩnh viễn - đây là giá trị khác biệt! ⭐ NHƯỢNG BỘ ĐẶC BIỆT: Mình xin hỗ trợ thêm 5% cho đơn của bạn. Đây là mức tốt nhất mình có thể làm! Bạn đồng ý chứ?',
        'Thông tin bổ sung': 'Kịch bản H mục III - Phản hồi dựa trên giá trị',
        'Ưu tiên': 9,
        'Email chủ sở hữu': 'admin@example.com'
      },
      {
        'Từ khóa': 'sợ xù lông|lo chất lượng|giặt bị|hư hỏng|rủi ro',
        'Prompt': 'Khách lo lắng về chất lượng, sợ xù lông. Áp dụng cam kết không rủi ro.',
        'Câu trả lời mẫu': '🛡️ CAM KẾT KHÔNG RỦI RO 100%: Nếu sản phẩm bị xù lông, phai màu, co rút trong 6 THÁNG - Shop HOÀN TIỀN 100% + tặng voucher 200k! Đã có 5000+ khách hàng tin tưởng. Bạn hoàn toàn yên tâm nhé!',
        'Thông tin bổ sung': 'Kịch bản I mục III - Cam kết không rủi ro',
        'Ưu tiên': 8,
        'Email chủ sở hữu': 'admin@example.com'
      },
      {
        'Từ khóa': 'hỏi vợ|hỏi chồng|để sau|quay lại|suy nghĩ',
        'Prompt': 'Khách cần hỏi ý kiến người thân, muốn quay lại sau. Tạo tính cấp thiết giả.',
        'Câu trả lời mẫu': '⏰ ƯU ĐÃI GIỚI HẠN THỜI GIAN: Size M chỉ còn 3 chiếc và deal này chỉ còn hiệu lực 2 GIỜ nữa! Mình có thể GIỮ SIZE & ƯU ĐÃI cho bạn nếu bạn cho mình SĐT. NVKD sẽ gọi tư vấn cho cả 2 vợ chồng luôn ạ!',
        'Thông tin bổ sung': 'Kịch bản J mục III - Tạo tính cấp thiết giả',
        'Ưu tiên': 7,
        'Email chủ sở hữu': 'admin@example.com'
      },

      // III. KỊCH BẢN BÀN GIAO & KẾT THÚC
      {
        'Từ khóa': 'tên tôi là|sđt của tôi|số điện thoại|liên hệ',
        'Prompt': 'Khách cung cấp thông tin sau khi chốt đơn. Tóm tắt đơn hàng và bàn giao NVKD.',
        'Câu trả lời mẫu': '🎉 CẢM ƠN BẠN [Tên]! ĐƠN HÀNG ĐÃ ĐƯỢC XÁC NHẬN: 1x [Tên SP] Size M - [Giá] - Freeship. 👨‍💼 BẠN SẼ ĐƯỢC CHĂM SÓC BỞI: Anh [Tên NVKD] - SĐT [SĐT NVKD]. Anh ấy sẽ gọi cho bạn trong 5 PHÚT để xác nhận chi tiết đơn hàng!',
        'Thông tin bổ sung': 'Kịch bản K mục IV - Bàn giao NVKD',
        'Ưu tiên': 6,
        'Email chủ sở hữu': 'admin@example.com'
      },
      {
        'Từ khóa': 'im lặng|không trả lời|ngưng chat|90 giây',
        'Prompt': 'Khách không phản hồi sau 90 giây. Gửi kịch bản theo dõi.',
        'Câu trả lời mẫu': '💬 BẠN ĐÃ TÌM ĐƯỢC THÔNG TIN CẦN THIẾT CHƯA? Mình có thể giúp bạn: 1) So sánh thêm với sản phẩm khác 2) Tư vấn phối đồ 3) Giữ ưu đãi đặc biệt cho bạn! Bạn cần hỗ trợ gì thêm không ạ? 🤗',
        'Thông tin bổ sung': 'Kịch bản L mục IV - Theo dõi sau im lặng',
        'Ưu tiên': 5,
        'Email chủ sở hữu': 'admin@example.com'
      },

      // IV. KỊCH BẢN THÔNG THƯỜNG
      {
        'Từ khóa': 'chào|hello|xin chào|hi|alo',
        'Prompt': 'Khách chào hỏi. Chào lại và hỏi nhu cầu.',
        'Câu trả lời mẫu': '👋 XIN CHÀO BẠN! Rất vui được hỗ trợ bạn tại [Tên shop]! Hôm nay bạn cần tư vấn về sản phẩm nào ạ? Mình có thể giới thiệu những mẫu mới nhất đang được ưa chuộng! 😊',
        'Thông tin bổ sung': 'Kịch bản chào hỏi tiêu chuẩn',
        'Ưu tiên': 3,
        'Email chủ sở hữu': 'admin@example.com'
      },
      {
        'Từ khóa': 'cảm ơn|thanks|cám ơn|thank you',
        'Prompt': 'Khách cảm ơn. Đáp lễ và tiếp tục hỗ trợ.',
        'Câu trả lời mẫu': '❤️ KHÔNG CÓ GÌ ĐÂU Ạ! Rất vui được hỗ trợ bạn. Bạn còn thắc mắc gì về sản phẩm hoặc cần tư vấn thêm không? Mình luôn sẵn sàng hỗ trợ bạn nhé! 😊',
        'Thông tin bổ sung': 'Kịch bản cảm ơn',
        'Ưu tiên': 2,
        'Email chủ sở hữu': 'admin@example.com'
      },
      {
        'Từ khóa': 'tạm biệt|bye|goodbye|bái bai',
        'Prompt': 'Khách tạm biệt. Chào lại và hẹn gặp lại.',
        'Câu trả lời mẫu': '👋 TẠM BIỆT BẠN! Chúc bạn một ngày thật vui vẻ và thành công! Nếu cần hỗ trợ gì thêm, bạn cứ quay lại nhé. Hẹn gặp lại bạn! 💕',
        'Thông tin bổ sung': 'Kịch bản kết thúc',
        'Ưu tiên': 1,
        'Email chủ sở hữu': 'admin@example.com'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Kịch Bản Bán Hàng');
    
    // Thiết lập độ rộng cột
    const colWidths = [
      { wch: 25 }, // Từ khóa
      { wch: 45 }, // Prompt
      { wch: 80 }, // Câu trả lời mẫu
      { wch: 30 }, // Thông tin bổ sung
      { wch: 10 }, // Ưu tiên
      { wch: 25 }, // Email chủ sở hữu
    ];
    worksheet['!cols'] = colWidths;
    
    // Thêm format header
    const header = ['Từ khóa', 'Prompt', 'Câu trả lời mẫu', 'Thông tin bổ sung', 'Ưu tiên', 'Email chủ sở hữu'];
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:F1');
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!worksheet[address]) continue;
      worksheet[address].s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '4F81BD' } },
        alignment: { horizontal: 'center', vertical: 'center' }
      };
    }
    
    // Format cho các hàng theo nhóm kịch bản
    const groups = [
      { start: 1, end: 6, color: 'F2F2F2' },    // Nhóm I: Chốt sale
      { start: 7, end: 9, color: 'FFF2CC' },    // Nhóm II: Xử lý từ chối
      { start: 10, end: 11, color: 'E2EFDA' },  // Nhóm III: Bàn giao
      { start: 12, end: 14, color: 'D9E1F2' },  // Nhóm IV: Thông thường
    ];
    
    groups.forEach(group => {
      for (let R = group.start; R <= group.end; ++R) {
        for (let C = 0; C < 6; ++C) {
          const address = XLSX.utils.encode_cell({ r: R, c: C });
          if (!worksheet[address]) continue;
          if (!worksheet[address].s) worksheet[address].s = {};
          worksheet[address].s.fill = { fgColor: { rgb: group.color } };
        }
      }
    });
    
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    
    return {
      success: true,
      message: 'Export template kịch bản bán hàng thành công',
      data: {
        buffer: buffer,
        fileName: 'keyword_prompt_sales_scenario_template.xlsx'
      }
    };
  } catch (error: any) {
    throw new BadRequestException('Lỗi khi tạo template: ' + error.message);
  }
}

  // Helper methods
  private parseOptionalNumber(value: any): number | undefined {
    if (
      value === null || 
      value === undefined || 
      value === '' || 
      value === '-' ||
      (typeof value === 'string' && value.trim() === '')
    ) {
      return undefined;
    }
    
    if (typeof value === 'number') {
      return value;
    }
    
    const strValue = String(value).trim();
    if (strValue === '') {
      return undefined;
    }
    
    const cleaned = strValue
      .replace(/\s+/g, '')
      .replace(/[^0-9.,-]/g, '')
      .replace(/,/g, '.');
    
    if (cleaned === '') {
      return undefined;
    }
    
    const num = parseFloat(cleaned);
    return isNaN(num) ? undefined : num;
  }

  private formatDate(date: Date): string {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  }

  async getStats(ownerEmail?: string) {
    const where: any = {};
    if (ownerEmail) {
      where.ownerEmail = ownerEmail;
    }

    const total = await this.prisma.keywordPrompt.count({ where });

    const priorityStats = await this.prisma.keywordPrompt.groupBy({
      by: ['priority'],
      where,
      _count: {
        priority: true,
      },
      orderBy: {
        priority: 'desc',
      },
    });

    const latest = await this.prisma.keywordPrompt.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    return {
      success: true,
      data: {
        total,
        priorityStats: priorityStats.map(stat => ({
          priority: stat.priority,
          count: stat._count.priority,
        })),
        latest: latest.map(item => new KeywordPromptResponseDto(item)),
      },
    };
  }

  async getByPriorityRange(minPriority: number, maxPriority: number, ownerEmail?: string) {
    const where: any = {
      priority: {
        gte: minPriority,
        lte: maxPriority,
      },
    };

    if (ownerEmail) {
      where.ownerEmail = ownerEmail;
    }

    const keywordPrompts = await this.prisma.keywordPrompt.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'desc' }
      ],
    });

    return {
      success: true,
      message: 'Lấy keyword prompt theo mức độ ưu tiên thành công',
      data: keywordPrompts.map(item => new KeywordPromptResponseDto(item)),
    };
  }
}