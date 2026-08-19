export const REQUIRED_QUESTION_FAMILIES = [
  'culture',
  'place',
  'rhythm',
  'identity',
  'music',
  'boundary',
  'wildcard',
] as const;

export type QuestionFamily = (typeof REQUIRED_QUESTION_FAMILIES)[number];

export type VaultQuestionChoice = {
  value: string;
  label: string;
};

export type VaultQuestionDefinition = {
  id: string;
  version: number;
  family: QuestionFamily;
  prompt: string;
  kind: 'text' | 'choice';
  optional: boolean;
  active: boolean;
  weight: number;
  choices?: readonly VaultQuestionChoice[];
};

const text = (
  id: string,
  family: QuestionFamily,
  prompt: string,
  optional = false,
): VaultQuestionDefinition => ({
  id,
  version: 1,
  family,
  prompt,
  kind: 'text',
  optional,
  active: true,
  weight: 1,
});

const choice = (
  id: string,
  family: QuestionFamily,
  prompt: string,
  choices: readonly VaultQuestionChoice[],
): VaultQuestionDefinition => ({
  id,
  version: 1,
  family,
  prompt,
  kind: 'choice',
  optional: false,
  active: true,
  weight: 1,
  choices,
});

export const QUESTION_VAULT = [
  text('culture.book.v1', 'culture', "So tell me. What's a book you actually remember?"),
  text('culture.film.v1', 'culture', "What's a film you could recognize from one frame?"),
  text('culture.object.v1', 'culture', 'Name an object you would keep even if it stopped being useful.'),
  text('culture.character.v1', 'culture', 'Which fictional character do you understand a little too well?'),
  text('culture.art.v1', 'culture', 'What kind of art makes you stop instead of walk past?'),
  text('culture.memory-era.v1', 'culture', 'Is there an era you feel strangely drawn to?'),
  text('culture.cover.v1', 'culture', 'Think of a cover, poster or album sleeve you never forgot. What was it?'),
  text('culture.collection.v1', 'culture', 'If you had to collect one useless thing forever, what would it be?'),
  text('culture.symbol.v1', 'culture', 'What symbol or shape keeps showing up in things you like?'),
  text('culture.story.v1', 'culture', 'What story did you love before you knew whether it was good?'),

  text('place.escape.v1', 'place', 'Where would you disappear to for a week?'),
  text('place.room.v1', 'place', 'Describe a room you would happily stay in all day.'),
  text('place.weather.v1', 'place', 'What weather feels most like yours?'),
  text('place.city.v1', 'place', 'Which city has the right kind of noise for you?'),
  text('place.nature.v1', 'place', 'Sea, desert, forest, mountains or something else entirely?'),
  text('place.childhood.v1', 'place', 'What place from your childhood can you still picture clearly?'),
  text('place.smell.v1', 'place', 'What place can you identify by smell alone?'),
  text('place.window.v1', 'place', 'What would you want outside your window every morning?'),
  text('place.lost.v1', 'place', 'Where would you not mind getting a little lost?'),
  text('place.surface.v1', 'place', 'What ground feels right under your feet: pavement, sand, grass, stone, snow, something else?'),

  choice('rhythm.time.v1', 'rhythm', 'Pick a time. Which one feels most like you?', [
    { value: 'sunrise', label: 'Sunrise' },
    { value: 'afternoon', label: 'Afternoon' },
    { value: 'midnight', label: 'Midnight' },
    { value: '4am', label: '4 a.m.' },
  ]),
  text('rhythm.fast-slow.v1', 'rhythm', 'Do you prefer things moving too fast or almost not moving at all?'),
  text('rhythm.week.v1', 'rhythm', 'Which day of the week has the best energy?'),
  text('rhythm.noise.v1', 'rhythm', 'Do you think better in silence, music, conversation or noise?'),
  text('rhythm.arrival.v1', 'rhythm', 'Early, exactly on time, or somehow always late?'),
  text('rhythm.night.v1', 'rhythm', 'What usually keeps you awake longer than it should?'),
  text('rhythm.motion.v1', 'rhythm', 'Walking, driving, sitting still or being carried somewhere — when does your head work best?'),
  text('rhythm.repeat.v1', 'rhythm', 'What small thing do you repeat almost every day?'),
  text('rhythm.pause.v1', 'rhythm', 'What makes you stop whatever you are doing?'),
  text('rhythm.season.v1', 'rhythm', 'Which season changes your mood the most?'),

  text('identity.misread.v1', 'identity', 'What do people usually get wrong about you?'),
  text('identity.first-impression.v1', 'identity', 'What first impression do you think you give people?'),
  text('identity.private.v1', 'identity', 'What part of you takes longer for people to notice?'),
  text('identity.contradiction.v1', 'identity', 'Name two things about you that should contradict each other but somehow do not.'),
  text('identity.younger.v1', 'identity', 'What would a younger version of you be surprised you care about now?'),
  text('identity.word.v1', 'identity', 'What word would you never use to describe yourself?'),
  text('identity.reputation.v1', 'identity', 'What are you weirdly reliable at?'),
  text('identity.change.v1', 'identity', 'What changed about you that people who knew you years ago might miss?'),
  text('identity.room.v1', 'identity', 'In a room full of people, where do you naturally end up?'),
  text('identity.secret-skill.v1', 'identity', 'What are you better at than people expect?'),

  text('music.never-skip.v1', 'music', "What's a song you never skip?"),
  text('music.voice.v1', 'music', 'Whose voice could you recognize immediately?'),
  text('music.instrument.v1', 'music', 'What instrument changes a song for you the moment it appears?'),
  text('music.memory.v1', 'music', 'What song is attached to a specific memory for you?'),
  text('music.energy.v1', 'music', 'What do you play when you need your energy back?'),
  text('music.quiet.v1', 'music', 'What do you listen to when you want everything quieter?'),
  text('music.first.v1', 'music', 'What is the first album or artist you remember choosing for yourself?'),
  text('music.guilty.v1', 'music', 'Name something you listen to that does not match how people see you.'),
  text('music.live.v1', 'music', 'What song would you want to hear live exactly once?'),
  text('music.texture.v1', 'music', 'Do you notice lyrics, rhythm, bass, voice or atmosphere first?'),

  text('boundary.never-wear.v1', 'boundary', "What's something you'd never wear, no matter who made it?"),
  text('boundary.color.v1', 'boundary', 'What color almost never works for you?'),
  text('boundary.pattern.v1', 'boundary', 'What pattern loses you immediately?'),
  text('boundary.loud.v1', 'boundary', 'What makes clothing feel too loud?'),
  text('boundary.clean.v1', 'boundary', 'What makes something feel too clean or polished for you?'),
  text('boundary.logo.v1', 'boundary', 'Big logos, tiny logos, or no logos at all?'),
  text('boundary.text.v1', 'boundary', 'How much text on clothing is too much?'),
  text('boundary.trend.v1', 'boundary', 'Name a style or trend you hope never comes back.'),
  text('boundary.material.v1', 'boundary', 'Is there a material or texture you avoid wearing?'),
  text('boundary.detail.v1', 'boundary', 'What design detail can ruin an otherwise good piece for you?'),

  text('wildcard.random.v1', 'wildcard', 'Last one. Tell me something completely random about you.', true),
  text('wildcard.snack.v1', 'wildcard', 'What snack disappears fastest around you?', true),
  text('wildcard.useless-fact.v1', 'wildcard', 'Tell me one useless fact you happen to know.', true),
  text('wildcard.pocket.v1', 'wildcard', 'What is usually in your pocket or bag that probably should not be?', true),
  text('wildcard.photo.v1', 'wildcard', 'What is the last kind of thing you tend to photograph?', true),
  text('wildcard.tab.v1', 'wildcard', 'What browser tab do you keep open for far too long?', true),
  text('wildcard.food.v1', 'wildcard', 'What food opinion would you defend for no good reason?', true),
  text('wildcard.small-joy.v1', 'wildcard', 'What tiny thing makes a day disproportionately better?', true),
  text('wildcard.strange-object.v1', 'wildcard', 'What is the strangest object you own?', true),
  text('wildcard.current.v1', 'wildcard', 'What are you strangely interested in right now?', true),
] as const satisfies readonly VaultQuestionDefinition[];
