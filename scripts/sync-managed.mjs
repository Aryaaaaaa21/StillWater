import { cpSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { managed, root, verifyCopy, verifyManaged } from './managed-artifacts.mjs';

const frontendContract = join(root, 'frontend/src/managed/contract');
const frontendPublic = join(root, 'frontend/public/managed');
const check = process.argv.includes('--check');
verifyManaged();
if (!check) {
  rmSync(join(root, 'frontend/src/managed'), { recursive: true, force: true });
  rmSync(frontendPublic, { recursive: true, force: true });
  cpSync(join(managed, 'contract'), frontendContract, { recursive: true });
  cpSync(managed, frontendPublic, { recursive: true });
}
verifyCopy(join(managed, 'contract'), frontendContract);
verifyCopy(managed, frontendPublic);
console.log(check ? 'Stillwater artifacts and browser copies are verified.' : 'Synced and verified Stillwater browser artifacts.');
