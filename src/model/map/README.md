# Local map models

This folder groups the model code for a run's local map: map geometry and
presentation measurements (`mapview.js`), player exploration and fog knowledge
(`mapknowledge.js`), and stable map references (`mapReferences.js`). These
modules own data and calculations; map screens and components remain in
`src/ui`, while run orchestration stays in the engine.
