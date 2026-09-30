# Stillwater interface system

## Direction

A quiet, nature-led workspace for private eligibility checks. The interface pairs a persistent, useful application sidebar with a wide photographic lake. The image is the memorable element; controls and public data remain restrained. This is a working application rather than a crypto marketing landing page.

UI UX Pro Max recommended minimal grid-based dashboard structure, high contrast, controlled React forms, keyboard-accessible controls and explicit loading feedback. Its generic pink/code-font palette was intentionally rejected for a more subject-specific water/forest identity. The frontend-design skill informed the typography, writing and single focal image.

## Tokens

- Paper: `#f5f6f2` — workspace background
- Porcelain: `#ffffff` — forms and panels
- Evergreen: `#244c3c` — primary controls
- Ink: `#243b32` — primary text
- Sage: `#e7eee5` — selected navigation and quiet emphasis
- Slate: `#64736b` — secondary text

Night maps the same semantic tokens to dark forest surfaces, pale sage text and mint controls. No text or form state depends on photography for legibility.

## Type

DM Sans for controls and body text. DM Serif Display for page titles and large editorial copy. System monospace only for addresses and secrets. Fonts are served locally, with no runtime font-service requests.

## Layout

```text
┌────────────────┬───────────────────────────────────────────┐
│ Stillwater     │ Workspace / Overview     network   wallet │
│                ├───────────────────────────────────────────┤
│ Overview       │ Welcome                                  │
│ Your access    │ ┌──────── lake image / introduction ────┐ │
│ Public ledger  │ │ Belong here. Leave less behind.       │ │
│                │ └───────────────────────────────────────┘ │
│ Operator       │ Public rule   Anonymous receipts  Witness │
│ Privacy model  │ Current policy          Privacy boundary  │
│                │ A simple three-step access journey        │
│ Theme / help   │                                           │
└────────────────┴───────────────────────────────────────────┘
```

Desktop uses a 236px sidebar and 32–40px content gutters. Tablet collapses margins; mobile uses a labelled menu button and one-column forms. Text remains left-aligned with a 70-character maximum for explanations.

## Interaction rules

- The default network is Preview. Preprod is independently configurable for submission.
- Never fabricate receipts, deployments, chain status, users or balances.
- Missing wallet, unconfigured contract, pending transaction, indexer failure and success have distinct states.
- Submission is not chain confirmation.
- Secrets are masked and remain in memory; exporting is explicit.
- All icon-only buttons have accessible labels. Use visible focus, 44px controls and reduced-motion preferences.
- The day/night choice persists. No parallax or ambient animation.
- Photography and fonts are local assets. Licensing is recorded in `ASSETS.md`.
