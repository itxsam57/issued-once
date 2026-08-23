export type StructuredDesignBrief = {
  concept: string;
  motifs: readonly string[];
  paletteRelation: string;
  composition: string;
  density: string;
  typography: string;
  avoid: readonly string[];
  rationale: readonly string[];
  imagePrompt: string;
};

export type DesignQuestionInput = {
  questionId: string;
  questionVersion: number;
  family: string;
  prompt: string;
  answer: string;
};

export type DesignRevisionContext = {
  ownerFeedback?: string;
};

export interface DesignGateway {
  interpret(input: {
    issueCode: string;
    objectType: string;
    sizeCode: string;
    colorCode: string;
    questions: readonly DesignQuestionInput[];
    ownerFeedback?: string;
  }): Promise<StructuredDesignBrief>;

  generateArtwork(brief: StructuredDesignBrief, context?: DesignRevisionContext): Promise<{
    bytes: Buffer;
    mimeType: 'image/png';
    width: number;
    height: number;
    provider: string;
    model: string;
  }>;
}
