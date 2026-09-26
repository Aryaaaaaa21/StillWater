/// <reference types="vite/client" />

type StillwaterNetwork = 'preview' | 'preprod';
interface ImportMetaEnv {
  readonly VITE_NETWORK?: StillwaterNetwork;
  readonly VITE_CONTRACT_NETWORK?: StillwaterNetwork;
  readonly VITE_CONTRACT_ADDRESS?: string;
  readonly VITE_CONTRACT_ADDRESS_PREVIEW?: string;
  readonly VITE_CONTRACT_ADDRESS_PREPROD?: string;
  readonly VITE_INDEXER_NETWORK?: StillwaterNetwork;
  readonly VITE_INDEXER_URL?: string;
  readonly VITE_INDEXER_WS?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
