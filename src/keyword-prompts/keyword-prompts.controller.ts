// src/keyword-prompts/keyword-prompts.controller.ts
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
  ParseIntPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateKeywordPromptDto } from './dto/create-keyword-prompt.dto';
import { UpdateKeywordPromptDto } from './dto/update-keyword-prompt.dto';
import { KeywordPromptsService } from './keyword-prompts.service';
import { Response } from 'express';

@Controller('v1/keyword-prompts')
export class KeywordPromptsController {
  constructor(private readonly keywordPromptsService: KeywordPromptsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateKeywordPromptDto, @Req() req: any) {
    const ownerEmail = req.user?.email;
    return this.keywordPromptsService.create(dto, ownerEmail);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getAll(
    @Req() req: any,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search: string = '',
    @Query('minPriority') minPriority?: number,
    @Query('maxPriority') maxPriority?: number,
  ) {
    const ownerEmail = req.user?.email;
    return this.keywordPromptsService.findAll(
      page, 
      limit, 
      search, 
      minPriority,
      maxPriority,
      ownerEmail
    );
  }

  @Get('search')
  @UseGuards(JwtAuthGuard)
  async searchByKeyword(
    @Query('keyword') keyword: string,
    @Req() req: any
  ) {
    const ownerEmail = req.user?.email;
    return this.keywordPromptsService.findByKeyword(keyword, ownerEmail);
  }

  @Get('priority-range')
  @UseGuards(JwtAuthGuard)
  async getByPriorityRange(
    @Query('min') minPriority: number,
    @Query('max') maxPriority: number,
    @Req() req: any
  ) {
    const ownerEmail = req.user?.email;
    return this.keywordPromptsService.getByPriorityRange(minPriority, maxPriority, ownerEmail);
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getStats(@Req() req: any) {
    const ownerEmail = req.user?.email;
    return this.keywordPromptsService.getStats(ownerEmail);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getById(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const ownerEmail = req.user?.email;
    return this.keywordPromptsService.findOne(id, ownerEmail);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateKeywordPromptDto,
    @Req() req: any
  ) {
    const ownerEmail = req.user?.email;
    return this.keywordPromptsService.update(id, dto, ownerEmail);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async delete(@Param('id', ParseIntPipe) id: number, @Req() req: any) {
    const ownerEmail = req.user?.email;
    return this.keywordPromptsService.remove(id, ownerEmail);
  }

  @Post('import')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async import(@UploadedFile() file: Express.Multer.File, @Req() req: any) {
    const ownerEmail = req.user?.email;
    return this.keywordPromptsService.importKeywordPrompts(file, ownerEmail);
  }

  @Get('export/excel')
  @UseGuards(JwtAuthGuard)
  async export(@Res() res: Response, @Req() req: any) {
    const ownerEmail = req.user?.email;
    const result = await this.keywordPromptsService.exportKeywordPrompts(ownerEmail);
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${result.data.fileName}`);
    res.send(result.data.buffer);
  }

  @Get('export/template')
  async exportTemplate(@Res() res: Response) {
    const result = await this.keywordPromptsService.exportTemplate();
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${result.data.fileName}`);
    res.send(result.data.buffer);
  }
}