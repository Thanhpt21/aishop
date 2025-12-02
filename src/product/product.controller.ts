// src/product/product.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseInterceptors,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductService } from './product.service';
import { Response } from 'express';

@Controller('v1/products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  async create(@Body() dto: CreateProductDto) {
    return this.productService.create(dto);
  }

  @Get()
  async getAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search: string = '',
    @Query('category') category: string = '',
    @Query('brand') brand: string = '',
    @Query('isActive') isActive: string = '',
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
  ) {
    return this.productService.getProducts(
      page, 
      limit, 
      search, 
      category, 
      brand, 
      isActive,
      minPrice,
      maxPrice
    );
  }

  @Get('all')
  async getAllWithoutPagination(
    @Query('search') search: string = '',
    @Query('category') category: string = '',
    @Query('brand') brand: string = '',
    @Query('isActive') isActive: string = '',
  ) {
    return this.productService.getAllProducts(search, category, brand, isActive);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.productService.getById(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.productService.delete(id);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async import(@UploadedFile() file: Express.Multer.File) {
    return this.productService.importProducts(file);
  }

  @Get('export/excel')
  async export(@Res() res: Response) {
    const result = await this.productService.exportProducts();
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${result.data.fileName}`);
    res.send(result.data.buffer);
  }

  @Get('export/template')
  async exportTemplate(@Res() res: Response) {
    const result = await this.productService.exportTemplate();
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${result.data.fileName}`);
    res.send(result.data.buffer);
  }
}