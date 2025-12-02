// src/training/training-session.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CreateTrainingSessionDto } from './dto/create-training-session.dto';
import { UpdateTrainingSessionDto } from './dto/update-training-session.dto';
import { TrainingSessionService } from './training-session.service';


@Controller('v1/training-sessions')
export class TrainingSessionController {
  constructor(private readonly trainingSessionService: TrainingSessionService) {}

  @Post()
  async create(@Body() dto: CreateTrainingSessionDto) {
    return this.trainingSessionService.create(dto);
  }

  @Get()
  async getAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search: string = '',
    @Query('status') status: string = '',
  ) {
    return this.trainingSessionService.getTrainingSessions(page, limit, search, status);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.trainingSessionService.getById(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateTrainingSessionDto,
  ) {
    return this.trainingSessionService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.trainingSessionService.delete(id);
  }

  @Post(':id/start')
  async startTraining(@Param('id') id: string) {
    return this.trainingSessionService.startTraining(id);
  }

  @Post(':id/cancel')
  async cancelTraining(@Param('id') id: string) {
    return this.trainingSessionService.cancelTraining(id);
  }
}