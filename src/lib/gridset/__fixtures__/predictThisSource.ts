/**
 * Documented `Prediction.PredictThis` texts from b104/Actions measurement
 * (`engines-runtime-source.md` §ב3–ב4 / `eng-11`–`eng-14`).
 *
 * These are the first three measured pages of Body actions only — not a
 * reconstructed 84-verb payload and not a default dictionary.
 */
export const B104_BODY_PAGE1 = [
	'abseil',
	'amble',
	'balance',
	'bash',
	'bleed',
	'blush',
	'breathe'
] as const;

export const B104_BODY_PAGE2 = ['chase', 'climb', 'crawl', 'cry', 'dance', 'die', 'dive'] as const;

export const B104_BODY_PAGE3 = [
	'doze',
	'drive',
	'drown',
	'exercise',
	'explore',
	'fell',
	'fidget'
] as const;

export const B104_BODY_DOCUMENTED = [
	...B104_BODY_PAGE1,
	...B104_BODY_PAGE2,
	...B104_BODY_PAGE3
] as const;

export const B104_FOOD_PAGE1 = [
	'add',
	'bake',
	'barbecue',
	'beat',
	'blend',
	'boil',
	'carve'
] as const;
