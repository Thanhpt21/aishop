// src/model-evaluation/model-evaluation.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateModelEvaluationDto } from './dto/create-model-evaluation.dto';
import { UpdateModelEvaluationDto } from './dto/update-model-evaluation.dto';
import { ModelEvaluationResponseDto } from './dto/model-evaluation-response.dto';

@Injectable()
export class ModelEvaluationService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateModelEvaluationDto) {
    // Validate trainingSessionId exists
    const trainingSession = await this.prisma.trainingSession.findUnique({
      where: { id: dto.trainingSessionId },
    });

    if (!trainingSession) {
      return { 
        success: false, 
        message: 'Training session không tồn tại' 
      };
    }

    const modelEvaluation = await this.prisma.modelEvaluation.create({
      data: {
        trainingSessionId: dto.trainingSessionId,
        testDataset: dto.testDataset ?? null,
        metrics: dto.metrics,
        overallScore: dto.overallScore ?? null,
        details: dto.details ?? null,
      },
    });

    return {
      success: true,
      message: 'Tạo model evaluation thành công',
      data: new ModelEvaluationResponseDto(modelEvaluation),
    };
  }

  async getModelEvaluations(
    page = 1, 
    limit = 10, 
    trainingSessionId = '',
    minScore = 0
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};

    if (trainingSessionId) {
      where.trainingSessionId = trainingSessionId;
    }

    if (minScore > 0) {
      where.overallScore = { gte: minScore };
    }

    const [modelEvaluations, total] = await this.prisma.$transaction([
      this.prisma.modelEvaluation.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          trainingSession: {
            select: {
              id: true,
              name: true,
              modelType: true,
              baseModel: true
            }
          }
        }
      }),
      this.prisma.modelEvaluation.count({ where }),
    ]);

    return {
      success: true,
      message: 'Lấy danh sách model evaluations thành công',
      data: {
        data: modelEvaluations.map(me => new ModelEvaluationResponseDto(me)),
        total,
        page,
        pageCount: Math.ceil(total / limit),
      },
    };
  }

  async getById(id: string) {
    const modelEvaluation = await this.prisma.modelEvaluation.findUnique({
      where: { id },
      include: {
        trainingSession: {
          select: {
            id: true,
            name: true,
            modelType: true,
            baseModel: true,
            parameters: true
          }
        }
      }
    });

    if (!modelEvaluation) {
      return { success: false, message: 'Model evaluation không tồn tại' };
    }

    return {
      success: true,
      data: new ModelEvaluationResponseDto(modelEvaluation),
    };
  }

  async getByTrainingSessionId(trainingSessionId: string) {
    const modelEvaluations = await this.prisma.modelEvaluation.findMany({
      where: { trainingSessionId },
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
    });

    return {
      success: true,
      message: 'Lấy model evaluations theo training session thành công',
      data: modelEvaluations.map(me => new ModelEvaluationResponseDto(me)),
    };
  }

  async update(id: string, dto: UpdateModelEvaluationDto) {
    const modelEvaluation = await this.prisma.modelEvaluation.findUnique({
      where: { id },
    });

    if (!modelEvaluation) {
      return { success: false, message: 'Model evaluation không tồn tại' };
    }

    const updated = await this.prisma.modelEvaluation.update({
      where: { id },
      data: {
        testDataset: dto.testDataset ?? modelEvaluation.testDataset,
        metrics: dto.metrics ?? modelEvaluation.metrics,
        overallScore: dto.overallScore ?? modelEvaluation.overallScore,
        details: dto.details ?? modelEvaluation.details,
      },
    });

    return {
      success: true,
      message: 'Cập nhật model evaluation thành công',
      data: new ModelEvaluationResponseDto(updated),
    };
  }

  async delete(id: string) {
    const modelEvaluation = await this.prisma.modelEvaluation.findUnique({
      where: { id },
    });

    if (!modelEvaluation) {
      return { success: false, message: 'Model evaluation không tồn tại' };
    }

    await this.prisma.modelEvaluation.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Xóa model evaluation thành công',
    };
  }

  async getEvaluationStats(trainingSessionId: string) {
    const evaluations = await this.prisma.modelEvaluation.findMany({
      where: { trainingSessionId },
      orderBy: { createdAt: 'desc' },
    });

    if (evaluations.length === 0) {
      return {
        success: true,
        message: 'Không có evaluation data',
        data: {
          totalEvaluations: 0,
          averageScore: 0,
          bestScore: 0,
          latestScore: 0
        }
      };
    }

    const scores = evaluations.filter(e => e.overallScore !== null).map(e => e.overallScore!);
    const averageScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const bestScore = Math.max(...scores);
    const latestScore = evaluations[0].overallScore || 0;

    return {
      success: true,
      message: 'Lấy evaluation stats thành công',
      data: {
        totalEvaluations: evaluations.length,
        averageScore: parseFloat(averageScore.toFixed(3)),
        bestScore: parseFloat(bestScore.toFixed(3)),
        latestScore: parseFloat(latestScore.toFixed(3)),
        evaluations: evaluations.map(e => new ModelEvaluationResponseDto(e))
      }
    };
  }
}