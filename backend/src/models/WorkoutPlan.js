const mongoose = require('mongoose');

const { ObjectId } = mongoose.Schema.Types;

const planExerciseSchema = new mongoose.Schema(
  {
    exercise: { type: ObjectId, ref: 'Exercise', required: true },
    sets: { type: Number, required: true, min: 1, max: 10 },
    // A string so ranges like "8-12" work.
    reps: { type: String, required: true },
    weight: { type: Number, default: null, min: 0 },
    restSeconds: { type: Number, default: 90, min: 0 },
    notes: { type: String, default: '', maxlength: 200 },
  },
  { _id: false }
);

const planDaySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    exercises: { type: [planExerciseSchema], default: [] },
  },
  { _id: false }
);

const workoutPlanSchema = new mongoose.Schema(
  {
    gym: { type: ObjectId, ref: 'Gym', required: true, index: true },
    createdBy: { type: ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: '', maxlength: 500 },
    days: { type: [planDaySchema], default: [] },
    // Members following this plan. One plan can be shared by several clients.
    assignedTo: { type: [{ type: ObjectId, ref: 'User' }], default: [], index: true },
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

module.exports = mongoose.model('WorkoutPlan', workoutPlanSchema);
