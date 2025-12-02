// src/model-evaluation/dto/model-evaluation-response.dto.ts
export class ModelEvaluationResponseDto {
  id: string;
  trainingSessionId: string;
  testDataset?: any;
  metrics: any;
  overallScore?: number;
  details?: any;
  createdAt: Date;

  constructor(modelEvaluation: any) {
    this.id = modelEvaluation.id;
    this.trainingSessionId = modelEvaluation.trainingSessionId;
    this.testDataset = modelEvaluation.testDataset ?? undefined;
    this.metrics = modelEvaluation.metrics;
    this.overallScore = modelEvaluation.overallScore ?? undefined;
    this.details = modelEvaluation.details ?? undefined;
    this.createdAt = modelEvaluation.createdAt;
  }
}