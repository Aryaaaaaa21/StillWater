import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const source = join(root, 'contracts/stillwater.compact');
export const managed = join(root, 'contracts/managed/stillwater');
export const toolchain = JSON.parse(readFileSync(join(root, 'contracts/compiler.json'), 'utf8'));
export const impureCircuits = ['claim_access', 'lock_room', 'rotate_room', 'unlock_room'];
export const pureCircuits = ['derive_redemption_token', 'operator_commitment_for'];
export const sha256 = (file) => createHash('sha256').update(readFileSync(file)).digest('hex');

export function filesIn(directory, prefix = '') {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const name = `${prefix}${entry.name}`;
    if (entry.isSymbolicLink()) throw new Error(`Symlink not allowed in managed artifacts: ${name}`);
    return entry.isDirectory() ? filesIn(join(directory, entry.name), `${name}/`) : [name];
  }).sort();
}

function validateCompilerOutput(directory) {
  const info = JSON.parse(readFileSync(join(directory, 'compiler/contract-info.json'), 'utf8'));
  for (const [key, value] of [['compiler-version', toolchain.compilerVersion], ['language-version', toolchain.languageVersion], ['runtime-version', toolchain.runtimeVersion]]) {
    if (info[key] !== value) throw new Error(`Unexpected ${key}: ${info[key]} (expected ${value})`);
  }
  const actualImpure = info.circuits.filter((circuit) => !circuit.pure).map((circuit) => circuit.name).sort();
  const actualPure = info.circuits.filter((circuit) => circuit.pure).map((circuit) => circuit.name).sort();
  if (JSON.stringify(actualImpure) !== JSON.stringify(impureCircuits) || JSON.stringify(actualPure) !== JSON.stringify(pureCircuits)) {
    throw new Error('Generated circuit API does not match Stillwater');
  }
  const required = ['contract/index.js', 'contract/index.d.ts', 'contract/index.js.map', 'compiler/contract-info.json'];
  for (const name of impureCircuits) {
    required.push(`keys/${name}.prover`, `keys/${name}.verifier`, `zkir/${name}.bzkir`, `zkir/${name}.zkir`);
  }
  for (const file of required) {
    if (statSync(join(directory, file)).size === 0) throw new Error(`Empty generated artifact: ${file}`);
  }
  // Fail instead of silently relying on an incompatible runtime or dependency patch.
  const runtime = JSON.parse(readFileSync(join(root, 'node_modules/@midnight-ntwrk/compact-runtime/package.json'), 'utf8'));
  if (runtime.version !== toolchain.runtimeVersion) throw new Error(`Install compact-runtime ${toolchain.runtimeVersion}`);
}

export function writeManifest(directory) {
  validateCompilerOutput(directory);
  const files = Object.fromEntries(filesIn(directory).filter((name) => name !== 'manifest.json').map((name) => [name, sha256(join(directory, name))]));
  const manifest = {
    schemaVersion: 1,
    contract: 'stillwater',
    compilerVersion: toolchain.compilerVersion,
    runtimeVersion: toolchain.runtimeVersion,
    source: 'contracts/stillwater.compact',
    sourceSha256: sha256(source),
    files,
  };
  writeFileSync(join(directory, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

export function verifyManaged(directory = managed) {
  validateCompilerOutput(directory);
  const manifest = JSON.parse(readFileSync(join(directory, 'manifest.json'), 'utf8'));
  if (manifest.schemaVersion !== 1 || manifest.contract !== 'stillwater' || manifest.source !== 'contracts/stillwater.compact' || manifest.compilerVersion !== toolchain.compilerVersion || manifest.runtimeVersion !== toolchain.runtimeVersion) {
    throw new Error('Invalid Stillwater artifact manifest; run npm run compile');
  }
  if (manifest.sourceSha256 !== sha256(source)) throw new Error('Compact source changed; run npm run compile');
  const actual = filesIn(directory).filter((name) => name !== 'manifest.json');
  if (JSON.stringify(actual) !== JSON.stringify(Object.keys(manifest.files).sort())) throw new Error('Artifact file list differs from manifest');
  for (const name of actual) {
    if (sha256(join(directory, name)) !== manifest.files[name]) throw new Error(`Artifact checksum mismatch: ${name}`);
  }
  return manifest;
}

export function verifyCopy(original, copy) {
  const files = filesIn(original);
  if (JSON.stringify(files) !== JSON.stringify(filesIn(copy))) throw new Error(`Stale file list in ${copy}; run npm run copy:managed`);
  for (const name of files) {
    if (sha256(join(original, name)) !== sha256(join(copy, name))) throw new Error(`Stale browser artifact: ${name}; run npm run copy:managed`);
  }
}
