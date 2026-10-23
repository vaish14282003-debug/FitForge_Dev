const BodyMetric = require('../models/BodyMetric');
const WorkoutSession = require('../models/WorkoutSession');

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKS = 8;
// Mon, Wed, Fri.
const TRAINING_OFFSETS = [0, 2, 4];

const dayString = (date) => date.toISOString().slice(0, 10);

/**
 * Backfills ~8 weeks of plausible training and weigh-ins for a demo member, ending yesterday,
 * so the progress charts have something to show. Development data only.
 */
async function seedDemoProgress(member, plan) {
  const today = new Date();
  today.setUTCHours(18, 0, 0, 0);
  const mondayThisWeek = new Date(today.getTime() - ((today.getUTCDay() + 6) % 7) * DAY_MS);
  const firstMonday = new Date(mondayThisWeek.getTime() - WEEKS * 7 * DAY_MS);

  const best = new Map();
  const sessions = [];
  let dayCursor = 0;

  for (let week = 0; week < WEEKS; week += 1) {
    for (const offset of TRAINING_OFFSETS) {
      const completedAt = new Date(firstMonday.getTime() + (week * 7 + offset) * DAY_MS);
      if (completedAt >= today) continue;
      const dayIndex = dayCursor % plan.days.length;
      dayCursor += 1;
      const day = plan.days[dayIndex];
      const prs = [];
      let totalVolume = 0;
      let completedSets = 0;

      const entries = day.exercises.map((planned) => {
        const exercise = planned.exercise;
        const reps = Number(String(planned.reps).split('-')[0]) || 8;
        // Start a little under target and add ~2.5% a week, rounded to 2.5 kg plates.
        const base = planned.weight ?? (exercise.equipment === 'BODYWEIGHT' ? 0 : 30);
        const weight = base ? Math.round((base * (0.85 + week * 0.025)) / 2.5) * 2.5 : null;
        const sets = Array.from({ length: planned.sets }, (_, i) => ({
          reps: Math.max(1, reps - (i === planned.sets - 1 && week % 3 === 0 ? 1 : 0)),
          weight,
          done: true,
        }));
        for (const set of sets) {
          completedSets += 1;
          totalVolume += (set.weight ?? 0) * set.reps;
        }
        const id = exercise._id.toString();
        if (weight && weight > (best.get(id) ?? 0)) {
          best.set(id, weight);
          prs.push({ exercise: exercise._id, exerciseName: exercise.name, weight, reps: sets[0].reps });
        }
        return {
          exercise: exercise._id,
          exerciseName: exercise.name,
          muscleGroup: exercise.muscleGroup,
          target: { sets: planned.sets, reps: planned.reps, weight: planned.weight },
          sets,
        };
      });

      const durationSeconds = 45 * 60 + ((week * 7 + offset) % 5) * 180;
      sessions.push({
        gym: member.gym,
        member: member._id,
        plan: plan._id,
        planName: plan.name,
        dayIndex,
        dayName: day.name,
        startedAt: new Date(completedAt.getTime() - durationSeconds * 1000),
        completedAt,
        durationSeconds,
        entries,
        totalVolume,
        completedSets,
        prs,
        // Marked reviewed so the backfill doesn't flood the trainer's review queue.
        review: { reviewedBy: member.trainer ?? null, reviewedAt: completedAt, comment: 'Good session, keep the progression going.' },
      });
    }
  }
  await WorkoutSession.insertMany(sessions);

  // Weekly weigh-ins drifting down ~0.3 kg a week, with a little noise.
  const metrics = Array.from({ length: WEEKS + 1 }, (_, week) => {
    const date = new Date(firstMonday.getTime() + week * 7 * DAY_MS);
    const noise = [0, 0.3, -0.2, 0.1, -0.1][week % 5];
    return {
      gym: member.gym,
      member: member._id,
      day: dayString(date),
      weight: Math.round((65.2 - week * 0.32 + noise) * 10) / 10,
      bodyFat: Math.round((24.5 - week * 0.25) * 10) / 10,
      measurements: week % 4 === 0 ? { waist: 74 - week * 0.4, hips: 96 - week * 0.2, arm: 27 + week * 0.1 } : {},
    };
  }).filter((m) => m.day < dayString(today));
  await BodyMetric.insertMany(metrics);

  return { sessions: sessions.length, metrics: metrics.length };
}

module.exports = { seedDemoProgress };
