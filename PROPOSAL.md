# Stillwater product proposal

## Chosen Level 3 idea: Private Allowlist Access

Stillwater is a private allowlist access primitive for small communities, research rooms and invitation-only spaces. An operator publishes a threshold, expiry and capacity. A visitor supplies a private eligibility witness and proves it clears the public threshold without revealing the score, access secret, or source context. The chain records a room-scoped one-time receipt so the operator can verify that an access event happened without building a public identity map.

## Current MVP boundary

The current witness is self-attested so the project can demonstrate Compact privacy behavior end to end. Anyone who controls the browser can choose a score between 0 and 100. This is an explicit limitation, not a hidden assumption. Before production use, a trusted issuer should supply or authorize the private credential through a secure witness provider or a signed credential verification circuit.

The access secret prevents the same local secret from being replayed in the same room. It does not prevent one person from creating multiple secrets, and therefore does not provide Sybil resistance.

## User flow

1. An operator deploys a space with a public threshold, expiry and capacity.
2. A visitor opens the space, connects a Midnight wallet, and enters a private score.
3. The browser calls `claim_access` with the score and access secret as witnesses.
4. Compact proves the score meets the threshold and the secret has not redeemed a room-scoped token.
5. The public ledger shows only the changed aggregate count and disclosed token.

## Approval question

Approve this as a Level 3 **Private Allowlist Access** submission, with the explicit scope that the first MVP demonstrates selective disclosure and replay protection, while issuer-backed eligibility and Sybil resistance remain follow-up work.
