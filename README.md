# Lab Experiment Console (Simulated)

**Independent prototype. Not affiliated with Periodic Labs. All experiment data is simulated.**

A console for tracking materials experiment runs: a hypothesis queue, experiment runs with
parameters and measured outcomes, a scoring view that ranks runs against a target property,
and a run detail view. Built as a product engineering showcase: clean data model, a working
add-run and update-status flow that persists, and a readable UI.

## What it does

- **Hypothesis queue**: create hypotheses with a target property, unit, and optimization
  direction (maximize, minimize, or hit a target value). Change their status as work progresses.
- **Experiment runs**: queue runs under a hypothesis with parameters (temperature, concentration,
  dwell time), move them through queued / running / completed / failed, and record measured outcomes.
- **Scoring**: completed runs are ranked against the hypothesis target. Higher score is always
  better; tied runs share a rank.
- **Run detail**: inspect one run, update its status, record its outcome.

## Data model

- `Hypothesis`: id, title, description, property, unit, direction, targetValue (hit-target only),
  status, createdAt
- `Run`: id, hypothesisId, name, parameters {temperature, concentration, dwellMinutes},
  outcome {value, unit, measuredAt} or null, status, createdAt, updatedAt
- Storage: a single local `data.json`, seeded with 4 synthetic hypotheses and 14 synthetic runs
  on first launch. Every mutation writes through to the file.

## Run it (under 2 minutes, zero dependencies)

Node 18+ required. No `npm install` needed.

```
cd prebuilt-proof/builds/periodic-labs
npm start
# open http://localhost:3000
```

Tests:

```
npm test   # node --test tests/*.test.ts, no install needed
```

Real test report, run 2026-10-19: **21 tests, 21 pass, 0 fail**
(7 store, 7 scoring, 7 server end-to-end, including a live HTTP flow: create hypothesis,
add run, update status, record outcome, score ranking, and error paths 400/404).

Also smoke-tested manually: created a run via curl, recorded an outcome, watched the scoring
table re-rank it to #1, confirmed the change persisted in data.json, then removed the smoke row.

## What is simulated vs real

- **Simulated**: every measurement. Seed outcomes come from a deterministic synthetic function,
  clearly labeled "SIMULATED DATA" in the UI banner and the README.
- **Real**: the server, the JSON persistence, the scoring math, the tests, the whole flow.
  Recording an outcome is a genuine state change, and scoring is computed from real stored data.

## Product tradeoffs I chose

- **JSON file over SQLite**: zero dependencies and the data file is human readable, which is
  the right call for a demo you hand to someone. The store is one clean class, so swapping in
  SQLite later touches one file.
- **Server-rendered single page, no framework**: the console is three panels and one page of
  vanilla JS. A framework would add install time and zero product value at this size.
- **Outcome implies completion**: recording a measured outcome automatically marks a run
  completed. That matches how a lab works: the run is done when there is data, and it keeps
  the UI from holding an impossible state.
- **Dense ranking with ties**: two identical measurements share a rank instead of an arbitrary
  tiebreak hiding behind sort order. Honest numbers beat pretty numbers.
- **No auth, no users**: deliberately out of scope. This is a lab console prototype, not a
  multi-tenant product. If you ask about it, that is the answer: single operator, local data.
