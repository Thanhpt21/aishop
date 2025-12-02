// src/training-data/dto/training-data-response.dto.ts
export class TrainingDataResponseDto {
  id: string;
  messageId?: string;
  input: string;
  output?: string;
  category?: string;
  intent?: string;
  qualityScore?: number;
  isVerified: boolean;
  verifiedBy?: string;
  source: string;
  language: string;
  difficulty?: string;
  trainingSessionId?: string;
  createdAt: Date;

  constructor(trainingData: any) {
    this.id = trainingData.id;
    this.messageId = trainingData.messageId ?? undefined;
    this.input = trainingData.input;
    this.output = trainingData.output ?? undefined;
    this.category = trainingData.category ?? undefined;
    this.intent = trainingData.intent ?? undefined;
    this.qualityScore = trainingData.qualityScore ?? undefined;
    this.isVerified = trainingData.isVerified;
    this.verifiedBy = trainingData.verifiedBy ?? undefined;
    this.source = trainingData.source;
    this.language = trainingData.language;
    this.difficulty = trainingData.difficulty ?? undefined;
    this.trainingSessionId = trainingData.trainingSessionId ?? undefined;
    this.createdAt = trainingData.createdAt;
  }
}