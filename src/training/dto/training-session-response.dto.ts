// src/training/dto/training-session-response.dto.ts
export class TrainingSessionResponseDto {
  id: string;
  name: string;
  description?: string;
  datasetConfig?: any;
  dataSource: string;
  modelType: string;
  modelName?: string;
  baseModel?: string;
  parameters?: any;
  status: string;
  progress: number;
  currentStep?: string;
  accuracy?: number;
  loss?: number;
  metrics?: any;
  confusionMatrix?: any;
  modelPath?: string;
  logsPath?: string;
  reportPath?: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;

  constructor(trainingSession: any) {
    this.id = trainingSession.id;
    this.name = trainingSession.name;
    this.description = trainingSession.description ?? undefined;
    this.datasetConfig = trainingSession.datasetConfig ?? undefined;
    this.dataSource = trainingSession.dataSource;
    this.modelType = trainingSession.modelType;
    this.modelName = trainingSession.modelName ?? undefined;
    this.baseModel = trainingSession.baseModel ?? undefined;
    this.parameters = trainingSession.parameters ?? undefined;
    this.status = trainingSession.status;
    this.progress = trainingSession.progress;
    this.currentStep = trainingSession.currentStep ?? undefined;
    this.accuracy = trainingSession.accuracy ?? undefined;
    this.loss = trainingSession.loss ?? undefined;
    this.metrics = trainingSession.metrics ?? undefined;
    this.confusionMatrix = trainingSession.confusionMatrix ?? undefined;
    this.modelPath = trainingSession.modelPath ?? undefined;
    this.logsPath = trainingSession.logsPath ?? undefined;
    this.reportPath = trainingSession.reportPath ?? undefined;
    this.createdAt = trainingSession.createdAt;
    this.updatedAt = trainingSession.updatedAt;
    this.startedAt = trainingSession.startedAt ?? undefined;
    this.completedAt = trainingSession.completedAt ?? undefined;
  }
}