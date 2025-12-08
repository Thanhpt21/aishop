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
        {
          'Từ khóa': 'giới thiệu sản phẩm',
          'Prompt': 'Hãy viết một đoạn giới thiệu ngắn gọn về sản phẩm {{product_name}} với các tính năng: {{features}}. Sản phẩm này phù hợp cho {{target_audience}}.',
          'Câu trả lời mẫu': 'Chào bạn! {{product_name}} là sản phẩm hiện đại với các tính năng: {{features}}. Sản phẩm này hoàn toàn phù hợp với {{target_audience}} nhờ vào thiết kế thông minh và chất lượng vượt trội.',
          'Thông tin bổ sung': 'Dùng cho mục đích marketing sản phẩm mới',
          'Ưu tiên': 10,
          'Email chủ sở hữu': 'admin@example.com'
        },
        {
          'Từ khóa': 'trả lời khách hàng',
          'Prompt': 'Khách hàng hỏi: {{customer_question}}. Hãy trả lời một cách chuyên nghiệp và hữu ích.',
          'Câu trả lời mẫu': 'Cảm ơn bạn đã quan tâm! Về vấn đề {{customer_question}}, chúng tôi xin trả lời như sau: [nội dung trả lời chi tiết]. Nếu bạn cần thêm thông tin, vui lòng liên hệ với chúng tôi.',
          'Thông tin bổ sung': 'Dùng cho bộ phận CSKH',
          'Ưu tiên': 5,
          'Email chủ sở hữu': 'support@example.com'
        }
      ];

      const worksheet = XLSX.utils.json_to_sheet(templateData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
      
      const colWidths = [
        { wch: 20 }, // Từ khóa
        { wch: 40 }, // Prompt
        { wch: 40 }, // Câu trả lời mẫu
        { wch: 30 }, // Thông tin bổ sung
        { wch: 10 }, // Ưu tiên
        { wch: 25 }, // Email chủ sở hữu
      ];
      worksheet['!cols'] = colWidths;
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      return {
        success: true,
        message: 'Export template thành công',
        data: {
          buffer: buffer,
          fileName: 'keyword_prompt_import_template.xlsx'
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