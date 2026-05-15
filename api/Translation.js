const mongoose = require("mongoose")

const translationSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  translations: {
    en: String,
    pt: String,
    es: String,
  },
})

const translationModel = (collection) =>
  mongoose.models[collection] ||
  mongoose.model(collection, translationSchema, collection)

module.exports = translationModel
