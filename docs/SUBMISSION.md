# Stillwater — Idea Submission

## Deployment Evidence

The Stillwater contract has been deployed to the Midnight Preprod network. The deployment transaction and live contract state are publicly verifiable on the 1AM explorer.

Deployment transaction: https://explorer.1am.xyz/tx/25a637c4d99a5f239dec314a5ac7b54748328a4ee98c02472cf1c3fc573749e0?network=preprod

Contract address: https://explorer.1am.xyz/contract/a791f2a7397ae3294d530e9bc6186d45175b2f362371ae87f54f4bd3ed368b2a

Live web application: https://still-water-zeta.vercel.app/

## 1. Problem Statement

Small communities, research groups, private event rooms, and selective platforms routinely need to verify that someone meets an eligibility condition before granting access. The current options are blunt: either ask for raw personal data and store it in a centralized database, or publish a public allowlist of wallet addresses on-chain. Neither option is acceptable when the goal is selective membership without a surveillance record.

Centralized eligibility databases are honeypots. They hold sensitive scores, credentials, and identity documents to answer a single yes/no question. When they are breached, the harm is permanent. Public blockchain allowlists are equally problematic in the other direction: recording wallet addresses and membership signals on a transparent ledger permanently maps out who belongs to what group, enabling correlation, profiling, and targeting.

Stillwater addresses this directly. It is a private allowlist access primitive built on the Midnight Network. An operator publishes a threshold, a capacity, and an expiry. A visitor proves their private score clears the public threshold inside a zero-knowledge circuit. The chain records only an aggregate count and a room-scoped anonymous receipt. The score, the access secret, and the visitor's identity are never written to the ledger.

## 2. Why Midnight?

Stillwater requires a runtime that can verify arithmetic constraints over private witnesses without disclosing the witnesses to validators, indexers, or any observer. No conventional blockchain or off-chain solution satisfies this cleanly. Midnight does.

The Compact language makes the public/private boundary explicit and auditable. Every value that crosses into ledger state must be wrapped in a disclose() call. The compiler refuses to compile accidental disclosures, turning what is usually a subtle developer mistake into a build error. This property is not available on general-purpose EVM or UTXO chains, where privacy requires external cryptographic libraries with fragile custom integration.

Midnight's proving infrastructure runs locally in the browser wallet. Private witness values for the claim — the score and the invite secret — never leave the user's device. The wallet proves, balances, and submits the transaction. Stillwater's frontend never receives the raw witnesses at all. This is a fundamental architectural guarantee that centralized eligibility APIs cannot provide.

The Midnight indexer exposes the exact public contract state that the circuit chose to disclose. Stillwater uses this directly: the ledger page reads claim_threshold, claims, claim_limit, room_open, and the redeemed_tokens set in real time. Observers can audit the policy and the fact of each access event without learning anything about the claimants.

## 3. Target Users

Tier 1 — Early adopters: Web3-native communities, zero-knowledge research groups, and privacy-focused hackathon organizers who need selective admission without a public member register. These users understand the trust model and can operate a Midnight wallet on Preview or Preprod.

Tier 2 — Growth phase: Private event platforms, credentialed DAO working groups, and corporate internal access systems that want to reduce their data compliance surface. Instead of holding private scores in a database and running server-side verification, they offload the eligibility check entirely to a trustless circuit. Their operators never receive the underlying credential.

Tier 3 — Mainnet scale: Institutions and platforms with regulatory exposure under data minimization requirements who want verifiable, auditable access records without storing personally identifying data. The public ledger provides an immutable audit trail of access events. The private witnesses that generated those events are never held by any party.

## 4. Technical Architecture

Frontend: A React 19 and Vite 6 single-page application with five routed pages — Overview, Your Access, Public Ledger, Operator Studio, and Privacy Model. The application uses the Midnight DApp Connector API to discover and connect compatible browser wallet extensions including 1AM, Lace, and Nightly. Network selection between Preview and Preprod is persistent across sessions. The design system uses self-hosted DM Sans and DM Serif Display typefaces, a nature-led color palette, and a persistent day and night mode.

