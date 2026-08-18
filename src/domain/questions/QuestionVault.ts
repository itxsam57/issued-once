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
  version: 1;
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
  text('place.night.v1', 'place', 'Where would you rather be at 2 a.m.?'),
  text('place.window.v1', 'place', 'If your window could look onto anything, what would be outside?'),
  text('place.texture.v1', 'place', 'Name a place whose walls, streets or surfaces you remember.'),
  text('place.return.v1', 'place', 'Where have you been that you would go back to without planning anything?'),

  choice('rhythm.time.v1', 'rhythm', 'Pick a time. Which one feels most like you?', [
    { value: 'sunrise', label: 'Sunrise' },
    { value: 'afternoon', label: 'Afternoon' },
    { value: 'midnight', label: 'Midnight' },
    { value: '4am', label: '4 a.m.' },
  ]),
  choice('rhythm.pace.v1', 'rhythm', 'How do you usually move through a good day?', [
    { value: 'slow', label: 'Slow' },
    { value: 'steady', label: 'Steady' },
    { value: 'bursts', label: 'In bursts' },
    { value: 'chaotic', label: 'Beautifully chaotic' },
  ]),
  text('rhythm.focus.v1', 'rhythm', 'What can make you lose track of time?'),
  text('rhythm.weekend.v1', 'rhythm', 'What does a perfect unplanned Saturday look like?'),
  choice('rhythm.energy.v1', 'rhythm', 'Choose the energy you would keep.', [
    { value: 'quiet', label: 'Quiet' },
    { value: 'restless', label: 'Restless' },
    { value: 'sharp', label: 'Sharp' },
    { value: 'warm', label: 'Warm' },
  ]),
  text('rhythm.delay.v1', 'rhythm', 'What do you always leave until the last minute?'),
  text('rhythm.repeat.v1', 'rhythm', 'What little thing do you do almost every day without thinking?'),
  choice('rhythm.order.v1', 'rhythm', 'Which sounds more like you?', [
    { value: 'plan', label: 'I like a plan' },
    { value: 'improvise', label: "I'll figure it out" },
    { value: 'both', label: 'Depends on the day' },
  ]),
  text('rhythm.morning.v1', 'rhythm', 'What is the first thing you want around you in the morning?'),
  text('rhythm.afterdark.v1', 'rhythm', 'What gets better after dark?'),

  text('identity.misread.v1', 'identity', 'What do people usually get wrong about you?'),
  text('identity.first-impression.v1', 'identity', 'What do people assume about you too quickly?'),
  text('identity.private-pride.v1', 'identity', "What's something about yourself you're quietly proud of?"),
  text('identity.contradiction.v1', 'identity', 'Tell me two things about you that should not make sense together.'),
  text('identity.friend-word.v1', 'identity', 'What word would your closest friend use for you?'),
  text('identity.stranger-word.v1', 'identity', 'What word would a stranger probably use for you?'),
  text('identity.changed.v1', 'identity', 'What part of you has changed the most in the last few years?'),
  text('identity.never-changed.v1', 'identity', 'What part of you has barely changed at all?'),
  text('identity.rule.v1', 'identity', 'What is one rule you have for yourself that nobody gave you?'),
  text('identity.notice.v1', 'identity', 'What do you notice that other people seem to miss?'),

  text('music.never-skip.v1', 'music', "What's a song you never skip?"),
  text('music.first-memory.v1', 'music', 'What song takes you somewhere immediately?'),
  text('music.voice.v1', 'music', 'Whose voice would you recognize in half a second?'),
  text('music.sound.v1', 'music', 'What sound do you genuinely love that is not music?'),
  text('music.guilty.v1', 'music', 'What song would surprise people if they found it in your favourites?'),
  text('music.live.v1', 'music', 'If you could hear one artist live tonight, who is it?'),
  text('music.instrument.v1', 'music', 'Which instrument has the best personality?'),
  choice('music.texture.v1', 'music', 'Pick a sound texture.', [
    { value: 'clean', label: 'Clean' },
    { value: 'distorted', label: 'Distorted' },
    { value: 'warm', label: 'Warm' },
    { value: 'raw', label: 'Raw' },
  ]),
  text('music.line.v1', 'music', 'Is there a lyric or phrase you keep coming back to?'),
  text('music.silence.v1', 'music', 'When do you prefer silence to music?'),

  text('boundary.never-wear.v1', 'boundary', "What's something you'd never wear, no matter who made it?"),
  text('boundary.color.v1', 'boundary', 'Is there a colour you almost never choose?'),
  text('boundary.trend.v1', 'boundary', 'Name a trend you would happily never see again.'),
  text('boundary.too-much.v1', 'boundary', 'What makes a design feel like too much to you?'),
  text('boundary.too-little.v1', 'boundary', 'What makes something feel boring instead of minimal?'),
  choice('boundary.branding.v1', 'boundary', 'How visible should a logo feel?', [
    { value: 'none', label: 'Almost not there' },
    { value: 'quiet', label: 'Quiet' },
    { value: 'clear', label: 'Clear' },
    { value: 'loud', label: 'Loud if it earns it' },
  ]),
  text('boundary.literal.v1', 'boundary', 'What would feel painfully obvious if someone put it on a shirt?'),
  text('boundary.material.v1', 'boundary', 'Is there a fabric, finish or texture you dislike touching?'),
  text('boundary.message.v1', 'boundary', 'What kind of message would you never want printed across your chest?'),
  text('boundary.copy.v1', 'boundary', 'What makes something look copied instead of original to you?'),

  text('wildcard.random.v1', 'wildcard', 'Last one. Tell me something completely random about you.', true),
  text('wildcard.pocket.v1', 'wildcard', "What's usually in your pocket or bag that says more about you than it should?", true),
  text('wildcard.food.v1', 'wildcard', 'What food could you eat far too often?', true),
  text('wildcard.skill.v1', 'wildcard', 'What oddly specific thing are you good at?', true),
  text('wildcard.small-obsession.v1', 'wildcard', "What's your current tiny obsession?", true),
  text('wildcard.photo.v1', 'wildcard', 'What is the last kind of thing you usually take a photo of?', true),
  text('wildcard.desk.v1', 'wildcard', 'What is sitting near you right now?', true),
  text('wildcard.unpopular.v1', 'wildcard', 'Give me one harmless opinion you would defend for no good reason.', true),
  text('wildcard.compliment.v1', 'wildcard', 'What is the strangest compliment you remember receiving?', true),
  text('wildcard.keep.v1', 'wildcard', 'If you had to keep one small thing from today, what would it be?', true),
] as const satisfies readonly VaultQuestionDefinition[];

export function getQuestionById(id: string): VaultQuestionDefinition | null {
  return QUESTION_VAULT.find((question) => question.id === id) ?? null;
}
