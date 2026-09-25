#!/usr/bin/env node
// Finds user-facing English still hardcoded in explorer/src.
//
// tsc already guarantees that every t() key exists in the catalogues. What it
// cannot see is the opposite direction: a string that was never routed through
// t() at all. That is exactly what an upstream merge introduces, so run this
// after every merge:
//
//   node scripts/find-untranslated.mjs
//
// Intentional exceptions live in scripts/untranslated-allow.json, each with a
// reason. A finding that is genuinely data (an API field, a sample query, a
// thrown Error) belongs there; anything else needs translating.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');
const allowPath = join(root, 'scripts', 'untranslated-allow.json');

const allow = existsSync(allowPath) ? JSON.parse(readFileSync(allowPath, 'utf8')) : { strings: {}, files: {} };
const allowedStrings = new Set(Object.keys(allow.strings ?? {}));
const allowedFiles = new Set(Object.keys(allow.files ?? {}));

// JSX text nodes and the string props that actually render to the user.
const JSX_TEXT = />\s*([A-Z][^<>{}\n]{2,120}?)\s*</g;
const UI_PROP = /\b(placeholder|title|aria-label|ariaLabel|alt|label)\s*=\s*"([^"]{3,160})"/g;
const OBJ_LABEL = /\b(label|ariaLabel|title|placeholder)\s*:\s*"([^"]{3,160})"/g;

// Lines that are definitionally not UI copy.
const SKIP_LINE = /(^\s*(\/\/|\*|\/\*))|console\.|throw new Error|new Error\(|import\s|from\s+["']|require\(|\.test\(|describe\(|it\(/;

const isProse = (s) => /[A-Za-z]{2,}/.test(s) && /^[\x20-\x7E]+$/.test(s);

// Product names, standards, formats and code-ish tokens stay in English.
const INTRINSIC = /^(Semantica|SPARQL|SHACL|SKOS|OWL|RDF|RDFS|PROV-O|Markdown|JSON|JSON-LD|CSV|TSV|XML|YAML|Turtle|N-Triples|RDF\/XML|AgentMemory|Neo4j|FalkorDB|Oxigraph|Cypher|Datalog|URI|URL|IRI|API|KG|HTTP|HTTPS|UTF-8|ID|UUID|CRUD|owl:\w+|skos:\w+|rdf:\w+|rdfs:\w+|sh:\w+|[\w.-]+\.(ttl|rdf|owl|json|csv|jsonld|nt)|[\d\s.,%:/+\-–—()[\]]+)$/i;

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry === 'i18n' || entry === 'assets') continue;
      yield* walk(full);
    } else if (/\.tsx?$/.test(entry) && !entry.endsWith('.d.ts')) {
      yield full;
    }
  }
}

const findings = [];

for (const file of walk(srcDir)) {
  const rel = relative(root, file);
  if (allowedFiles.has(rel)) continue;
  const lines = readFileSync(file, 'utf8').split('\n');

  lines.forEach((line, i) => {
    if (SKIP_LINE.test(line)) return;
    const hits = [];
    for (const m of line.matchAll(JSX_TEXT)) hits.push(m[1]);
    for (const m of line.matchAll(UI_PROP)) hits.push(m[2]);
    for (const m of line.matchAll(OBJ_LABEL)) hits.push(m[2]);

    for (const raw of hits) {
      const s = raw.trim();
      if (!s || !isProse(s) || INTRINSIC.test(s)) continue;
      if (allowedStrings.has(s)) continue;
      // A single capitalised word is usually a type/enum value from data.
      if (!/\s/.test(s) && !/[.?!:]$/.test(s)) continue;
      findings.push({ file: rel, line: i + 1, text: s });
    }
  });
}

if (process.argv.includes('--write-allow')) {
  const next = { ...allow, strings: { ...(allow.strings ?? {}) } };
  for (const f of findings) next.strings[f.text] ??= `TODO: why is this not translated? (${f.file}:${f.line})`;
  writeFileSync(allowPath, JSON.stringify(next, null, 2) + '\n');
  console.log(`wrote ${findings.length} finding(s) into ${relative(root, allowPath)} — replace every TODO with a real reason, or translate the string instead`);
  process.exit(0);
}

console.log(`scanned ${srcDir.replace(root + '/', '')} — ${allowedStrings.size} allowlisted string(s), ${allowedFiles.size} allowlisted file(s)`);
if (!findings.length) {
  console.log('✓ no untranslated user-facing strings');
  process.exit(0);
}

console.error(`\n✗ ${findings.length} possibly untranslated string(s):`);
for (const f of findings) console.error(`  ${f.file}:${f.line}  ${JSON.stringify(f.text)}`);
console.error('\nTranslate them, or record an exception with a reason:');
console.error('  node scripts/find-untranslated.mjs --write-allow');
process.exit(1);
