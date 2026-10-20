# Walkthrough: Lab Experiment Console (Simulated)

Independent prototype, not affiliated with Periodic Labs. All data simulated. 5 bullets for the interview.

## 1. Hypothesis first, runs second
The data model mirrors how experiments are actually planned: a hypothesis (target property,
unit, direction: maximize / minimize / hit-target) owns a queue of runs with concrete
parameters (temperature, concentration, dwell time). Runs cannot exist without a hypothesis,
and the server rejects unknown hypothesis IDs with a 404. Structure before data.

## 2. State changes are real and persisted
Add a run, move it from queued to running to completed, record an outcome: every mutation
writes through to data.json immediately. I verified this two ways: the automated store tests
reopen the file in a fresh instance and read the row back, and I smoke-tested the live
server with curl and grepped the JSON. Nothing is held in memory-only state.

## 3. Scoring is one small, testable function
`src/scoring.ts` is 30 lines: filter to completed runs with outcomes under that hypothesis,
score by direction (raw value, negated value, or negative distance to target), sort
descending, assign dense ranks so ties share a rank. Seven tests cover all three directions,
ties, exclusions, and cross-hypothesis isolation. Small pure functions are where the
correctness lives.

## 4. Impossible states are designed out, not validated later
Recording an outcome auto-marks a run completed; a hit-target hypothesis cannot be created
without a target value. The domain rules sit in the store layer, so the API and the UI get
them for free instead of re-checking.

## 5. Zero-dependency, 2-minute run
Node stdlib only: http server, node:test, native type stripping. No install step means the
first thing a reviewer does is run it, not debug my node_modules. The tradeoff I name
openly: this is a single-operator local console, not a multi-tenant product; auth and
concurrency were deliberately left out.

## Likely follow-ups and honest answers

- "Why a JSON file instead of a database?" Human readable demo data, zero setup, and the
  store is one class so swapping in SQLite later is a one-file change. For a real multi-user
  lab console I would use Postgres and say so.
- "How does scoring handle a run with no outcome?" It excludes it. Only completed runs with
  measured outcomes are eligible; the ranking endpoint never invents numbers.
- "Why does the outcome auto-complete the run?" A run is done when there is data. It keeps
  the UI from representing a state that cannot exist in a lab.
- "What breaks with two people editing at once?" Last write wins on the JSON file. Fine
  for a demo; a real version needs row-level writes and optimistic locking.
- "Is this connected to Periodic Labs?" No. Independent prototype built from a generic
  description of their space, AI-driven autonomous materials labs. Every measurement is
  synthetic and labeled as such.
