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
import { CreateExampleQADto } from './dto/create-example-qa.dto';
import { UpdateExampleQADto } from './dto/update-example-qa.dto';
import { ExampleQAService } from './example-qa.service';
import { Response } from 'express';

@Controller('v1/example-qa')
export class ExampleQAController {
  constructor(private readonly exampleQAService: ExampleQAService) {}

  @Post()
  async create(@Body() dto: CreateExampleQADto) {
    return this.exampleQAService.create(dto);
  }

  @Get()
  async getAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search: string = '',
    @Query('intent') intent: string = '',
    @Query('category') category: string = '',
    @Query('isActive') isActive: string = '',
  ) {
    return this.exampleQAService.getExampleQAs(page, limit, search, intent, category, isActive);
  }

  @Get('all')
  async getAllWithoutPagination(
    @Query('search') search: string = '',
    @Query('intent') intent: string = '',
    @Query('category') category: string = '',
    @Query('isActive') isActive: string = '',
  ) {
    return this.exampleQAService.getAllExampleQAs(search, intent, category, isActive);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.exampleQAService.getById(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateExampleQADto,
  ) {
    return this.exampleQAService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.exampleQAService.delete(id);
  }

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async import(@UploadedFile() file: Express.Multer.File) {
    return this.exampleQAService.importExampleQAs(file);
  }

  @Get('export/excel')
  async export(@Res() res: Response) {
    const result = await this.exampleQAService.exportExampleQAs();
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${result.data.fileName}`);
    res.send(result.data.buffer);
  }

  @Get('export/template')
  async exportTemplate(@Res() res: Response) {
    const result = await this.exampleQAService.exportTemplate();
    
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${result.data.fileName}`);
    res.send(result.data.buffer);
  }
}