import { test } from "node:test";
import assert from "node:assert/strict";
import { createCameraTracker, stepCameraTracker } from "../lib/proctoring.ts";

function run(readings) {
  const tracker = createCameraTracker();
  const log = [];
  for (const [at, observation] of readings) {
    const { started, ended } = stepCameraTracker(tracker, observation, at);
    started.forEach((t) => log.push(`+${t}@${at}`));
    ended.forEach((t) => log.push(`-${t}@${at}`));
  }
  return log;
}

const seconds = (from, to, observation) => {
  const out = [];
  for (let s = from; s <= to; s++) out.push([s * 1000, observation]);
  return out;
};

test("one face all the time produces no incidents", () => {
  assert.deepEqual(run(seconds(0, 60, { faces: 1, phone: false, cameraOn: true })), []);
});

test("no face only counts after 5 seconds", () => {
  assert.deepEqual(run(seconds(0, 4, { faces: 0 })), []);
  assert.deepEqual(run(seconds(0, 5, { faces: 0 })), ["+no-face@5000"]);
});

test("looking away briefly resets the wait", () => {
  const log = run([...seconds(0, 4, { faces: 0 }), [5000, { faces: 1 }], ...seconds(6, 10, { faces: 0 })]);
  assert.deepEqual(log, []);
});

test("an incident is reported once and ends after 2 clear seconds", () => {
  const log = run([...seconds(0, 20, { faces: 0 }), ...seconds(21, 24, { faces: 1 })]);
  assert.deepEqual(log, ["+no-face@5000", "-no-face@23000"]);
});

test("one flicker doesn't split an incident in two", () => {
  const log = run([...seconds(0, 10, { faces: 0 }), [11000, { faces: 1 }], ...seconds(12, 20, { faces: 0 })]);
  assert.deepEqual(log, ["+no-face@5000"]);
});

test("two faces count after 3 seconds and not as no-face", () => {
  assert.deepEqual(run(seconds(0, 3, { faces: 2 })), ["+multiple-faces@3000"]);
});

test("phone checked less often keeps its last reading between checks", () => {
  const log = run([
    [0, { faces: 1, phone: true }],
    [1000, { faces: 1 }],
    [2000, { faces: 1 }],
    [3000, { faces: 1, phone: true }],
  ]);
  assert.deepEqual(log, ["+phone@3000"]);
});

test("a single phone sighting that clears isn't reported", () => {
  const log = run([[0, { phone: true }], [3000, { phone: false }], [6000, { phone: false }]]);
  assert.deepEqual(log, []);
});

test("camera off is reported instead of a missing face", () => {
  const log = run(seconds(0, 8, { faces: 0, cameraOn: false }));
  assert.deepEqual(log, ["+camera-off@5000"]);
});

test("camera coming back ends the incident", () => {
  const log = run([...seconds(0, 6, { cameraOn: false }), ...seconds(7, 10, { cameraOn: true, faces: 1 })]);
  assert.deepEqual(log, ["+camera-off@5000", "-camera-off@9000"]);
});
