// src/models/dto/deployed-model-response.dto.ts
export class DeployedModelResponseDto {
  id: string;
  name: string;
  version: string;
  modelType: string;
  modelPath: string;
  isActive: boolean;
  accuracy?: number;
  latency?: number;
  trainingSessionId?: string;
  createdAt: Date;
  deployedAt?: Date;

  constructor(deployedModel: any) {
    this.id = deployedModel.id;
    this.name = deployedModel.name;
    this.version = deployedModel.version;
    this.modelType = deployedModel.modelType;
    this.modelPath = deployedModel.modelPath;
    this.isActive = deployedModel.isActive;
    this.accuracy = deployedModel.accuracy ?? undefined;
    this.latency = deployedModel.latency ?? undefined;
    this.trainingSessionId = deployedModel.trainingSessionId ?? undefined;
    this.createdAt = deployedModel.createdAt;
    this.deployedAt = deployedModel.deployedAt ?? undefined;
  }
}