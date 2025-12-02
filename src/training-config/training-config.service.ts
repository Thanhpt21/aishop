// src/training-config/training-config.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTrainingConfigDto } from './dto/create-training-config.dto';
import { UpdateTrainingConfigDto } from './dto/update-training-config.dto';
import { TrainingConfigResponseDto } from './dto/training-config-response.dto';

@Injectable()
export class TrainingConfigService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTrainingConfigDto) {
    // Check if config with same name already exists
    const existing = await this.prisma.trainingConfig.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      return { 
        success: false, 
        message: 'Training config với tên này đã tồn tại' 
      };
    }

    const trainingConfig = await this.prisma.trainingConfig.create({
      data: {
        name: dto.name,
        modelType: dto.modelType,
        parameters: dto.parameters,
        preprocessingSteps: dto.preprocessingSteps ?? null,
        features: dto.features ?? null,
      },
    });

    return {
      success: true,
      message: 'Tạo training config thành công',
      data: new TrainingConfigResponseDto(trainingConfig),
    };
  }

  async getTrainingConfigs(
    page = 1, 
    limit = 10, 
    search = '', 
    modelType = ''
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { modelType: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (modelType) {
      where.modelType = modelType;
    }

    const [trainingConfigs, total] = await this.prisma.$transaction([
      this.prisma.trainingConfig.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.trainingConfig.count({ where }),
    ]);

    return {
      success: true,
      message: 'Lấy danh sách training configs thành công',
      data: {
        data: trainingConfigs.map(tc => new TrainingConfigResponseDto(tc)),
        total,
        page,
        pageCount: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const trainingConfig = await this.prisma.trainingConfig.findUnique({
      where: { id },
    });

    if (!trainingConfig) {
      return { success: false, message: 'Training config không tồn tại' };
    }

    return {
      success: true,
      data: new TrainingConfigResponseDto(trainingConfig),
    };
  }

  async getByName(name: string) {
    const trainingConfig = await this.prisma.trainingConfig.findUnique({
      where: { name },
    });

    if (!trainingConfig) {
      return { success: false, message: 'Training config không tồn tại' };
    }

    return {
      success: true,
      data: new TrainingConfigResponseDto(trainingConfig),
    };
  }

  async update(id: string, dto: UpdateTrainingConfigDto) {
    const trainingConfig = await this.prisma.trainingConfig.findUnique({
      where: { id },
    });

    if (!trainingConfig) {
      return { success: false, message: 'Training config không tồn tại' };
    }

    // Check name uniqueness if updating name
    if (dto.name && dto.name !== trainingConfig.name) {
      const existing = await this.prisma.trainingConfig.findUnique({
        where: { name: dto.name },
      });

      if (existing) {
        return { 
          success: false, 
          message: 'Training config với tên này đã tồn tại' 
        };
      }
    }

    const updated = await this.prisma.trainingConfig.update({
      where: { id },
      data: {
        name: dto.name ?? trainingConfig.name,
        modelType: dto.modelType ?? trainingConfig.modelType,
        parameters: dto.parameters ?? trainingConfig.parameters,
        preprocessingSteps: dto.preprocessingSteps ?? trainingConfig.preprocessingSteps,
        features: dto.features ?? trainingConfig.features,
      },
    });

    return {
      success: true,
      message: 'Cập nhật training config thành công',
      data: new TrainingConfigResponseDto(updated),
    };
  }

  async delete(id: string) {
    const trainingConfig = await this.prisma.trainingConfig.findUnique({
      where: { id },
    });

    if (!trainingConfig) {
      return { success: false, message: 'Training config không tồn tại' };
    }

    await this.prisma.trainingConfig.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Xóa training config thành công',
    };
  }

  async getConfigByModelType(modelType: string) {
    const trainingConfigs = await this.prisma.trainingConfig.findMany({
      where: { modelType },
      orderBy: { updatedAt: 'desc' },
    });

    return {
      success: true,
      message: 'Lấy training configs theo model type thành công',
      data: trainingConfigs.map(tc => new TrainingConfigResponseDto(tc)),
    };
  }

  async duplicateConfig(id: string, newName: string) {
    const trainingConfig = await this.prisma.trainingConfig.findUnique({
      where: { id },
    });

    if (!trainingConfig) {
      return { success: false, message: 'Training config không tồn tại' };
    }

    // Check if new name already exists
    const existing = await this.prisma.trainingConfig.findUnique({
      where: { name: newName },
    });

    if (existing) {
      return { 
        success: false, 
        message: 'Training config với tên này đã tồn tại' 
      };
    }

    const duplicated = await this.prisma.trainingConfig.create({
      data: {
        name: newName,
        modelType: trainingConfig.modelType,
        parameters: trainingConfig.parameters,
        preprocessingSteps: trainingConfig.preprocessingSteps,
        features: trainingConfig.features,
      },
    });

    return {
      success: true,
      message: 'Duplicate training config thành công',
      data: new TrainingConfigResponseDto(duplicated),
    };
  }
}