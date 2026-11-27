import assert from "node:assert/strict"
import { test } from "node:test"
import {
  clamp,
  localProgress,
  plateOpacity,
  sceneSpans,
  scrollProgress,
  stillOpacity,
} from "./math.ts"

test("clamp stays inside the range", function range(): void {
  assert.equal(clamp(-1, 0, 1), 0)
  assert.equal(clamp(0.4, 0, 1), 0.4)
  assert.equal(clamp(2, 0, 1), 1)
})

test("scene spans cover 0 to 1 in weight order", function spans(): void {
  const result = sceneSpans([
    { id: "a", weight: 1 },
    { id: "b", weight: 3 },
  ])
  assert.equal(result.length, 2)
  assert.equal(result[0]?.id, "a")
  assert.equal(result[0]?.start, 0)
  assert.equal(result[0]?.end, 0.25)
  assert.equal(result[1]?.start, 0.25)
  assert.equal(result[1]?.end, 1)
})

test("scroll progress is zero when the film is not taller than the viewport", function shortFilm(): void {
  assert.equal(scrollProgress(100, 0, 800, 800), 0)
})

test("scroll progress maps the film travel", function travel(): void {
  assert.equal(scrollProgress(200, 100, 1100, 100), 0.1)
})

test("local progress is the position inside one span", function local(): void {
  assert.ok(Math.abs(localProgress(0.25, 0.2, 0.4) - 0.25) < 1e-9)
  assert.equal(localProgress(0, 0.2, 0.4), 0)
  assert.equal(localProgress(1, 0.2, 0.4), 1)
})

test("crossfade opacities meet at one half on the boundary", function crossfade(): void {
  const fade = 0.02
  const boundary = 0.4
  const leaving = plateOpacity(boundary, 0.2, boundary, fade, { enter: true, exit: true })
  const arriving = plateOpacity(boundary, boundary, 0.7, fade, { enter: true, exit: true })
  assert.ok(Math.abs(leaving - 0.5) < 0.0001)
  assert.ok(Math.abs(arriving - 0.5) < 0.0001)
  assert.ok(Math.abs(leaving + arriving - 1) < 0.0001)
})

test("crossfade opacities sum to one inside the overlap", function overlap(): void {
  const fade = 0.02
  const boundary = 0.4
  const global = boundary - fade * 0.5
  const leaving = plateOpacity(global, 0.2, boundary, fade, { enter: true, exit: true })
  const arriving = plateOpacity(global, boundary, 0.7, fade, { enter: true, exit: true })
  assert.ok(Math.abs(leaving + arriving - 1) < 0.0001)
  assert.ok(leaving > arriving)
})

test("the first plate is fully visible at the start and the last at the end", function edges(): void {
  const fade = 0.03
  const first = plateOpacity(0, 0, 0.2, fade, { enter: false, exit: true })
  const last = plateOpacity(1, 0.8, 1, fade, { enter: true, exit: false })
  assert.equal(first, 1)
  assert.equal(last, 1)
})

test("still mode cuts on the boundary without a gap", function cuts(): void {
  assert.equal(stillOpacity(0.5, 0.25, 0.5, false), 0)
  assert.equal(stillOpacity(0.5, 0.5, 0.75, false), 1)
  assert.equal(stillOpacity(1, 0.8, 1, true), 1)
})
