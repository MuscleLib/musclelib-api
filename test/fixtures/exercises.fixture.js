const buildExercise = (overrides = {}) => ({
  _id: "677471841533c77a3a55b4ff",
  name: { en: "Plyo Kettlebell Pushups", pt: "Flexoes com Kettlebell" },
  force: { en: "push", pt: "empurrar" },
  level: { en: "expert", pt: "avancado" },
  mechanic: { en: "compound", pt: "composto" },
  equipment: { en: "kettlebells", pt: "kettlebells" },
  primaryMuscles: { en: ["chest"], pt: ["peito"] },
  secondaryMuscles: { en: ["shoulders", "triceps"], pt: ["ombros", "triceps"] },
  instructions: {
    en: ["Place a kettlebell on the floor."],
    pt: ["Coloque um kettlebell no chao."],
  },
  category: { en: "strength", pt: "forca" },
  images: ["Plyo_Kettlebell_Pushups/0.jpg", "Plyo_Kettlebell_Pushups/1.jpg"],
  id: "Plyo_Kettlebell_Pushups",
  __v: 0,
  ...overrides,
});

const exercisesFixture = [
  {
    _id: "1",
    id: "1",
    name: { en: "Bench Press", pt: "Supino Reto" },
    force: { en: "Push", pt: "Empurrar" },
    level: { en: "Intermediate", pt: "IntermediÃ¡rio" },
    mechanic: { en: "Compound", pt: "Composto" },
    equipment: { en: "Barbell", pt: "Barra" },
    primaryMuscles: { en: ["Chest"], pt: ["Peito"] },
    secondaryMuscles: { en: ["Triceps"], pt: ["TrÃ­ceps"] },
    instructions: { en: ["Lie down..."], pt: ["Deite-se..."] },
    category: { en: "Strength", pt: "ForÃ§a" },
  },
  {
    _id: "2",
    id: "2",
    name: { en: "Squat", pt: null },
    force: { en: "Push", pt: null },
    level: { en: "Beginner", pt: null },
    mechanic: { en: "Compound", pt: null },
    equipment: { en: "Barbell", pt: null },
    primaryMuscles: { en: ["Legs"], pt: null },
    secondaryMuscles: { en: ["Glutes"], pt: null },
    instructions: { en: ["Stand..."], pt: null },
    category: { en: "Strength", pt: null },
  },
];

module.exports = {
  buildExercise,
  exercisesFixture,
};
