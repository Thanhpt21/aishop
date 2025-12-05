import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateExampleQADto } from './dto/create-example-qa.dto';
import { UpdateExampleQADto } from './dto/update-example-qa.dto';
import { ExampleQAResponseDto } from './dto/example-qa-response.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as XLSX from 'xlsx';

@Injectable()
export class ExampleQAService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateExampleQADto, userEmail?: string) {
    // Sử dụng ownerEmail từ DTO hoặc từ user hiện tại
    const finalOwnerEmail = dto.ownerEmail || userEmail || null;

    const exampleQA = await this.prisma.exampleQA.create({
      data: {
        question: dto.question,
        answer: dto.answer,
        intent: dto.intent ?? null,
        category: dto.category ?? null,
        language: dto.language ?? 'vi',
        isActive: dto.isActive ?? true,
        tags: dto.tags ?? [],
        ownerEmail: finalOwnerEmail, // Thêm ownerEmail
      },
    });

    return {
      success: true,
      message: 'Tạo câu hỏi mẫu thành công',
      data: new ExampleQAResponseDto(exampleQA),
    };
  }

  async getExampleQAs(
    page = 1, 
    limit = 10, 
    search = '', 
    intent = '', 
    category = '', 
    isActive = '',
    ownerEmail?: string // Thêm tham số ownerEmail
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { question: { contains: search, mode: 'insensitive' } },
        { answer: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (intent) {
      where.intent = intent;
    }

    if (category) {
      where.category = category;
    }

    if (isActive !== '') {
      where.isActive = isActive === 'true';
    }

    // 🆕 Lọc theo ownerEmail nếu có
    if (ownerEmail) {
      where.ownerEmail = ownerEmail;
    }

    const [exampleQAs, total] = await this.prisma.$transaction([
      this.prisma.exampleQA.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.exampleQA.count({ where }),
    ]);

    return {
      success: true,
      message: 'Lấy danh sách câu hỏi mẫu thành công',
      data: {
        data: exampleQAs.map(qa => new ExampleQAResponseDto(qa)),
        total,
        page,
        pageCount: Math.ceil(total / limit),
      },
    };
  }

  async getAllExampleQAs(
    search = '', 
    intent = '', 
    category = '', 
    isActive = '',
    ownerEmail?: string // Thêm tham số ownerEmail
  ) {
    const where: any = {};

    if (search) {
      where.OR = [
        { question: { contains: search, mode: 'insensitive' } },
        { answer: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (intent) {
      where.intent = intent;
    }

    if (category) {
      where.category = category;
    }

    if (isActive !== '') {
      where.isActive = isActive === 'true';
    }

    // 🆕 Lọc theo ownerEmail nếu có
    if (ownerEmail) {
      where.ownerEmail = ownerEmail;
    }

    const exampleQAs = await this.prisma.exampleQA.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      message: 'Lấy tất cả câu hỏi mẫu thành công',
      data: exampleQAs.map(qa => new ExampleQAResponseDto(qa)),
    };
  }

  async getById(id: string, ownerEmail?: string) {
    const where: any = { id };
    
    // 🆕 Kiểm tra ownerEmail nếu có
    if (ownerEmail) {
      where.ownerEmail = ownerEmail;
    }

    const exampleQA = await this.prisma.exampleQA.findUnique({
      where,
    });
    
    if (!exampleQA) {
      return { success: false, message: 'Câu hỏi mẫu không tồn tại' };
    }
    
    return { 
      success: true, 
      data: new ExampleQAResponseDto(exampleQA) 
    };
  }

  async update(id: string, dto: UpdateExampleQADto, ownerEmail?: string) {
    const where: any = { id };
    
    // 🆕 Kiểm tra ownerEmail nếu có
    if (ownerEmail) {
      where.ownerEmail = ownerEmail;
    }

    const exampleQA = await this.prisma.exampleQA.findUnique({
      where,
    });
    
    if (!exampleQA) {
      return { success: false, message: 'Câu hỏi mẫu không tồn tại' };
    }

    const updated = await this.prisma.exampleQA.update({
      where: { id },
      data: {
        question: dto.question ?? exampleQA.question,
        answer: dto.answer ?? exampleQA.answer,
        intent: dto.intent ?? exampleQA.intent,
        category: dto.category ?? exampleQA.category,
        language: dto.language ?? exampleQA.language,
        isActive: dto.isActive ?? exampleQA.isActive,
        tags: dto.tags ?? exampleQA.tags,
        ownerEmail: dto.ownerEmail ?? exampleQA.ownerEmail, // Cập nhật ownerEmail
      },
    });

    return {
      success: true,
      message: 'Cập nhật câu hỏi mẫu thành công',
      data: new ExampleQAResponseDto(updated),
    };
  }

  async delete(id: string, ownerEmail?: string) {
    const where: any = { id };
    
    // 🆕 Kiểm tra ownerEmail nếu có
    if (ownerEmail) {
      where.ownerEmail = ownerEmail;
    }

    const exampleQA = await this.prisma.exampleQA.findUnique({
      where,
    });
    
    if (!exampleQA) {
      return { success: false, message: 'Câu hỏi mẫu không tồn tại' };
    }

    await this.prisma.exampleQA.delete({ where: { id } });
    
    return { 
      success: true, 
      message: 'Xóa câu hỏi mẫu thành công' 
    };
  }

  async importExampleQAs(file: Express.Multer.File, userEmail?: string) {
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

      // Lấy tất cả câu hỏi hiện có để check trùng
      const where: any = {};
      if (userEmail) {
        where.ownerEmail = userEmail; // Chỉ kiểm tra trùng trong cùng owner
      }

      const existingQAs = await this.prisma.exampleQA.findMany({
        where,
        select: { question: true }
      });
      const existingQuestions = new Set(existingQAs.map(qa => qa.question.toLowerCase().trim()));

      for (const [index, row] of data.entries()) {
        try {
          const rowData = row as Record<string, any>;
          
          // Map Excel columns to ExampleQA data
          const exampleQAData: CreateExampleQADto = {
            question: String(rowData['Câu hỏi'] || rowData['question'] || '').trim(),
            answer: String(rowData['Câu trả lời'] || rowData['answer'] || '').trim(),
            intent: rowData['Mục đích'] || rowData['intent'] ? String(rowData['Mục đích'] || rowData['intent']).trim() : undefined,
            category: rowData['Danh mục'] || rowData['category'] ? String(rowData['Danh mục'] || rowData['category']).trim() : undefined,
            language: rowData['Ngôn ngữ'] || rowData['language'] ? String(rowData['Ngôn ngữ'] || rowData['language']).trim() : 'vi',
            isActive: rowData['Trạng thái'] || rowData['isActive'] !== undefined ? 
              String(rowData['Trạng thái'] || rowData['isActive']).toString().toLowerCase() === 'true' : true,
            tags: rowData['Tags'] || rowData['tags'] ? 
              String(rowData['Tags'] || rowData['tags']).split(',').map((tag: string) => tag.trim()).filter(tag => tag !== '') : [],
            ownerEmail: rowData['Owner Email'] || rowData['ownerEmail'] ? 
              String(rowData['Owner Email'] || rowData['ownerEmail']).trim() : userEmail || undefined
          };

          // Validate required fields
          if (!exampleQAData.question) {
            throw new Error('Câu hỏi là bắt buộc');
          }
          if (!exampleQAData.answer) {
            throw new Error('Câu trả lời là bắt buộc');
          }

          // Check trùng câu hỏi (case insensitive) - chỉ trong cùng owner
          const normalizedQuestion = exampleQAData.question.toLowerCase().trim();
          if (existingQuestions.has(normalizedQuestion)) {
            throw new Error('Câu hỏi đã tồn tại trong hệ thống');
          }

          // Create example QA
          await this.prisma.exampleQA.create({
            data: {
              question: exampleQAData.question,
              answer: exampleQAData.answer,
              intent: exampleQAData.intent,
              category: exampleQAData.category,
              language: exampleQAData.language,
              isActive: exampleQAData.isActive,
              tags: exampleQAData.tags,
              ownerEmail: exampleQAData.ownerEmail, // Lưu ownerEmail
            }
          });

          // Thêm vào set để tránh trùng trong cùng 1 file import
          existingQuestions.add(normalizedQuestion);
          
          results.success++;
          results.details.push({
            row: index + 2,
            question: exampleQAData.question.substring(0, 50) + (exampleQAData.question.length > 50 ? '...' : ''),
            status: 'SUCCESS',
            message: 'Thành công'
          });

        } catch (error: any) {
          const rowNumber = index + 2;
          const errorMessage = `Dòng ${rowNumber}: ${error.message}`;
          
          results.errors.push(errorMessage);
          results.details.push({
            row: rowNumber,
            question: String((row as any)?.['Câu hỏi'] || (row as any)?.['question'] || 'N/A').substring(0, 50),
            status: 'ERROR',
            message: error.message
          });
        }
      }

      return {
        success: true,
        message: `Import hoàn tất: ${results.success}/${results.total} bản ghi thành công`,
        data: results
      };

    } catch (error: any) {
      throw new BadRequestException('Lỗi khi xử lý file Excel: ' + error.message);
    }
  }

  async exportExampleQAs(ownerEmail?: string) {
    try {
      const where: any = {};
      if (ownerEmail) {
        where.ownerEmail = ownerEmail; // Lọc theo ownerEmail
      }

      // Lấy tất cả example QAs từ database
      const exampleQAs = await this.prisma.exampleQA.findMany({
        where,
        orderBy: { createdAt: 'desc' }
      });

      // Format data để export
      const exportData = exampleQAs.map(qa => ({
        'Câu hỏi': qa.question,
        'Câu trả lời': qa.answer,
        'Mục đích': qa.intent || '',
        'Danh mục': qa.category || '',
        'Ngôn ngữ': qa.language,
        'Tags': qa.tags.join(', '),
        'Owner Email': qa.ownerEmail || '', // Thêm cột Owner Email
        'Trạng thái': qa.isActive ? 'ACTIVE' : 'INACTIVE',
        'Ngày tạo': this.formatDate(qa.createdAt),
        'Ngày cập nhật': this.formatDate(qa.updatedAt)
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'ExampleQAs');
      
      // Auto-size columns
      const colWidths = [
        { wch: 50 }, // Câu hỏi
        { wch: 50 }, // Câu trả lời
        { wch: 20 }, // Mục đích
        { wch: 20 }, // Danh mục
        { wch: 10 }, // Ngôn ngữ
        { wch: 30 }, // Tags
        { wch: 25 }, // Owner Email (mới)
        { wch: 12 }, // Trạng thái
        { wch: 15 }, // Ngày tạo
        { wch: 15 }, // Ngày cập nhật
      ];
      worksheet['!cols'] = colWidths;
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      return {
        success: true,
        message: 'Export danh sách câu hỏi mẫu thành công',
        data: {
          buffer: buffer,
          fileName: `example_qa_export_${new Date().toISOString().split('T')[0]}.xlsx`
        }
      };
    } catch (error) {
      throw new BadRequestException('Lỗi khi export danh sách câu hỏi mẫu: ' + error.message);
    }
  }

  async exportTemplate() {
    try {
      const templateData = [
        {
          'Câu hỏi': 'Xin chào, bạn có khỏe không?',
          'Câu trả lời': 'Cảm ơn bạn, tôi khỏe. Còn bạn thì sao?',
          'Mục đích': 'chào_hỏi',
          'Danh mục': 'giao_tiếp',
          'Ngôn ngữ': 'vi',
          'Tags': 'chào hỏi, sức khỏe',
          'Owner Email': 'admin@example.com', // Thêm cột mẫu
          'Trạng thái': 'true'
        },
        {
          'Câu hỏi': 'Giờ làm việc của công ty từ mấy giờ?',
          'Câu trả lời': 'Giờ làm việc của công ty là từ 8:00 đến 17:00 từ thứ 2 đến thứ 6.',
          'Mục đích': 'hỏi_giờ_làm_việc',
          'Danh mục': 'thông_tin_công_ty',
          'Ngôn ngữ': 'vi',
          'Tags': 'giờ làm, công ty',
          'Owner Email': 'admin@example.com', // Thêm cột mẫu
          'Trạng thái': 'true'
        }
      ];

      const worksheet = XLSX.utils.json_to_sheet(templateData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
      
      // Auto-size columns
      const colWidths = [
        { wch: 40 }, { wch: 40 }, { wch: 20 }, { wch: 20 }, 
        { wch: 10 }, { wch: 20 }, { wch: 25 }, { wch: 12 } // Thêm cột Owner Email
      ];
      worksheet['!cols'] = colWidths;
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      return {
        success: true,
        message: 'Export template thành công',
        data: {
          buffer: buffer,
          fileName: 'example_qa_import_template.xlsx'
        }
      };
    } catch (error) {
      throw new BadRequestException('Lỗi khi tạo template: ' + error.message);
    }
  }

  // Helper method để format date
  private formatDate(date: Date): string {
    if (!date) return '';
    return date.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  }

}