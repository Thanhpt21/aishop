// src/training-config/training-config.controller.ts
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
import { TrainingConfigService } from './training-config.service';
import { CreateTrainingConfigDto } from './dto/create-training-config.dto';
import { UpdateTrainingConfigDto } from './dto/update-training-config.dto';

@Controller('v1/training-configs')
export class TrainingConfigController {
  constructor(private readonly trainingConfigService: TrainingConfigService) {}

  @Post()
  async create(@Body() dto: CreateTrainingConfigDto) {
    return this.trainingConfigService.create(dto);
  }

  @Get()
  async getAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search: string = '',
    @Query('modelType') modelType: string = '',
  ) {
    return this.trainingConfigService.getTrainingConfigs(
      page,
      limit,
      search,
      modelType,
    );
  }

  @Get('name/:name')
  async getByName(@Param('name') name: string) {
    return this.trainingConfigService.getByName(name);
  }

  @Get('model-type/:modelType')
  async getByModelType(@Param('modelType') modelType: string) {
    return this.trainingConfigService.getConfigByModelType(modelType);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.trainingConfigService.getById(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTrainingConfigDto,
  ) {
    return this.trainingConfigService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.trainingConfigService.delete(id);
  }

  @Post(':id/duplicate')
  async duplicate(
    @Param('id') id: string,
    @Body('newName') newName: string,
  ) {
    return this.trainingConfigService.duplicateConfig(id, newName);
  }
}