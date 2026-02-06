const express = require("express");

const listExercises = require("./routes/exercises/list");
const searchExercises = require("./routes/exercises/search");
const getExerciseImage = require("./routes/exercises/image");

const router = express.Router();

router.get("/", listExercises);
router.get("/search", searchExercises);
router.get("/:exerciseName/:imageIndex.jpg", getExerciseImage);

module.exports = router;
