#!/usr/bin/env node
// Catalogue checks that tsc cannot do: en/zh key parity, empty or untranslated
// values, placeholder mismatches, and glossary drift across namespaces.
//
//   node scripts/check-i18n.mjs

import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const localesDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'i18n', 'locales');

// The same English term must render the same way everywhere in the UI.
const GLOSSARY = {
  ontology: '本体',
  provenance: '溯源',
  lineage: '血缘',
  vocabulary: '词表',
  decision: '决策',
  workspace: '工作区',
  registry: '注册表',
  snapshot: '快照',
  alignment: '对齐',
  neighborhood: '邻域',
  region: '分区',
};

// Terms a translator is likely to render with a plausible but wrong word.
// Each entry: the English trigger, the wrong Chinese, and why it is wrong.
const MISTRANSLATIONS = [
  { en: /\bbinary\b/i, wrong: '二进制', reason: 'a binary fact is an arity-2 predicate (二元), not the binary number system' },
  { en: /\bnarrower\b/i, wrong: /更窄|更狭义/, reason: 'SKOS narrower is 下位概念' },
  { en: /\bbroader\b.*\b(concept|term|skos)\b/i, wrong: /更宽泛|更广的概念/, reason: 'SKOS broader is 上位概念' },
  { en: /\bAgentMemory\b/, wrong: '代理记忆', reason: 'AgentMemory is a product concept name and stays in Latin script' },
  { en: /\bproperty\b/i, wrong: '财产', reason: 'an RDF/OWL property is 属性' },
  { en: /\bclass\b/i, wrong: '课程', reason: 'an OWL class is 类' },
  { en: /\bshape\b/i, wrong: '形态', reason: 'a SHACL shape is 形状' },
  { en: /\brange\b/i, wrong: '范围值', reason: 'an RDF property range is 值域' },
  { en: /\bdomain\b/i, wrong: '域名', reason: 'an RDF property domain is 定义域' },
  { en: /\bliteral\b/i, wrong: '字面上', reason: 'an RDF literal is 字面量' },
];

// Keys where an empty zh value is intentional, with the reason.
const EMPTY_ZH_ALLOWED = new Set([
  // The English hero title splits as "Navigate knowledge / like a <living system.>";
  // the Chinese title is a single clause, so the connector has no counterpart.
  'common.json:landing.titleLine2Prefix',
]);

const flatten = (obj, prefix = '') =>
  Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? flatten(v, `${prefix}${k}.`)
      : [[`${prefix}${k}`, v]],
  );

const placeholders = (s) =>
  [...String(s).matchAll(/\{\{(\w+)[^}]*\}\}/g)].map((m) => m[1]).sort().join(',');

const problems = [];
const namespaces = readdirSync(join(localesDir, 'en')).filter((f) => f.endsWith('.json'));
let totalKeys = 0;

for (const ns of namespaces) {
  const en = Object.fromEntries(flatten(JSON.parse(readFileSync(join(localesDir, 'en', ns), 'utf8'))));
  const zh = Object.fromEntries(flatten(JSON.parse(readFileSync(join(localesDir, 'zh', ns), 'utf8'))));
  const enKeys = Object.keys(en);
  totalKeys += enKeys.length;

  for (const k of enKeys) {
    if (!(k in zh)) problems.push(`${ns}: key missing from zh — ${k}`);
  }
  for (const k of Object.keys(zh)) {
    if (!(k in en)) problems.push(`${ns}: key only in zh — ${k}`);
  }

  for (const k of enKeys) {
    if (!(k in zh)) continue;
    const e = en[k];
    const z = zh[k];

    if (typeof e !== 'string' || typeof z !== 'string') {
      problems.push(`${ns}: non-string value — ${k}`);
      continue;
    }
    if (!e.trim()) problems.push(`${ns}: empty en value — ${k}`);
    // An empty zh is only legitimate when en is empty too, or when the key is
    // an explicitly justified exception.
    if (!z.trim() && e.trim() && !EMPTY_ZH_ALLOWED.has(`${ns}:${k}`)) {
      problems.push(`${ns}: empty zh value — ${k}`);
    }

    if (placeholders(e) !== placeholders(z)) {
      problems.push(`${ns}: placeholder mismatch — ${k}  en{${placeholders(e)}} zh{${placeholders(z)}}`);
    }

    // zh identical to en with no CJK is usually a string that was never translated.
    // Pure product names / acronyms are legitimately identical, so only flag
    // values that contain lowercase prose.
    if (z === e && !/[一-鿿]/.test(z) && /[a-z]{3,}\s+[a-z]{3,}/.test(z)) {
      problems.push(`${ns}: zh appears untranslated — ${k} = "${z}"`);
    }

    // Glossary matching ignores interpolation placeholders (the variable name
    // is not prose) and hyphen-joined compounds such as "upper-ontology",
    // which are literal tag/identifier examples rather than translatable words.
    const prose = e.replace(/\{\{[^}]*\}\}/g, ' ');
    for (const [term, expected] of Object.entries(GLOSSARY)) {
      const mentioned = new RegExp(`(^|[^\\w-])${term}($|[^\\w-])`, 'i').test(prose);
      if (mentioned && /[一-鿿]/.test(z) && !z.includes(expected)) {
        problems.push(`${ns}: glossary — "${term}" should map to "${expected}" — ${k} = "${z}"`);
      }
    }

    for (const { en: trigger, wrong, reason } of MISTRANSLATIONS) {
      const hit = typeof wrong === 'string' ? z.includes(wrong) : wrong.test(z);
      if (trigger.test(prose) && hit) {
        problems.push(`${ns}: mistranslation — ${k} = "${z}"  (${reason})`);
      }
    }
  }
}

console.log(`checked ${totalKeys} keys across ${namespaces.length} namespaces: ${namespaces.join(', ')}`);
if (problems.length === 0) {
  console.log('✓ catalogues consistent');
  process.exit(0);
}
console.error(`\n✗ ${problems.length} problem(s):`);
for (const p of problems) console.error(`  ${p}`);
process.exit(1);
