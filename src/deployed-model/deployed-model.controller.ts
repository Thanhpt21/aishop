// src/models/deployed-model.controller.ts
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
import { DeployedModelService } from './deployed-model.service';
import { CreateDeployedModelDto } from './dto/create-deployed-model.dto';
import { UpdateDeployedModelDto } from './dto/update-deployed-model.dto';

@Controller('v1/deployed-models')
export class DeployedModelController {
  constructor(private readonly deployedModelService: DeployedModelService) {}

  @Post()
  async create(@Body() dto: CreateDeployedModelDto) {
    return this.deployedModelService.create(dto);
  }

  @Get()
  async getAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('search') search: string = '',
    @Query('modelType') modelType: string = '',
    @Query('isActive') isActive: string = '',
  ) {
    return this.deployedModelService.getDeployedModels(
      page,
      limit,
      search,
      modelType,
      isActive,
    );
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.deployedModelService.getById(id);
  }

  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDeployedModelDto,
  ) {
    return this.deployedModelService.update(id, dto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.deployedModelService.delete(id);
  }

  @Post(':id/activate')
  async activate(@Param('id') id: string) {
    return this.deployedModelService.activateModel(id);
  }

  @Post(':id/deactivate')
  async deactivate(@Param('id') id: string) {
    return this.deployedModelService.deactivateModel(id);
  }
}