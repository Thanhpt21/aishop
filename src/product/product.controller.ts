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
  UseGuards,
  Req,
  UploadedFile,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ProductService } from './product.service';
import { Response } from 'express';

@Controller('v1/products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateProductDto, @Req() req: any) {
    const ownerEmail = req.user?.email;
    return this.productService.create(dto, ownerEmail);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getAll(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search: string = '',
    @Query('category') category: string = '',
    @Query('brand') brand: string = '',
    @Query('isActive') isActive: string = '',
    @Query('minPrice') minPrice?: number,
    @Query('maxPrice') maxPrice?: number,
  ) {
    const ownerEmail = req.user?.email;
    return this.productService.getProducts(
      page, 
      limit, 
      search, 
      category, 
      brand, 
      isActive,
      minPrice,
      maxPrice,
      ownerEmail
    );
  }

  @Get('all')
  @UseGuards(JwtAuthGuard)
  async getAllWithoutPagination(
    @Req() req: any,
    @Query('search') search: string = '',
    @Query('category') category: string = '',
    @Query('brand') brand: string = '',
    @Query('isActive') isActive: string = '',
  ) {
    const ownerEmail = req.user?.email;
    return this.productService.getAllProducts(search, category, brand, isActive, ownerEmail);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getById(@Param('id') id: string, @Req() req: any) {
    const ownerEmail = req.user?.email;
    return this.productService.getById(id, ownerEmail);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProductDto,
    @Req() req: any
  ) {
    const ownerEmail = req.user?.email;
    return this.productService.update(id, dto, ownerEmail);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id') id: string, @Req() req: any) {
    const ownerEmail = req.user?.email;
    return this.productService.delete(id, ownerEmail);
  }

  @Post('import')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async import(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    const ownerEmail = req.user?.email;
    return this.productService.importProducts(file, ownerEmail);
  }

  @Get('export/excel')
  @UseGuards(JwtAuthGuard)
  async export(@Res() res: Response, @Req() req: any) {
    const ownerEmail = req.user?.email;
    const result = await this.productService.exportProducts(ownerEmail);
    
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