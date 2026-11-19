const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const loggedSetSchema = new mongoose.Schema(
  {
    reps: { type: Number, required: true, min: 0 },
    weight: { type: Number, default: null, min: 0 },
    done: { type: Boolean, default: true },
  },
  { _id: false }
);

const entrySchema = new mongoose.Schema(
  {
    exercise: { type: ObjectId, ref: 'Exercise', required: true },
    // Snapshots, so history still reads correctly if the exercise or plan changes later.
    exerciseName: { type: String, required: true },
    muscleGroup: { type: String, required: true },
    target: { sets: Number, reps: String, weight: Number },
    sets: { type: [loggedSetSchema], default: [] },
  },
  { _id: false }
);

const workoutSessionSchema = new mongoose.Schema(
  {
    gym: { type: ObjectId, ref: 'Gym', required: true, index: true },
    member: { type: ObjectId, ref: 'User', required: true, index: true },
    plan: { type: ObjectId, ref: 'WorkoutPlan', default: null, index: true },
    planName: { type: String, required: true },
    dayIndex: { type: Number, required: true, min: 0 },
    dayName: { type: String, required: true },
    // The app's id for this workout (see the session validator); null for older records.
    clientId: { type: String, default: null },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date, required: true, index: true },
    durationSeconds: { type: Number, required: true, min: 0 },
    entries: { type: [entrySchema], default: [] },
    notes: { type: String, default: '', maxlength: 500 },
    // Copies sent to connected fitness services (src/integrations), one entry per provider.
    exports: {
      type: [
        new mongoose.Schema(
          {
            provider: { type: String, required: true },
            status: { type: String, enum: ['uploaded', 'failed'], required: true },
            externalId: { type: String, default: null },
            url: { type: String, default: null },
            error: { type: String, default: null },
            at: { type: Date, default: Date.now },
          },
          { _id: false }
        ),
      ],
      default: [],
    },
    // Derived when the session is saved.
    totalVolume: { type: Number, default: 0 },
    completedSets: { type: Number, default: 0 },
    prs: {
      type: [{ _id: false, exercise: ObjectId, exerciseName: String, weight: Number, reps: Number }],
      default: [],
    },
    review: {
      reviewedBy: { type: ObjectId, ref: 'User', default: null },
      reviewedAt: { type: Date, default: null },
      comment: { type: String, default: '' },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

workoutSessionSchema.index({ member: 1, completedAt: -1 });
// One workout per app id per member, so retried uploads can't create duplicates.
workoutSessionSchema.index(
  { member: 1, clientId: 1 },
  { unique: true, partialFilterExpression: { clientId: { $type: 'string' } } }
);
workoutSessionSchema.index({ member: 1, 'entries.exercise': 1 });

module.exports = mongoose.model('WorkoutSession', workoutSessionSchema);
