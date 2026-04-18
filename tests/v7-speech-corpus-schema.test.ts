import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

const CORPUS_ROOT = path.resolve(__dirname, 'fixtures', 'v7-speech-corpus');

type Schema = {
  required: string[];
  properties: Record<string, unknown>;
};

function loadSchema(): Schema {
  const schemaPath = path.join(CORPUS_ROOT, 'schema.json');
  assert.ok(existsSync(schemaPath), 'tests/fixtures/v7-speech-corpus/schema.json must exist');
  return JSON.parse(readFileSync(schemaPath, 'utf-8')) as Schema;
}

function walkWavs(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walkWavs(full));
    } else if (entry.toLowerCase().endsWith('.wav')) {
      out.push(full);
    }
  }
  return out;
}

// Minimal ad-hoc JSON-Schema subset validator (required + property types + enum + const).
function validateAgainstSchema(obj: unknown, schema: Schema, filePath: string): void {
  assert.ok(obj && typeof obj === 'object' && !Array.isArray(obj), `${filePath}: must be a JSON object`);
  const record = obj as Record<string, unknown>;

  for (const key of schema.required) {
    assert.ok(key in record, `${filePath}: missing required field "${key}"`);
  }

  const props = schema.properties as Record<string, { type?: string; const?: unknown; enum?: unknown[]; items?: any; minItems?: number; uniqueItems?: boolean; minLength?: number; minimum?: number; maximum?: number }>;

  for (const [key, value] of Object.entries(record)) {
    const spec = props[key];
    assert.ok(spec, `${filePath}: unknown field "${key}"`);

    if (spec.type === 'string') {
      assert.equal(typeof value, 'string', `${filePath}: "${key}" must be string`);
      if (typeof spec.minLength === 'number') {
        assert.ok((value as string).length >= spec.minLength, `${filePath}: "${key}" shorter than ${spec.minLength}`);
      }
      if (Array.isArray(spec.enum)) {
        assert.ok(spec.enum.includes(value), `${filePath}: "${key}"="${value}" not in enum`);
      }
    } else if (spec.type === 'integer') {
      assert.ok(Number.isInteger(value), `${filePath}: "${key}" must be integer`);
      if ('const' in spec) {
        assert.equal(value, spec.const, `${filePath}: "${key}" must equal ${spec.const}`);
      }
    } else if (spec.type === 'number') {
      assert.equal(typeof value, 'number', `${filePath}: "${key}" must be number`);
      if (typeof spec.minimum === 'number') assert.ok((value as number) >= spec.minimum, `${filePath}: "${key}" below minimum`);
      if (typeof spec.maximum === 'number') assert.ok((value as number) <= spec.maximum, `${filePath}: "${key}" above maximum`);
    } else if (spec.type === 'array') {
      assert.ok(Array.isArray(value), `${filePath}: "${key}" must be array`);
      if (typeof spec.minItems === 'number') {
        assert.ok((value as unknown[]).length >= spec.minItems, `${filePath}: "${key}" fewer than ${spec.minItems} items`);
      }
      if (spec.uniqueItems) {
        assert.equal(new Set(value as unknown[]).size, (value as unknown[]).length, `${filePath}: "${key}" must have unique items`);
      }
      if (spec.items?.enum) {
        for (const item of value as unknown[]) {
          assert.ok(spec.items.enum.includes(item), `${filePath}: "${key}" contains invalid tag "${item}"`);
        }
      }
    }
  }
}

test('corpus INDEX.md exists', () => {
  assert.ok(existsSync(path.join(CORPUS_ROOT, 'INDEX.md')), 'tests/fixtures/v7-speech-corpus/INDEX.md must exist');
});

test('corpus schema.json exists and parses', () => {
  const schema = loadSchema();
  assert.ok(Array.isArray(schema.required) && schema.required.length > 0);
});

test('every .wav has a matching .json that validates against the schema', () => {
  const schema = loadSchema();
  const wavs = walkWavs(CORPUS_ROOT);

  for (const wav of wavs) {
    const companion = wav.replace(/\.wav$/i, '.json');
    assert.ok(existsSync(companion), `${wav} is missing its companion .json`);
    const parsed = JSON.parse(readFileSync(companion, 'utf-8'));
    validateAgainstSchema(parsed, schema, companion);
  }
});