Smart contracts: The Compact contract in contracts/stillwater.compact exports all policy and aggregate fields to the public ledger using explicit disclose() calls. Private witnesses — the eligibility score, the invite secret, and the operator secret — are defined as witness callbacks and are never circuit arguments. The contract provides five circuits: the constructor, claim_access, lock_room, unlock_room, and rotate_room. Replay protection is implemented using a domain-separated persistent hash as a nullifier, stored in a public Set. The operator is authenticated through a pre-committed hash of their secret rather than a signature, keeping the authorization model entirely within Compact.

Data flow: The operator generates a 32-byte secret locally, derives its public commitment using pureCircuits.operator_commitment_for, and deploys the contract via createUnprovenDeployTx. The wallet balances the transaction with DUST and submits it. Once the indexer confirms the deployment, visitors can connect their wallets on the same network, enter a private score, and call claim_access through createUnprovenCallTx. The proving provider runs the circuit locally, confirms the score meets the threshold, confirms the nullifier has not been redeemed in this room, and submits the balanced proof. The indexer records the updated aggregate count and the new nullifier token.

ZK asset pipeline: The Compact source is compiled using compactc, which outputs TypeScript contract bindings, prover keys, verifier keys, and zero-knowledge intermediate representations. These managed artifacts are synchronized to both contracts/managed/stillwater/ and frontend/public/managed/ by a scripted sync step. The FetchZkConfigProvider loads the keys at proof time from the /managed path served by the frontend.

## 5. Complexity Evaluation

Managing the public/private boundary in Compact requires careful review of every ledger write. The disclose() requirement makes violations visible, but the token derivation and nullifier insertion pattern for claim_access demanded close reading of how set membership and counter increment interact with the guaranteed and fallible execution phases on Midnight. A proof that fails after insertion would be a privacy violation; the contract was designed so that all private computations precede any ledger mutation.

The wallet provider seam between the Midnight JS SDK and the DApp Connector API required a custom adapter layer. The connector API returns hex-encoded serialized transactions; the SDK expects typed Transaction objects from the ledger-v8 WASM module. The balanceTx and submitTx wrappers in frontend/src/lib/midnight.ts handle version-tagged and unversioned transaction shapes from older and newer wallet releases.

Operator authorization without a signature scheme required domain separation to be introduced manually. The commitment hash uses a prefix tag so that a collision against a different contract's operator scheme is computationally infeasible even if the same secret is reused elsewhere.

The network-scoped contract address storage pattern prevents a Preview address from silently resolving against Preprod state when a user switches networks. Each network key is independently stored, and clearing an address writes an explicit empty sentinel that blocks environment variable fallback resurrection.

## 6. Roadmap

Level 4 — Production MVP and initial access deployment: Stillwater's core contract and browser application are implemented and passing. The contract has been deployed to Midnight Preprod and the deployment transaction (25a637c4d99a5f239dec314a5ac7b54748328a4ee98c02472cf1c3fc573749e0) and live contract state (a791f2a7397ae3294d530e9bc6186d45175b2f362371ae87f54f4bd3ed368b2a) are publicly verifiable on the 1AM explorer. The 15 meaningful commit history is complete and pushed to the main branch. The GitHub Actions CI pipeline is configured and validates compile, test, typecheck, and build on every push. The privacy model and operator documentation are confirmed accurate against the deployed contract state.

Level 5 — Full moon submission: With the Preprod deployment stable, the focus moves to real users. We will onboard the first test visitors through the claim flow, record wallet proof interactions, and collect structured feedback on the threshold configuration experience and wallet connection friction. The public ledger explorer will be validated against live Preprod indexer data. A demo video will walk through the complete operator deployment and visitor claim flow end to end. All documentation will be updated to reflect the actual deployed contract address and any feedback-driven changes to the frontend interaction model.

Level 6 — Supermoon submission: The feedback loop from Level 5 shapes the final product iteration. Operator secret management will be hardened based on tester experience. The privacy model page will be updated with any edge cases surfaced during real use. User acquisition will expand to reach verified Preprod participants with on-chain access receipts as evidence. The complete repository will contain the final Compact contract, compiled managed artifacts, frontend application, CI pipeline, deployment evidence, privacy documentation, the structured feedback record, and the production demo video.
