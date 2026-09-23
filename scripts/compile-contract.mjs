import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { managed, root, source, toolchain, writeManifest } from './managed-artifacts.mjs';

// Windows compact.exe compresses NTFS files: it is NOT the Midnight compiler.
// On Windows use Ubuntu (or COMPACT_WSL_DISTRO) and discover tools in its login
// shell. On Linux/macOS use compact's pinned toolchain or an exact compactc.
const windowsPath = (value) => value.replace(/^([A-Za-z]):/, (_, drive) => `/mnt/${drive.toLowerCase()}`).replaceAll('\\', '/');
const version = toolchain.compilerVersion;
const candidates = [];
if (process.env.COMPACTC) candidates.push({ command: process.env.COMPACTC, prefix: [], paths: [source, managed] });
if (process.platform === 'win32') {
  // Discover the Linux tool in WSL rather than assuming a username or PATH.
  // Windows compact.exe is NTFS compression, not the Compact compiler.
  const distro = process.env.COMPACT_WSL_DISTRO || 'Ubuntu';
  const discovered = process.env.COMPACT_WSL_BIN || spawnSync(
    'wsl.exe', ['-d', distro, '--', 'bash', '-lc', 'command -v compact || command -v compactc'],
    { cwd: root, encoding: 'utf8', shell: false },
  ).stdout?.trim();
  if (discovered) {
    const isWrapper = discovered.endsWith('/compact');
    candidates.push({
      command: 'wsl.exe',
      prefix: ['-d', distro, '--', discovered, ...(isWrapper ? ['compile', `+${version}`] : [])],
      paths: [windowsPath(source), windowsPath(managed)],
    });
  }
} else {
  candidates.push({ command: 'compact', prefix: ['compile', `+${version}`], paths: [source, managed] });
  candidates.push({ command: 'compactc', prefix: [], paths: [source, managed] });
}
if (!existsSync(source)) throw new Error(`Missing Compact source: ${source}`);
let compiler;
const diagnostics = [];
for (const candidate of candidates) {
  const probe = spawnSync(candidate.command, [...candidate.prefix, '--version'], { cwd: root, encoding: 'utf8', shell: false });
  if (probe.status === 0 && probe.stdout.trim() === version) {
    compiler = candidate;
    break;
  }
  diagnostics.push(`${candidate.command}: ${probe.error?.message || probe.stderr?.trim() || `found ${probe.stdout?.trim() || 'no compiler'}`}`);
}
if (!compiler) throw new Error(`Compact ${version} is required.\n${diagnostics.join('\n')}`);

// Remove stale output first: missing keys must never be masked by an old build.
rmSync(managed, { recursive: true, force: true });
mkdirSync(dirname(managed), { recursive: true });
const result = spawnSync(compiler.command, [...compiler.prefix, ...compiler.paths], { cwd: root, stdio: 'inherit', shell: false });
if (result.status !== 0) throw new Error(`Compact compilation failed: ${result.error?.message || result.status}`);
// This fails if ZK generation was skipped, files are empty, or the API drifted.
writeManifest(managed);
console.log(`Compiled Stillwater and real proving/verifying keys with Compact ${version}.`);
