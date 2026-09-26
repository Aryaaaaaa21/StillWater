import { cpSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { root } from './managed-artifacts.mjs';

const destination = join(root, 'dist');
rmSync(destination, { recursive: true, force: true });
cpSync(join(root, 'frontend/dist'), destination, { recursive: true });
console.log('Copied the Stillwater frontend build to dist/.');
