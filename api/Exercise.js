const mongoose = require("mongoose");

const exerciseSchema = new mongoose.Schema({
  name: {
    en: { type: String, required: true },
    pt: { type: String, required: true },
  },
  force:    { type: String, required: true },
  level:    { type: String, required: true },
  mechanic: { type: String, required: true },
  equipment:{ type: String, required: true },
  category: { type: String, required: true },
  primaryMuscles:   { type: [String], required: true },
  secondaryMuscles: { type: [String], required: true },
  instructions: {
    en: { type: [String], required: true },
    pt: { type: [String], required: true },
  },
  images: { type: [String], required: true },
  id: { type: String, required: true, unique: true },
});

module.exports = mongoose.model("Exercise", exerciseSchema);
