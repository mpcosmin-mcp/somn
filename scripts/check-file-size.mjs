#!/usr/bin/env node
/**
 * Poka-yoke file-size gate (ARCHITECTURE.md §1: 300 target / 500 gate).
 *
 * Pre-commit: for each STAGED .ts/.tsx file, count effective lines (skip blank +
 * comment-only). Then:
 *   - ≥ 500 AND grew vs HEAD  → FAIL the commit ("split before extending").
 *   - ≥ 500 but shrank/equal  → pass (refactor commits must flow through).
 *   - 300–499                 → warn only (kaizen target, never blocks).
 *   - untouched legacy files  → never checked (the gate ratchets debt DOWN,
 *                                it never blocks work on code you didn't touch).
 *
 * Exemptions (data / generated / vendored — length is inherent, not a smell):
 *   lib/db/schema.ts, **­/demo.ts, fixtures*, *labResults*, .agents/**, scripts/seed*.
 * Inline escape hatch: a file containing `eslint-disable max-lines` is skipped.
 *
 * Modes:
 *   node scripts/check-file-size.mjs           # gate staged files (pre-commit)
 *   node scripts/check-file-size.mjs --all      # audit the whole repo (report only)
 *
 * Zero dependencies (node built-ins). Wired via `.githooks/pre-commit` +
 * `git config core.hooksPath .githooks`.
 */
import { execSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'

const TARGET = 300
const GATE = 500
const EXEMPT = [
  /(^|\/)lib\/db\/schema\.ts$/,
  /(^|\/)demo\.ts$/,
  /(^|\/)fixtures?[.\/]/,
  /labResults/i,
  /(^|\/)\.agents\//,
  /(^|\/)scripts\/seed/,
]

const isExempt = (f) => EXEMPT.some((re) => re.test(f))

/** Effective line count: drop blank lines and comment-only lines. */
function effectiveLines(text) {
  let inBlock = false
  let n = 0
  for (let raw of text.split('\n')) {
    const line = raw.trim()
    if (inBlock) { if (line.includes('*/')) inBlock = false; continue }
    if (line === '') continue
    if (line.startsWith('//')) continue
    if (line.startsWith('/*')) { if (!line.includes('*/')) inBlock = true; continue }
    if (line.startsWith('*')) continue
    n++
  }
  return n
}

function headEffective(path) {
  try {
    const prev = execSync(`git show HEAD:"${path}"`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
    return effectiveLines(prev)
  } catch {
    return 0 // new file → any size counts as "grew"
  }
}

function stagedFiles() {
  const out = execSync('git diff --cached --name-only --diff-filter=ACM', { encoding: 'utf8' })
  return out.split('\n').map((s) => s.trim()).filter((f) => /\.(ts|tsx)$/.test(f))
}

function allFiles() {
  const out = execSync('git ls-files "*.ts" "*.tsx"', { encoding: 'utf8' })
  return out.split('\n').map((s) => s.trim()).filter(Boolean)
}

const AUDIT = process.argv.includes('--all')
const files = (AUDIT ? allFiles() : stagedFiles()).filter((f) => existsSync(f) && !isExempt(f))

const failures = []
const warnings = []
const over = [] // for audit

for (const f of files) {
  const text = readFileSync(f, 'utf8')
  if (/eslint-disable\s+max-lines/.test(text)) continue
  const n = effectiveLines(text)
  if (AUDIT) { if (n >= TARGET) over.push([n, f]); continue }
  if (n >= GATE && n > headEffective(f)) failures.push([n, f])
  else if (n >= TARGET) warnings.push([n, f])
}

if (AUDIT) {
  over.sort((a, b) => b[0] - a[0])
  console.log(`\nFiles ≥ ${TARGET} effective lines (${over.length}):`)
  for (const [n, f] of over) console.log(`  ${n >= GATE ? '🔴' : '🟠'} ${String(n).padStart(4)}  ${f}`)
  console.log(`\n300 target · 500 gate · 🔴 = over gate.\n`)
  process.exit(0)
}

for (const [n, f] of warnings) console.warn(`  ⚠️  ${f} — ${n} lines (target ${TARGET}; split soon)`)

if (failures.length) {
  console.error(`\n❌ File-size gate (ARCHITECTURE.md §1 — 500 line gate):`)
  for (const [n, f] of failures) console.error(`   ${f} — ${n} lines and growing. Split at its seams before extending.`)
  console.error(`\n   (Refactor that SHRINKS a big file passes. Genuine exception: add \`// eslint-disable max-lines -- reason\`.)\n`)
  process.exit(1)
}
process.exit(0)
