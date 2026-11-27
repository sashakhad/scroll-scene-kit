import assert from "node:assert/strict"
import { test } from "node:test"
import { chooseMode } from "./mode.ts"

test("video is the default when motion and the network are fine", function video(): void {
  assert.equal(
    chooseMode({ reducedMotion: false, saveData: false, effectiveType: "4g" }),
    "video",
  )
})

test("reduced motion falls back to stills", function reduced(): void {
  assert.equal(
    chooseMode({ reducedMotion: true, saveData: false, effectiveType: "4g" }),
    "still",
  )
})

test("save-data falls back to stills", function saveData(): void {
  assert.equal(
    chooseMode({ reducedMotion: false, saveData: true, effectiveType: "4g" }),
    "still",
  )
})

test("slow networks fall back to stills", function slow(): void {
  assert.equal(
    chooseMode({ reducedMotion: false, saveData: false, effectiveType: "2g" }),
    "still",
  )
  assert.equal(
    chooseMode({ reducedMotion: false, saveData: false, effectiveType: "slow-2g" }),
    "still",
  )
})

test("an unknown connection type still gets video", function unknown(): void {
  assert.equal(
    chooseMode({ reducedMotion: false, saveData: false, effectiveType: null }),
    "video",
  )
})
