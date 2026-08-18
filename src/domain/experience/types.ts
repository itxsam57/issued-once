export type QuestionId = 'q1' | 'q2' | 'q3' | 'q4' | 'q5' | 'q6' | 'q7';

export type ExperienceStage =
  | 'VISITOR'
  | 'EXPERIENCE_STARTED'
  | 'QUESTION_1'
  | 'QUESTION_2'
  | 'QUESTION_3'
  | 'QUESTION_4'
  | 'QUESTION_5'
  | 'QUESTION_6'
  | 'QUESTION_7'
  | 'PROFILE_COMPLETE'
  | 'OBJECT_SELECTED'
  | 'SIZE_CONFIRMED'
  | 'CHECKOUT_STARTED';

export type QuizAnswer = {
  questionId: QuestionId;
  value: string;
  answeredAt: string;
};

export type QuestionDefinition = {
  id: QuestionId;
  prompt: string;
  kind: 'text' | 'choice';
  optional?: boolean;
  choices?: readonly { value: string; label: string }[];
};
