# scroll-scene-kit

A small, reusable site template for scroll-scrubbed scenes. One brand object restyles the page. One scene manifest lists the pictures, clips, and copy. The first skin is a demo for [Music for Vegans](https://music-for-vegans.vercel.app): a playful vegan-food-themed music project.

Songs for the garden, the skillet, and the dance floor.

## Demo index

The live page is the demo. Deep links land on a scene:

| Scene | Link |
| --- | --- |
| Cover | https://scroll-scene-kit-sasha-bayans-projects.vercel.app/#top |
| Sprout | https://scroll-scene-kit-sasha-bayans-projects.vercel.app/#sprout |
| Market | https://scroll-scene-kit-sasha-bayans-projects.vercel.app/#market |
| Chop | https://scroll-scene-kit-sasha-bayans-projects.vercel.app/#chop |
| Simmer | https://scroll-scene-kit-sasha-bayans-projects.vercel.app/#simmer |
| Platter | https://scroll-scene-kit-sasha-bayans-projects.vercel.app/#platter |
| Encore | https://scroll-scene-kit-sasha-bayans-projects.vercel.app/#encore |
| Finale | https://scroll-scene-kit-sasha-bayans-projects.vercel.app/#finale |

The footer on the page repeats the same index.

## Quick start

```bash
npm install
npm run dev
```

`npm test` checks the scroll math and the still/video fallback rules. `npm run build` typechecks and writes `dist/`.

## Make a new site

1. Copy this repo.
2. Edit `src/brand.ts`. That one object sets the name, tagline, palette, fonts, logo, wordmark, links, and cover.
3. Edit `src/scenes.ts`. Each scene has an id, title, copy, still, poster, optional desktop and mobile clips, an optional loop, an optional audio cue, an accent, and a scroll weight.
4. Replace the files in `public/media` (and `public/mark.svg` if you want a new mark). Keep the paths in the manifest, or change both together.
5. Update the title, description, and font preloads in `index.html`, plus the short `<noscript>` block.
6. If the finale signature should change, replace `src/wordmark.ts` (or regenerate it with `npm run wordmark` after pointing `tools/build_wordmark.py` at another font).
7. Deploy. Vercel detects the Vite build. `vercel.json` only adds cache and security headers.

Scroll weights are viewport-heights of travel. A weight of `1.4` means about one and a half screens of scrubbing for that scene.

## How it scrolls

`src/engine/director.ts` runs one `requestAnimationFrame` loop. Scroll listeners only ask for the next frame. Each frame:

- Maps scroll through the sticky film to a global 0–1 progress, then to a local 0–1 `--p` on the active scene.
- Crossfades neighboring scenes by writing `--fade`. In the overlap, the outgoing plate and the incoming plate add up to 1.
- Seeks `video.currentTime` from `--p` for scenes near the viewport. Clips are all-intra H.264 so seeks land on the intended frame. Desktop and mobile files are chosen with a `max-width: 760px` query and loaded only when the scene is close.
- Toggles `[data-at]` when local progress passes the threshold, and lazy-plays `[data-loop]` videos with an `IntersectionObserver`.
- Draws the finale SVG by setting `stroke-dashoffset` from each path’s length, lag, and span. The filled wordmark fades in near the end.
- Optionally emits a canvas particle field and, after the listener opts in, an ambient loop plus a short cue per scene. Sound stays off until that click.

Stills sit under the video. `prefers-reduced-motion`, Save-Data, and `2g` / `slow-2g` skip video, particles, and the crossfade, and show the stills with every line of copy visible.

## Media pipeline

The Music for Vegans pictures are drawn in `tools/render_media.py` (Pillow) and encoded with ffmpeg. They are original flat illustrations, not frames from anywhere else. To regenerate:

```bash
pip install -r tools/requirements.txt
python3 tools/render_media.py --preview --scale 1   # tmp/preview
python3 tools/render_media.py                       # public/media
```

Bring your own stills and clips instead if you prefer. Posters should match the first moments of a clip. Stills should be the picture you want when video never loads. Aim to keep `public/media` modest; this demo stays under 20 MB.

## Fonts

Fraunces and Outfit are shipped as WOFF2 under the SIL Open Font License (`public/fonts/*-OFL.txt`). The finale script is Caveat, also SIL OFL, converted to paths in `src/wordmark.ts`. The font file used to generate those paths is `tools/fonts/Caveat-700.woff`.
