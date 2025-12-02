// src/training-data/training-data.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { TrainingDataService } from './training-data.service';
import { CreateTrainingDataDto } from './dto/create-training-data.dto';
import { UpdateTrainingDataDto } from './dto/update-training-data.dto';

@Controller('v1/training-data')
export class TrainingDataController {
  constructor(private readonly trainingDataService: TrainingDataService) {}

  @Post()
  async create(@Body() dto: CreateTrainingDataDto) {
    return this.trainingDataService.create(dto);
  }

  @Get()
  async getAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search: string = '',
    @Query('category') category: string = '',
    @Query('intent') intent: string = '',
    @Query('trainingSessionId') trainingSessionId: string = '',
  ) {
    return this.trainingDataService.getTrainingData(
      page,
      limit,
      search,
      category,
      intent,
      trainingSessionId,
    );
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.trainingDataService.getById(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTrainingDataDto,
  ) {
    return this.trainingDataService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.trainingDataService.delete(id);
  }

  @Post(':id/verify')
  async verify(
    @Param('id') id: string,
    @Body('verifiedBy') verifiedBy: string,
  ) {
    return this.trainingDataService.verifyData(id, verifiedBy);
  }
}