// Run with: mongosh '<connection-string>/<db-name>' --file scripts/seed-translations.js
// Example:  mongosh 'mongodb+srv://user:pass@cluster0.xyz.mongodb.net/musclelib' --file scripts/seed-translations.js

try {
  db.runCommand({ ping: 1 })
  print(`✔ Connected to MongoDB successfully (database: "${db.getName()}")`)
} catch (e) {
  print("✖ Failed to connect to MongoDB: " + e.message)
  quit(1)
}

const sourceCollection = db.exercises
const sourceCount = sourceCollection.countDocuments()

if (sourceCount === 0) {
  print(`✖ No documents found in "${db.getName()}.exercises" — make sure the database name is correct in the connection string`)
  quit(1)
}

print(`✔ Found ${sourceCount} exercises in "${db.getName()}.exercises"`)

function normalizeKey(value) {
  if (!value || typeof value !== "string") return null

  return value
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^\w]/g, "")
}

function insertTranslations(targetCollection, values) {
  const uniqueMap = new Map()

  values.forEach(item => {
    if (!item?.en || !item?.pt) return
    if (typeof item.en !== "string" || typeof item.pt !== "string") return

    const key = normalizeKey(item.en)

    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, {
        key,
        translations: {
          en: item.en,
          pt: item.pt,
          es: item.en
        }
      })
    }
  })

  const docs = Array.from(uniqueMap.values())

  if (docs.length === 0) return

  db[targetCollection].createIndex({ key: 1 }, { unique: true })

  const ops = docs.map(doc => ({
    replaceOne: {
      filter: { key: doc.key },
      replacement: doc,
      upsert: true
    }
  }))

  const result = db[targetCollection].bulkWrite(ops, { ordered: false })

  print(`✔ ${targetCollection}: ${result.upsertedCount} inserted, ${result.modifiedCount} updated`)
}

const equipment = []
const force = []
const level = []
const mechanic = []
const category = []
const muscles = []

sourceCollection.find().forEach(doc => {

  if (doc.equipment?.en && doc.equipment?.pt) {
    equipment.push({ en: doc.equipment.en, pt: doc.equipment.pt })
  }

  if (doc.force?.en && doc.force?.pt) {
    force.push({ en: doc.force.en, pt: doc.force.pt })
  }

  if (doc.level?.en && doc.level?.pt) {
    level.push({ en: doc.level.en, pt: doc.level.pt })
  }

  if (doc.mechanic?.en && doc.mechanic?.pt) {
    mechanic.push({ en: doc.mechanic.en, pt: doc.mechanic.pt })
  }

  if (doc.category?.en && doc.category?.pt) {
    category.push({ en: doc.category.en, pt: doc.category.pt })
  }

  if (Array.isArray(doc.primaryMuscles?.en) && Array.isArray(doc.primaryMuscles?.pt)) {
    doc.primaryMuscles.en.forEach((muscle, index) => {
      muscles.push({ en: muscle, pt: doc.primaryMuscles.pt[index] })
    })
  }

  if (Array.isArray(doc.secondaryMuscles?.en) && Array.isArray(doc.secondaryMuscles?.pt)) {
    doc.secondaryMuscles.en.forEach((muscle, index) => {
      muscles.push({ en: muscle, pt: doc.secondaryMuscles.pt[index] })
    })
  }
})

insertTranslations("equipment_translations", equipment)
insertTranslations("force_translations", force)
insertTranslations("level_translations", level)
insertTranslations("mechanic_translations", mechanic)
insertTranslations("category_translations", category)
insertTranslations("muscle_translations", muscles)

print("✅ Translation collections seeded successfully")
