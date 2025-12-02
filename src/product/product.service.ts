import { Injectable, BadRequestException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductResponseDto } from './dto/product-response.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as XLSX from 'xlsx';

@Injectable()
export class ProductService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateProductDto) {
    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        price: dto.price,
        weight: dto.weight ?? null,
        length: dto.length ?? null,
        width: dto.width ?? null,
        height: dto.height ?? null,
        category: dto.category ?? null,
        brand: dto.brand ?? null,
        isActive: dto.isActive ?? true,
      },
    });

    return {
      success: true,
      message: 'Tạo sản phẩm thành công',
      data: new ProductResponseDto(product),
    };
  }

  async getProducts(
    page = 1, 
    limit = 10, 
    search = '', 
    category = '', 
    brand = '', 
    isActive = '',
    minPrice?: number,
    maxPrice?: number
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (brand) {
      where.brand = brand;
    }

    if (isActive !== '') {
      where.isActive = isActive === 'true';
    }

    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      success: true,
      message: 'Lấy danh sách sản phẩm thành công',
      data: {
        data: products.map(product => new ProductResponseDto(product)),
        total,
        page,
        pageCount: Math.ceil(total / limit),
      },
    };
  }

  async getAllProducts(search = '', category = '', brand = '', isActive = '') {
    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (brand) {
      where.brand = brand;
    }

    if (isActive !== '') {
      where.isActive = isActive === 'true';
    }

    const products = await this.prisma.product.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return {
      success: true,
      message: 'Lấy tất cả sản phẩm thành công',
      data: products.map(product => new ProductResponseDto(product)),
    };
  }

  async getById(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });
    
    if (!product) {
      return { success: false, message: 'Sản phẩm không tồn tại' };
    }
    
    return { 
      success: true, 
      data: new ProductResponseDto(product) 
    };
  }

  async update(id: string, dto: UpdateProductDto) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });
    
    if (!product) {
      return { success: false, message: 'Sản phẩm không tồn tại' };
    }

    const updated = await this.prisma.product.update({
      where: { id },
      data: {
        name: dto.name ?? product.name,
        description: dto.description ?? product.description,
        price: dto.price ?? product.price,
        weight: dto.weight ?? product.weight,
        length: dto.length ?? product.length,
        width: dto.width ?? product.width,
        height: dto.height ?? product.height,
        category: dto.category ?? product.category,
        brand: dto.brand ?? product.brand,
        isActive: dto.isActive ?? product.isActive,
      },
    });

    return {
      success: true,
      message: 'Cập nhật sản phẩm thành công',
      data: new ProductResponseDto(updated),
    };
  }

  async delete(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
    });
    
    if (!product) {
      return { success: false, message: 'Sản phẩm không tồn tại' };
    }

    await this.prisma.product.delete({ where: { id } });
    
    return { 
      success: true, 
      message: 'Xóa sản phẩm thành công' 
    };
  }

  async importProducts(file: Express.Multer.File) {
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

    // Lấy tất cả sản phẩm hiện có để check trùng
    const existingProducts = await this.prisma.product.findMany({
      select: { name: true }
    });
    const existingNames = new Set(existingProducts.map(product => product.name.toLowerCase().trim()));

    for (const [index, row] of data.entries()) {
      try {
        const rowData = row as Record<string, any>;
        

        // Map Excel columns to Product data - DÙNG ĐÚNG TÊN CỘT NHƯ EXCEL
       const productData: CreateProductDto = {
        name: String(rowData['Tên sản phẩm'] || '').trim(),
        description: rowData['Mô tả'] ? String(rowData['Mô tả']).trim() : undefined,
        price: this.parseNumber(rowData['Giá'] || 0),
        // SỬA QUAN TRỌNG: Dùng đúng tên cột từ Excel
        weight: this.parseOptionalNumber(rowData['Cân nặng (kg)']),
        length: this.parseOptionalNumber(rowData['Chiều dài (cm)']),
        width: this.parseOptionalNumber(rowData['Chiều rộng (cm)']),
        height: this.parseOptionalNumber(rowData['Chiều cao (cm)']),
        category: rowData['Danh mục'] ? String(rowData['Danh mục']).trim() : undefined,
        brand: rowData['Thương hiệu'] ? String(rowData['Thương hiệu']).trim() : undefined,
        isActive: rowData['Trạng thái'] ? 
          String(rowData['Trạng thái']).toString().toLowerCase() === 'true' : true,
      };

        // Validate required fields
        if (!productData.name) {
          throw new Error('Tên sản phẩm là bắt buộc');
        }
        if (productData.price === undefined || productData.price < 0) {
          throw new Error('Giá sản phẩm không hợp lệ');
        }

        // Check trùng tên sản phẩm (case insensitive)
        const normalizedName = productData.name.toLowerCase().trim();
        if (existingNames.has(normalizedName)) {
          throw new Error('Tên sản phẩm đã tồn tại trong hệ thống');
        }

        // Create product
        const createdProduct = await this.prisma.product.create({
          data: {
            name: productData.name,
            description: productData.description,
            price: productData.price,
            weight: productData.weight,
            length: productData.length,
            width: productData.width,
            height: productData.height,
            category: productData.category,
            brand: productData.brand,
            isActive: productData.isActive,
          }
        });


        // Thêm vào set để tránh trùng trong cùng 1 file import
        existingNames.add(normalizedName);
        
        results.success++;
        results.details.push({
          row: index + 2,
          name: productData.name.substring(0, 50) + (productData.name.length > 50 ? '...' : ''),
          status: 'SUCCESS',
          message: 'Thành công'
        });

      } catch (error: any) {
        console.error('ERROR in row', index + 2, ':', error.message);
        const rowNumber = index + 2;
        const errorMessage = `Dòng ${rowNumber}: ${error.message}`;
        
        results.errors.push(errorMessage);
        results.details.push({
          row: rowNumber,
          name: String((row as any)?.['Tên sản phẩm'] || (row as any)?.['name'] || 'N/A').substring(0, 50),
          status: 'ERROR',
          message: error.message
        });
      }
    }

    return {
      success: true,
      message: `Import hoàn tất: ${results.success}/${results.total} sản phẩm thành công`,
      data: results
    };

  } catch (error: any) {
    throw new BadRequestException('Lỗi khi xử lý file Excel: ' + error.message);
  }
}



  async exportProducts() {
    try {
      // Lấy tất cả sản phẩm từ database
      const products = await this.prisma.product.findMany({
        orderBy: { createdAt: 'desc' }
      });

      // Format data để export
      const exportData = products.map(product => ({
        'Tên sản phẩm': product.name,
        'Mô tả': product.description || '',
        'Giá': product.price,
        'Cân nặng (kg)': product.weight || '',
        'Chiều dài (cm)': product.length || '',
        'Chiều rộng (cm)': product.width || '',
        'Chiều cao (cm)': product.height || '',
        'Danh mục': product.category || '',
        'Thương hiệu': product.brand || '',
        'Trạng thái': product.isActive ? 'ACTIVE' : 'INACTIVE',
        'Ngày tạo': this.formatDate(product.createdAt),
        'Ngày cập nhật': this.formatDate(product.updatedAt)
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');
      
      // Auto-size columns
      const colWidths = [
        { wch: 30 }, // Tên sản phẩm
        { wch: 40 }, // Mô tả
        { wch: 15 }, // Giá
        { wch: 15 }, // Cân nặng
        { wch: 15 }, // Chiều dài
        { wch: 15 }, // Chiều rộng
        { wch: 15 }, // Chiều cao
        { wch: 20 }, // Danh mục
        { wch: 20 }, // Thương hiệu
        { wch: 12 }, // Trạng thái
        { wch: 15 }, // Ngày tạo
        { wch: 15 }, // Ngày cập nhật
      ];
      worksheet['!cols'] = colWidths;
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      return {
        success: true,
        message: 'Export danh sách sản phẩm thành công',
        data: {
          buffer: buffer,
          fileName: `products_export_${new Date().toISOString().split('T')[0]}.xlsx`
        }
      };
    } catch (error) {
      throw new BadRequestException('Lỗi khi export danh sách sản phẩm: ' + error.message);
    }
  }

  async exportTemplate() {
    try {
      const templateData = [
        {
          'Tên sản phẩm': 'Áo thun nam cổ tròn',
          'Mô tả': 'Áo thun nam chất cotton, thoáng mát',
          'Giá': 150000,
          'Cân nặng (kg)': 0.2,
          'Chiều dài (cm)': 70,
          'Chiều rộng (cm)': 50,
          'Chiều cao (cm)': 1,
          'Danh mục': 'Áo thun',
          'Thương hiệu': 'Brand A',
          'Trạng thái': 'true'
        },
        {
          'Tên sản phẩm': 'Quần jean nam',
          'Mô tả': 'Quần jean nam form slim',
          'Giá': 350000,
          'Cân nặng (kg)': 0.5,
          'Chiều dài (cm)': 105,
          'Chiều rộng (cm)': 40,
          'Chiều cao (cm)': 2,
          'Danh mục': 'Quần jean',
          'Thương hiệu': 'Brand B',
          'Trạng thái': 'true'
        }
      ];

      const worksheet = XLSX.utils.json_to_sheet(templateData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Template');
      
      // Auto-size columns
      const colWidths = [
        { wch: 25 }, { wch: 30 }, { wch: 10 }, { wch: 12 }, 
        { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 15 },
        { wch: 15 }, { wch: 10 }
      ];
      worksheet['!cols'] = colWidths;
      
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
      
      return {
        success: true,
        message: 'Export template thành công',
        data: {
          buffer: buffer,
          fileName: 'product_import_template.xlsx'
        }
      };
    } catch (error) {
      throw new BadRequestException('Lỗi khi tạo template: ' + error.message);
    }
  }

  // Helper methods
  private parseNumber(value: any): number {
    if (value === null || value === undefined || value === '') return 0;
    
    const strValue = String(value);
    
    const cleaned = strValue
      .replace(/\s+/g, '')
      .replace(/[^0-9.,-]/g, '')
      .replace(/,/g, '.');
    
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

private parseOptionalNumber(value: any): number | undefined {
  // Debug log
  console.log('parseOptionalNumber input:', value, 'type:', typeof value);
  
  // Kiểm tra nhiều trường hợp
  if (
    value === null || 
    value === undefined || 
    value === '' || 
    value === '-' ||
    value === 'N/A' ||
    value === 'n/a' ||
    value === 'NA' ||
    value === 'na' ||
    (typeof value === 'string' && value.trim() === '')
  ) {
    console.log('parseOptionalNumber returning undefined for value:', value);
    return undefined;
  }
  
  // Nếu là boolean, trả về undefined
  if (typeof value === 'boolean') {
    return undefined;
  }
  
  // Nếu là số, trả về luôn
  if (typeof value === 'number') {
    return value;
  }
  
  // Xử lý string
  const strValue = String(value).trim();
  
  // Nếu string rỗng sau khi trim
  if (strValue === '') {
    return undefined;
  }
  
  // Loại bỏ khoảng trắng và ký tự đặc biệt
  const cleaned = strValue
    .replace(/\s+/g, '') // Xóa khoảng trắng
    .replace(/[^0-9.,-]/g, '') // Chỉ giữ số, dấu chấm, phẩy, trừ
    .replace(/,/g, '.'); // Chuyển dấu phẩy thành dấu chấm
  
  
  // Nếu cleaned rỗng
  if (cleaned === '') {
    return undefined;
  }
  
  const num = parseFloat(cleaned);
  const result = isNaN(num) ? undefined : num;
  return result;
}

  private formatDate(date: Date): string {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  }
}