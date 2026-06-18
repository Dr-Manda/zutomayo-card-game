#!/usr/bin/env node
// Resize every card scan in public/cards/*.jpg down to a 480px-wide JPEG
// (quality 70) under public/cards/thumbs/. Source scans are 700×978 / ~361 KB
// each (~150 MB total) which is wasted bandwidth on the 117–234px cells the
// gallery grid, hand drawer, player field, and reveal screen render — only
// the gallery Spotlight (up to ~656px tall) needs the full-res source. With
// 2× DPR headroom 480px stays sharp at every site we point at it.
//
// Idempotent — overwrites existing thumbs each run, so re-running after
// adding new scans is safe. Skip-if-exists would silently miss source edits.

import { readdir, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC_DIR = join(__dirname, '..', 'public', 'cards')
const OUT_DIR = join(SRC_DIR, 'thumbs')
const WIDTH = 480
const QUALITY = 70

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const entries = await readdir(SRC_DIR)
  const cardFiles = entries.filter((f) => /^zutomayocard_.*\.jpg$/i.test(f))

  if (cardFiles.length === 0) {
    console.error(`No card scans matched in ${SRC_DIR}`)
    process.exit(1)
  }

  console.log(
    `make-thumbs: ${cardFiles.length} sources → ${WIDTH}px @ q${QUALITY} → ${OUT_DIR}`,
  )

  let done = 0
  for (const file of cardFiles) {
    const src = join(SRC_DIR, file)
    const dst = join(OUT_DIR, file)
    await sharp(src).resize({ width: WIDTH }).jpeg({ quality: QUALITY }).toFile(dst)
    done++
    if (done % 50 === 0 || done === cardFiles.length) {
      console.log(`  ${done}/${cardFiles.length}`)
    }
  }
  console.log('make-thumbs: done')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
