// src/training-config/dto/training-config-response.dto.ts
export class TrainingConfigResponseDto {
  id: string;
  name: string;
  modelType: string;
  parameters: any;
  preprocessingSteps?: any;
  features?: any;
  createdAt: Date;
  updatedAt: Date;

  constructor(trainingConfig: any) {
    this.id = trainingConfig.id;
    this.name = trainingConfig.name;
    this.modelType = trainingConfig.modelType;
    this.parameters = trainingConfig.parameters;
    this.preprocessingSteps = trainingConfig.preprocessingSteps ?? undefined;
    this.features = trainingConfig.features ?? undefined;
    this.createdAt = trainingConfig.createdAt;
    this.updatedAt = trainingConfig.updatedAt;
  }
}