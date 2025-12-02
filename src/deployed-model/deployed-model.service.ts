// src/models/deployed-model.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDeployedModelDto } from './dto/create-deployed-model.dto';
import { UpdateDeployedModelDto } from './dto/update-deployed-model.dto';
import { DeployedModelResponseDto } from './dto/deployed-model-response.dto';

@Injectable()
export class DeployedModelService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateDeployedModelDto) {
    // Validate trainingSessionId exists
    if (dto.trainingSessionId) {
      const trainingSession = await this.prisma.trainingSession.findUnique({
        where: { id: dto.trainingSessionId },
      });
      if (!trainingSession) {
        return { 
          success: false, 
          message: 'Training session không tồn tại' 
        };
      }
    }

    // Check if model with same name and version already exists
    const existing = await this.prisma.deployedModel.findFirst({
      where: {
        name: dto.name,
        version: dto.version,
      },
    });

    if (existing) {
      return { 
        success: false, 
        message: 'Model với tên và version này đã tồn tại' 
      };
    }

    const deployedModel = await this.prisma.deployedModel.create({
      data: {
        name: dto.name,
        version: dto.version,
        modelType: dto.modelType,
        modelPath: dto.modelPath,
        isActive: dto.isActive ?? false,
        accuracy: dto.accuracy ?? null,
        latency: dto.latency ?? null,
        trainingSessionId: dto.trainingSessionId ?? null,
        deployedAt: dto.isActive ? new Date() : null,
      },
    });

    return {
      success: true,
      message: 'Tạo deployed model thành công',
      data: new DeployedModelResponseDto(deployedModel),
    };
  }

  async getDeployedModels(
    page = 1, 
    limit = 10, 
    search = '', 
    modelType = '',
    isActive = ''
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { version: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (modelType) {
      where.modelType = modelType;
    }

    if (isActive !== '') {
      where.isActive = isActive === 'true';
    }

    const [deployedModels, total] = await this.prisma.$transaction([
      this.prisma.deployedModel.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          trainingSession: {
            select: {
              id: true,
              name: true,
              modelType: true
            }
          }
        }
      }),
      this.prisma.deployedModel.count({ where }),
    ]);

    return {
      success: true,
      message: 'Lấy danh sách deployed models thành công',
      data: {
        data: deployedModels.map(dm => new DeployedModelResponseDto(dm)),
        total,
        page,
        pageCount: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const deployedModel = await this.prisma.deployedModel.findUnique({
      where: { id },
      include: {
        trainingSession: true
      }
    });

    if (!deployedModel) {
      return { success: false, message: 'Deployed model không tồn tại' };
    }

    return {
      success: true,
      data: new DeployedModelResponseDto(deployedModel),
    };
  }

  async update(id: string, dto: UpdateDeployedModelDto) {
    const deployedModel = await this.prisma.deployedModel.findUnique({
      where: { id },
    });

    if (!deployedModel) {
      return { success: false, message: 'Deployed model không tồn tại' };
    }

    // Validate trainingSessionId if provided
    if (dto.trainingSessionId && dto.trainingSessionId !== deployedModel.trainingSessionId) {
      const trainingSession = await this.prisma.trainingSession.findUnique({
        where: { id: dto.trainingSessionId },
      });
      if (!trainingSession) {
        return { 
          success: false, 
          message: 'Training session không tồn tại' 
        };
      }
    }

    // Check name + version uniqueness if updating
    if (dto.name || dto.version) {
      const name = dto.name ?? deployedModel.name;
      const version = dto.version ?? deployedModel.version;
      
      if (name !== deployedModel.name || version !== deployedModel.version) {
        const existing = await this.prisma.deployedModel.findFirst({
          where: {
            name,
            version,
            NOT: { id }
          },
        });

        if (existing) {
          return { 
            success: false, 
            message: 'Model với tên và version này đã tồn tại' 
          };
        }
      }
    }

    const updateData: any = {
      name: dto.name ?? deployedModel.name,
      version: dto.version ?? deployedModel.version,
      modelType: dto.modelType ?? deployedModel.modelType,
      modelPath: dto.modelPath ?? deployedModel.modelPath,
      accuracy: dto.accuracy ?? deployedModel.accuracy,
      latency: dto.latency ?? deployedModel.latency,
      trainingSessionId: dto.trainingSessionId ?? deployedModel.trainingSessionId,
    };

    // Handle isActive change
    if (dto.isActive !== undefined && dto.isActive !== deployedModel.isActive) {
      updateData.isActive = dto.isActive;
      if (dto.isActive) {
        updateData.deployedAt = new Date();
        
        // Deactivate other models of the same type
        await this.prisma.deployedModel.updateMany({
          where: {
            modelType: updateData.modelType,
            isActive: true,
            id: { not: id }
          },
          data: { isActive: false }
        });
      }
    }

    const updated = await this.prisma.deployedModel.update({
      where: { id },
      data: updateData,
    });

    return {
      success: true,
      message: 'Cập nhật deployed model thành công',
      data: new DeployedModelResponseDto(updated),
    };
  }

  async delete(id: string) {
    const deployedModel = await this.prisma.deployedModel.findUnique({
      where: { id },
    });

    if (!deployedModel) {
      return { success: false, message: 'Deployed model không tồn tại' };
    }

    await this.prisma.deployedModel.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Xóa deployed model thành công',
    };
  }

  async activateModel(id: string) {
    const deployedModel = await this.prisma.deployedModel.findUnique({
      where: { id },
    });

    if (!deployedModel) {
      return { success: false, message: 'Deployed model không tồn tại' };
    }

    // Deactivate other models of the same type
    await this.prisma.deployedModel.updateMany({
      where: {
        modelType: deployedModel.modelType,
        isActive: true,
      },
      data: { isActive: false }
    });

    const activated = await this.prisma.deployedModel.update({
      where: { id },
      data: {
        isActive: true,
        deployedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Kích hoạt model thành công',
      data: new DeployedModelResponseDto(activated),
    };
  }

  async deactivateModel(id: string) {
    const deployedModel = await this.prisma.deployedModel.findUnique({
      where: { id },
    });

    if (!deployedModel) {
      return { success: false, message: 'Deployed model không tồn tại' };
    }

    const deactivated = await this.prisma.deployedModel.update({
      where: { id },
      data: {
        isActive: false,
      },
    });

    return {
      success: true,
      message: 'Hủy kích hoạt model thành công',
      data: new DeployedModelResponseDto(deactivated),
    };
  }
}