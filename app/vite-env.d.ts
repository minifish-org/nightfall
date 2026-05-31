/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AGENTD_URL?: string;
  readonly VITE_AGENTD_TENANT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
