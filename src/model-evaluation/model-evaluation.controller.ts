// src/model-evaluation/model-evaluation.controller.ts
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
import { ModelEvaluationService } from './model-evaluation.service';
import { CreateModelEvaluationDto } from './dto/create-model-evaluation.dto';
import { UpdateModelEvaluationDto } from './dto/update-model-evaluation.dto';

@Controller('v1/model-evaluations')
export class ModelEvaluationController {
  constructor(private readonly modelEvaluationService: ModelEvaluationService) {}

  @Post()
  async create(@Body() dto: CreateModelEvaluationDto) {
    return this.modelEvaluationService.create(dto);
  }

  @Get()
  async getAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('trainingSessionId') trainingSessionId: string = '',
    @Query('minScore') minScore: number = 0,
  ) {
    return this.modelEvaluationService.getModelEvaluations(
      page,
      limit,
      trainingSessionId,
      minScore,
    );
  }

  @Get('training-session/:trainingSessionId')
  async getByTrainingSessionId(@Param('trainingSessionId') trainingSessionId: string) {
    return this.modelEvaluationService.getByTrainingSessionId(trainingSessionId);
  }

  @Get('stats/:trainingSessionId')
  async getStats(@Param('trainingSessionId') trainingSessionId: string) {
    return this.modelEvaluationService.getEvaluationStats(trainingSessionId);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.modelEvaluationService.getById(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateModelEvaluationDto,
  ) {
    return this.modelEvaluationService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.modelEvaluationService.delete(id);
  }
}