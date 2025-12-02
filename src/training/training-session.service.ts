// src/training/training-session.service.ts
import { Injectable } from '@nestjs/common';
import { CreateTrainingSessionDto } from './dto/create-training-session.dto';
import { UpdateTrainingSessionDto } from './dto/update-training-session.dto';
import { TrainingSessionResponseDto } from './dto/training-session-response.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TrainingSessionService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTrainingSessionDto) {
    const trainingSession = await this.prisma.trainingSession.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        datasetConfig: dto.datasetConfig ?? null,
        dataSource: dto.dataSource,
        modelType: dto.modelType,
        modelName: dto.modelName ?? null,
        baseModel: dto.baseModel ?? null,
        parameters: dto.parameters ?? null,
        status: 'pending',
        progress: 0,
        // Remove userId field entirely
      },
    });

    return {
      success: true,
      message: 'Tạo training session thành công',
      data: new TrainingSessionResponseDto(trainingSession),
    };
  }

  async getTrainingSessions(page = 1, limit = 10, search = '', status = '') {
    const skip = (page - 1) * limit;

    const where: any = {}; // No user filter
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (status) {
      where.status = status;
    }

    const [trainingSessions, total] = await this.prisma.$transaction([
      this.prisma.trainingSession.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.trainingSession.count({ where }),
    ]);

    return {
      success: true,
      message: 'Lấy danh sách training sessions thành công',
      data: {
        data: trainingSessions.map(ts => new TrainingSessionResponseDto(ts)),
        total,
        page,
        pageCount: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const trainingSession = await this.prisma.trainingSession.findUnique({
      where: { id }, // No user filter
    });
    
    if (!trainingSession) {
      return { success: false, message: 'Training session không tồn tại' };
    }
    
    return { 
      success: true, 
      data: new TrainingSessionResponseDto(trainingSession) 
    };
  }

  async update(id: string, dto: UpdateTrainingSessionDto) {
    const trainingSession = await this.prisma.trainingSession.findUnique({
      where: { id }, // No user filter
    });
    
    if (!trainingSession) {
      return { success: false, message: 'Training session không tồn tại' };
    }

    const updated = await this.prisma.trainingSession.update({
      where: { id },
      data: {
        name: dto.name ?? trainingSession.name,
        description: dto.description ?? trainingSession.description,
        datasetConfig: dto.datasetConfig ?? trainingSession.datasetConfig,
        dataSource: dto.dataSource ?? trainingSession.dataSource,
        modelType: dto.modelType ?? trainingSession.modelType,
        modelName: dto.modelName ?? trainingSession.modelName,
        baseModel: dto.baseModel ?? trainingSession.baseModel,
        parameters: dto.parameters ?? trainingSession.parameters,
        status: dto.status ?? trainingSession.status,
        progress: dto.progress ?? trainingSession.progress,
        currentStep: dto.currentStep ?? trainingSession.currentStep,
      },
    });

    return {
      success: true,
      message: 'Cập nhật training session thành công',
      data: new TrainingSessionResponseDto(updated),
    };
  }

  async delete(id: string) {
    const trainingSession = await this.prisma.trainingSession.findUnique({
      where: { id }, // No user filter
    });
    
    if (!trainingSession) {
      return { success: false, message: 'Training session không tồn tại' };
    }

    await this.prisma.trainingSession.delete({ where: { id } });
    
    return { 
      success: true, 
      message: 'Xóa training session thành công' 
    };
  }

  async startTraining(id: string) {
    const trainingSession = await this.prisma.trainingSession.findUnique({
      where: { id }, // No user filter
    });
    
    if (!trainingSession) {
      return { success: false, message: 'Training session không tồn tại' };
    }

    const updated = await this.prisma.trainingSession.update({
      where: { id },
      data: {
        status: 'collecting_data',
        startedAt: new Date(),
      },
    });

    // TODO: Implement actual training logic here
    
    return {
      success: true,
      message: 'Bắt đầu training thành công',
      data: new TrainingSessionResponseDto(updated),
    };
  }

  async cancelTraining(id: string) {
    const trainingSession = await this.prisma.trainingSession.findUnique({
      where: { id }, // No user filter
    });
    
    if (!trainingSession) {
      return { success: false, message: 'Training session không tồn tại' };
    }

    const updated = await this.prisma.trainingSession.update({
      where: { id },
      data: {
        status: 'failed',
        completedAt: new Date(),
      },
    });

    return {
      success: true,
      message: 'Hủy training thành công',
      data: new TrainingSessionResponseDto(updated),
    };
  }
}
