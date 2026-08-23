BEGIN;

ALTER TABLE experiences
  DROP CONSTRAINT IF EXISTS experiences_stage_check;

ALTER TABLE experiences
  ADD CONSTRAINT experiences_stage_check
  CHECK (
    stage IN (
      'VISITOR',
      'EXPERIENCE_STARTED',
      'QUESTION_1',
      'QUESTION_2',
      'QUESTION_3',
      'QUESTION_4',
      'QUESTION_5',
      'QUESTION_6',
      'QUESTION_7',
      'PROFILE_COMPLETE',
      'OBJECT_SELECTED',
      'SIZE_CONFIRMED',
      'COMMITMENT_READY',
      'CHECKOUT_STARTED'
    )
  );

COMMIT;
