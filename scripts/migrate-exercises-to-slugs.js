// Run with: mongosh '<connection-string>/musclelib' --file scripts/migrate-exercises-to-slugs.js
// IMPORTANT: take a full MongoDB backup before running this script.

try {
  db.runCommand({ ping: 1 })
  print(`✔ Connected to MongoDB (database: "${db.getName()}")`)
} catch (e) {
  print("✖ Failed to connect: " + e.message)
  quit(1)
}

const count = db.exercises.countDocuments()
if (count === 0) {
  print(`✖ No documents found in "${db.getName()}.exercises"`)
  quit(1)
}
print(`✔ Found ${count} exercises`)

function toSlug(value) {
  if (!value || typeof value !== "string") return null
  return value.toLowerCase().replace(/\s+/g, "_").replace(/[^\w]/g, "")
}

let migrated = 0
let skipped = 0

db.exercises.find().forEach(doc => {
  // Skip documents already migrated (force is a string, not an object)
  if (typeof doc.force === "string") {
    skipped++
    return
  }

  db.exercises.updateOne({ _id: doc._id }, {
    $set: {
      force:            toSlug(doc.force?.en),
      level:            toSlug(doc.level?.en),
      mechanic:         toSlug(doc.mechanic?.en),
      equipment:        toSlug(doc.equipment?.en),
      category:         toSlug(doc.category?.en),
      primaryMuscles:   Array.isArray(doc.primaryMuscles?.en)
        ? doc.primaryMuscles.en.map(toSlug).filter(Boolean)
        : [],
      secondaryMuscles: Array.isArray(doc.secondaryMuscles?.en)
        ? doc.secondaryMuscles.en.map(toSlug).filter(Boolean)
        : [],
    },
    $unset: { __v: "" },
  })
  migrated++
})

print(`✔ Migrated: ${migrated}, already migrated (skipped): ${skipped}`)

// Verify no orphan slugs
print("\n--- Verifying slug integrity ---")
const fieldChecks = [
  { field: "force",     collection: "force_translations" },
  { field: "level",     collection: "level_translations" },
  { field: "mechanic",  collection: "mechanic_translations" },
  { field: "equipment", collection: "equipment_translations" },
  { field: "category",  collection: "category_translations" },
]

let orphans = 0
fieldChecks.forEach(({ field, collection }) => {
  db.exercises.distinct(field).forEach(slug => {
    if (!db[collection].findOne({ key: slug })) {
      print(`  MISSING ${field} slug "${slug}" in ${collection}`)
      orphans++
    }
  })
  print(`  ✔ ${field} — OK`)
})

const muscleOrphans = []
db.exercises.distinct("primaryMuscles").concat(db.exercises.distinct("secondaryMuscles"))
  .forEach(slug => {
    if (!db.muscle_translations.findOne({ key: slug })) {
      if (!muscleOrphans.includes(slug)) {
        print(`  MISSING muscle slug "${slug}" in muscle_translations`)
        muscleOrphans.push(slug)
        orphans++
      }
    }
  })
if (muscleOrphans.length === 0) print("  ✔ muscles — OK")

if (orphans === 0) {
  print("\n✅ Migration complete — no orphan slugs found")
} else {
  print(`\n⚠ Migration complete with ${orphans} orphan slug(s) — insert missing translations before deploying`)
}
