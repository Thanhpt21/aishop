// src/training-data/training-data.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTrainingDataDto } from './dto/create-training-data.dto';
import { UpdateTrainingDataDto } from './dto/update-training-data.dto';
import { TrainingDataResponseDto } from './dto/training-data-response.dto';

@Injectable()
export class TrainingDataService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateTrainingDataDto) {
  // VALIDATE trainingSessionId exists
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

  const trainingData = await this.prisma.trainingData.create({
    data: {
      messageId: dto.messageId ?? null,
      input: dto.input,
      output: dto.output ?? null,
      category: dto.category ?? null,
      intent: dto.intent ?? null,
      qualityScore: dto.qualityScore ?? null,
      isVerified: dto.isVerified ?? false,
      source: dto.source ?? 'manual',
      language: dto.language ?? 'vi',
      difficulty: dto.difficulty ?? null,
      trainingSessionId: dto.trainingSessionId ?? null,
    },
  });

  return {
    success: true,
    message: 'Tạo training data thành công',
    data: new TrainingDataResponseDto(trainingData),
  };
}

  async getTrainingData(
    page = 1, 
    limit = 10, 
    search = '', 
    category = '',
    intent = '',
    trainingSessionId = ''
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { input: { contains: search, mode: 'insensitive' } },
        { output: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = category;
    }

    if (intent) {
      where.intent = intent;
    }

    if (trainingSessionId) {
      where.trainingSessionId = trainingSessionId;
    }

    const [trainingData, total] = await this.prisma.$transaction([
      this.prisma.trainingData.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          message: {
            select: {
              id: true,
              content: true,
              conversationId: true
            }
          },
          trainingSession: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }),
      this.prisma.trainingData.count({ where }),
    ]);

    return {
      success: true,
      message: 'Lấy danh sách training data thành công',
      data: {
        data: trainingData.map(td => new TrainingDataResponseDto(td)),
        total,
        page,
        pageCount: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const trainingData = await this.prisma.trainingData.findUnique({
      where: { id },
      include: {
        message: true,
        trainingSession: true
      }
    });

    if (!trainingData) {
      return { success: false, message: 'Training data không tồn tại' };
    }

    return {
      success: true,
      data: new TrainingDataResponseDto(trainingData),
    };
  }

  async update(id: string, dto: UpdateTrainingDataDto) {
    const trainingData = await this.prisma.trainingData.findUnique({
      where: { id },
    });

    if (!trainingData) {
      return { success: false, message: 'Training data không tồn tại' };
    }


    const updated = await this.prisma.trainingData.update({
      where: { id },
      data: {
        messageId: dto.messageId ?? trainingData.messageId,
        input: dto.input ?? trainingData.input,
        output: dto.output ?? trainingData.output,
        category: dto.category ?? trainingData.category,
        intent: dto.intent ?? trainingData.intent,
        qualityScore: dto.qualityScore ?? trainingData.qualityScore,
        isVerified: dto.isVerified ?? trainingData.isVerified,
        source: dto.source ?? trainingData.source,
        language: dto.language ?? trainingData.language,
        difficulty: dto.difficulty ?? trainingData.difficulty,
        trainingSessionId: dto.trainingSessionId ?? trainingData.trainingSessionId,
      },
    });

    return {
      success: true,
      message: 'Cập nhật training data thành công',
      data: new TrainingDataResponseDto(updated),
    };
  }

  async delete(id: string) {
    const trainingData = await this.prisma.trainingData.findUnique({
      where: { id },
    });

    if (!trainingData) {
      return { success: false, message: 'Training data không tồn tại' };
    }

    await this.prisma.trainingData.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Xóa training data thành công',
    };
  }

  async verifyData(id: string, verifiedBy: string) {
    const trainingData = await this.prisma.trainingData.findUnique({
      where: { id },
    });

    if (!trainingData) {
      return { success: false, message: 'Training data không tồn tại' };
    }

    const updated = await this.prisma.trainingData.update({
      where: { id },
      data: {
        isVerified: true,
        verifiedBy: verifiedBy,
        qualityScore: 1.0, // Auto set high quality when verified
      },
    });

    return {
      success: true,
      message: 'Xác minh training data thành công',
      data: new TrainingDataResponseDto(updated),
    };
  }
}