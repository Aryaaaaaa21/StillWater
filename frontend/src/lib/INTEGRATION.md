# Stillwater frontend integration API

This is the integration contract for the UI. Use these helpers rather than assembling SDK transactions in pages. Implementation is being verified against the installed SDK declarations; any limitations are recorded below.

## Network and deployment

```ts
import {
  getNetwork, setNetwork, getNetworkConfig,
  getContractAddress, setContractAddress,
  getExplorerContractUrl, getExplorerTxUrl,
} from '../config';
import { useDeployment } from '../hooks/useDeployment';

// Preview is the default; Preprod is an explicit user choice.
setNetwork('preview'); // triggers reactive subscriptions; invalidates a connected wallet
setContractAddress(address); // strict 64-hex, scoped to the active network
setContractAddress(''); // explicitly clear; does NOT restore an env/previous address
const { network, address, setAddress, config } = useDeployment();
```

All network-taking helpers default to the **active** network. Build-time `VITE_CONTRACT_ADDRESS`, `VITE_INDEXER_URL`, and `VITE_INDEXER_WS` apply only to `VITE_NETWORK` (default `preview`). No legacy deployment keys are read. No deployment is pre-filled. `getNetworkConfig()` returns `networkId`, `indexerUrl`, `indexerWsUrl`, `explorerUrl`, `zkAssetPath`.

`useContractState(intervalMs = 5000, requestedAddress?)` keeps its existing return fields: `ledgerState: Ledger | null`, `isLoading`, `error: string | null`, `lastUpdate: Date | null`, `refetch(): Promise<void>`. Network/address changes reset state and stale responses cannot replace the current selection. Passing `''` explicitly requests no deployment.

## Wallet

```ts
const { session, connect, disconnect, availableWallets, error } = useWallet();
const connected = await connect(getNetwork(), walletId);
```

`connect` returns `ConnectedSession | undefined`; failures appear in `error`. `ConnectedSession` supplies the real typed SDK providers and a pinned `network`. Connectors are detected by capability, not only brand. Supported connectors must expose modern Midnight DApp connector methods (`connect`, configuration, addresses, proving, balancing, submission). This includes compatible 1AM/Lace/Nightly injections, not arbitrary Cardano-only wallets. A connector returning a different network is rejected. Disconnect clears application private state; the standard connector does not guarantee wallet-side permission revocation.

## Transactions

```ts
import {
  deploySpace, claimAccess, lockRoom, unlockRoom, rotateRoom,
  waitForConfirmation, type TransactionProgress,
} from '../lib/contract';
import { randomSecret } from '../lib/identity';

const onProgress = (event: TransactionProgress) => setMessage(event.message);
const submitted = await deploySpace(session, {
  threshold: '72', capacity: '144',
  roomId: randomSecret(), issuerId: randomSecret(),
  expiry: String(Math.floor(Date.now() / 1000) + 86400),
  operatorSecret, // 64-hex; never put in localStorage
}, { onProgress });
// submitted.status === 'submitted': NOT proof of inclusion or successful execution.
setTxId(submitted.txId);
const confirmed = await waitForConfirmation(session, submitted, {
  onProgress, timeoutMs: 120000, signal: abortController.signal,
});
// Only confirmed.status === 'confirmed' means the indexer reports SucceedEntirely.
// Successful deployment confirmation saves the address for submitted.network.

const claim = await claimAccess(session, {
  address, score: '88', inviteSecret: identity.secret,
}, { onProgress });
await waitForConfirmation(session, claim, { onProgress });
await lockRoom(session, { address, operatorSecret }, { onProgress });
await unlockRoom(session, { address, operatorSecret }, { onProgress });
await rotateRoom(session, {
  address, operatorSecret, threshold: '75', capacity: '50',
  roomId: randomSecret(), issuerId: randomSecret(), expiry: unixSeconds,
}, { onProgress });
```

Every submit helper returns `SubmittedTransaction` with `status`, `operation`, `network`, `contractAddress`, and a real `txId`. `waitForConfirmation` returns a `ConfirmedTransaction` including `blockHeight`, `blockHash`, `txHash`. `TransactionProgress.stage` is one of `validating`, `preparing`, `proving`, `balancing`, `submitting`, `submitted`, `confirming`, `confirmed`. No private values are passed to progress callbacks. Errors and timeouts must be shown without claiming that a submitted transaction failed or was cancelled. `ConfirmationTimeoutError` means inclusion remains unknown; `TransactionExecutionError` means indexed execution was not entirely successful.

Input numbers may be decimal strings, safe integer numbers, or bigint. Score/threshold are integers 0–100 (no clamping); capacity is 1–2^32−1; expiry is future Unix seconds within uint64. IDs/secrets are exactly 32 bytes or 64 hexadecimal characters. Missing witnesses fail closed, rather than silently using all-zero secrets. Lifecycle circuit names are exactly `claim_access`, `rotate_room`, `lock_room`, `unlock_room`. Constructor order is threshold, room, expiry, issuer, operator commitment, limit.

## Local access secret

```ts
import { getIdentity, exportIdentity, importIdentity, clearIdentity,
  randomSecret, publicFingerprint, sessionToken, hasRedeemedInvite } from '../lib/identity';
const identity = getIdentity();
const plaintextBackup = exportIdentity(identity); // explicitly user-controlled, sensitive
const restored = importIdentity(plaintextBackup); // validates before replacing the session value
clearIdentity(); // erases the tab's saved invite; a new call creates a new one
```

Identity is memory/sessionStorage only. No score or operator secret is written to localStorage. Export is **plaintext**, not encryption: offer an explicit download/copy with a warning, never analytics or logs. `publicFingerprint` is a local convenience, not an identity proof. One room-scoped token per secret is replay protection, **not Sybil protection**. Scores are self-attested and capped at 100, not real credentials or issuer-authenticated evidence.

## Provider limitations / verification

- Wallet submission APIs may return `void`: the adapter derives the real identifier from the finalized serialized transaction, never invents a `submitted` ID.
- The in-memory SDK private state provider has real scoped get/set/remove/clear and signing-key storage. SDK encrypted bulk export/import is intentionally unsupported and throws; use the narrow identity export helpers for invite recovery.
- Proving is delegated to the wallet. Its proving provider may use a service outside the browser; do not promise that witness material can never leave the device. Do not log the SDK's private transaction data.
- No live wallet transaction, deployment, faucet funding, or production audit is implied by local tests. DUST, compatible wallet services, and matching `/managed` assets remain required.
- No external user guide was supplied; this document does not invent one.
