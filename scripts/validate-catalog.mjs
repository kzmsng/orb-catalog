#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const catalogPath = path.join(here, '..', 'catalog.json');

const REQUIRED_FIELDS = ['id', 'name', 'description', 'category', 'icon', 'defaultPort', 'dockerCompose'];
const KNOWN_CATEGORIES = new Set([
  'Media', 'Utilities', 'Database', 'Network', 'Cloud', 'Security',
  'Automation', 'Productivity', 'Monitoring', 'Developer Tools', 'Storage',
]);
const KNOWN_ENTRY_TYPES = new Set(['app', 'infrastructure']);
const KNOWN_RELEASE_PROVIDERS = new Set(['github_release', 'http_feed', 'custom']);
const SAFE_CATALOG_ID = /^[A-Za-z0-9._-]+$/;
const GITHUB_REPO_RE = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})\/[A-Za-z0-9](?:[A-Za-z0-9._-]{0,99})$/;

function parseImageRef(image) {
  if (typeof image !== 'string' || !image.trim()) return null;
  const withoutDigest = image.split('@')[0];
  if (!withoutDigest) return null;
  let host = '';
  let remainder = withoutDigest;
  const firstSlash = withoutDigest.indexOf('/');
  if (firstSlash !== -1) {
    const first = withoutDigest.slice(0, firstSlash);
    if (first.includes('.') || first.includes(':') || first === 'localhost') {
      host = first;
      remainder = withoutDigest.slice(firstSlash + 1);
    }
  }
  let repository = remainder;
  const rc = remainder.lastIndexOf(':');
  const rs = remainder.lastIndexOf('/');
  if (rc > rs) repository = remainder.slice(0, rc);
  if (!repository) return null;
  return { registry: host || 'registry-1.docker.io', repository };
}

const errors = [];
const warnings = [];
const err = (msg) => errors.push(msg);
const warn = (msg) => warnings.push(msg);

let raw;
try {
  raw = readFileSync(catalogPath, 'utf8');
} catch (e) {
  console.error(`FATAL: cannot read ${catalogPath}: ${e.message}`);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error(`FATAL: catalog.json is not valid JSON: ${e.message}`);
  process.exit(1);
}
console.log('✓ valid JSON');

if (typeof data.schema !== 'number') err('top-level "schema" must be a number');
if (!Array.isArray(data.apps)) err('top-level "apps" must be an array');
if (errors.length) { errors.forEach((e) => console.error('✗ ' + e)); process.exit(1); }

const seenIds = new Set();
for (const [i, app] of data.apps.entries()) {
  const where = `apps[${i}]${app && app.id ? ` (id="${app.id}")` : ''}`;
  if (!app || typeof app !== 'object') { err(`${where}: not an object`); continue; }

  for (const field of REQUIRED_FIELDS) {
    if (typeof app[field] !== 'string' || !app[field].trim()) {
      // defaultPort may legitimately be empty (e.g. a tunnel client with no local port)
      if (field === 'defaultPort' && app[field] === '') continue;
      err(`${where}: missing/empty required field "${field}"`);
    }
  }

  if (typeof app.id === 'string') {
    if (!SAFE_CATALOG_ID.test(app.id) || app.id === '.' || app.id === '..') err(`${where}: id is not a safe identifier`);
    if (seenIds.has(app.id)) err(`${where}: duplicate id`);
    seenIds.add(app.id);
  }

  if (app.category !== undefined && !KNOWN_CATEGORIES.has(app.category)) err(`${where}: unknown category "${app.category}"`);
  if (app.type !== undefined && !KNOWN_ENTRY_TYPES.has(app.type)) err(`${where}: unknown type "${app.type}" (expected app|infrastructure)`);

  if (app.update !== undefined) {
    if (typeof app.update !== 'object' || app.update === null) {
      err(`${where}: "update" must be an object`);
    } else {
      const u = app.update;
      if (u.registry !== undefined) {
        if (typeof u.registry !== 'object' || u.registry === null || typeof u.registry.image !== 'string' || !u.registry.image.trim()) {
          err(`${where}: update.registry.image must be a non-empty string`);
        } else {
          if (!parseImageRef(u.registry.image)) err(`${where}: update.registry.image is not a parseable image reference`);
          if (/[:@]/.test(u.registry.image)) err(`${where}: update.registry.image must not include a tag or digest ("${u.registry.image}")`);
          const composeImageMatch = /image:\s*['"]?([^\s'"#]+)/.exec(app.dockerCompose || '');
          if (composeImageMatch) {
            const composeRef = parseImageRef(composeImageMatch[1]);
            const declaredRef = parseImageRef(u.registry.image);
            if (composeRef && declaredRef && (composeRef.registry !== declaredRef.registry || composeRef.repository !== declaredRef.repository)) {
              warn(`${where}: update.registry.image ("${u.registry.image}") does not match the image in dockerCompose ("${composeImageMatch[1]}")`);
            }
          }
        }
      }
      if (u.release !== undefined) {
        if (typeof u.release !== 'object' || u.release === null || typeof u.release.provider !== 'string') {
          err(`${where}: update.release must be an object with a "provider"`);
        } else if (!KNOWN_RELEASE_PROVIDERS.has(u.release.provider)) {
          err(`${where}: update.release.provider is unsupported ("${u.release.provider}")`);
        } else if (u.release.provider === 'github_release') {
          if (typeof u.release.repository !== 'string' || !GITHUB_REPO_RE.test(u.release.repository)) {
            err(`${where}: update.release.repository is not a valid "owner/repo" ("${u.release.repository}")`);
          }
        } else if (u.release.provider === 'http_feed') {
          let ok = false;
          try { ok = new URL(u.release.url).protocol === 'https:'; } catch {}
          if (!ok) err(`${where}: update.release.url must be a valid https:// URL`);
        } else if (u.release.provider === 'custom') {
          if (typeof u.release.providerId !== 'string' || !u.release.providerId.trim()) {
            err(`${where}: update.release.providerId must be a non-empty string`);
          }
        }
        if (u.release && !u.registry) warn(`${where}: update.release is declared without update.registry — Orb requires a registry anchor before it will ever attach release metadata`);
      }
    }
  }
}

console.log(`✓ ${data.apps.length} entries, all required fields present`);
console.log(`✓ ${seenIds.size} unique ids, no duplicates`);
console.log(`✓ update metadata validated where present`);

if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  warnings.forEach((w) => console.log('  ! ' + w));
}
if (errors.length) {
  console.error(`\n${errors.length} error(s):`);
  errors.forEach((e) => console.error('  ✗ ' + e));
  process.exit(1);
}
console.log('\nOK — catalog.json passes all checks.');
