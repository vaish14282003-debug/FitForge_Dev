// Stable muscle IDs shared by the exercise library and the frontend anatomy catalog
// (frontend/src/features/muscle-intelligence/anatomy/muscles.ts). IDs never change once used;
// display names live in the catalog. Superficial muscles only, at the level exercise science uses.
const MUSCLE_IDS = Object.freeze([
  'pectoralis-major',
  'anterior-deltoid',
  'lateral-deltoid',
  'posterior-deltoid',
  'biceps-brachii',
  'brachialis',
  'brachioradialis',
  'forearm-flexors',
  'triceps-brachii',
  'trapezius',
  'rhomboids',
  'latissimus-dorsi',
  'erector-spinae',
  'rectus-abdominis',
  'obliques',
  'hip-flexors',
  'gluteus-maximus',
  'gluteus-medius',
  'adductors',
  'quadriceps',
  'hamstrings',
  'gastrocnemius',
  'soleus',
  'tibialis-anterior',
]);

// The movement an exercise trains, used to group and suggest exercises.
const MOVEMENT_PATTERNS = Object.freeze([
  'HORIZONTAL_PUSH',
  'VERTICAL_PUSH',
  'HORIZONTAL_PULL',
  'VERTICAL_PULL',
  'SQUAT',
  'HINGE',
  'LUNGE',
  'ISOLATION',
  'CORE',
  'FULL_BODY',
  'CARDIO',
]);

module.exports = { MUSCLE_IDS, MOVEMENT_PATTERNS };
