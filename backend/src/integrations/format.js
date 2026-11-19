// Workout text shared by providers: each exercise's completed sets, then totals.

const formatWeight = (kg) => `${Number.isInteger(kg) ? kg : kg.toFixed(1)} kg`;

function workoutSummary(session) {
  const lines = session.entries
    .map((entry) => {
      const done = entry.sets.filter((s) => s.done);
      if (!done.length) return null;
      const sets = done.map((s) => (s.weight ? `${s.reps}×${formatWeight(s.weight)}` : `${s.reps}`)).join(', ');
      return `${entry.exerciseName}: ${sets}`;
    })
    .filter(Boolean);
  const totals = [`${session.completedSets} sets`];
  if (session.totalVolume > 0) totals.push(`${Math.round(session.totalVolume).toLocaleString('en-IN')} kg volume`);
  if (session.prs?.length) totals.push(`${session.prs.length} personal record${session.prs.length > 1 ? 's' : ''}`);
  return [...lines, '', totals.join(' · '), 'Logged with FitForge'].join('\n');
}

module.exports = { workoutSummary };
