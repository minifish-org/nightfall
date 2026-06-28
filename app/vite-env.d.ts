/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AGENTD_URL?: string;
  readonly VITE_AGENTD_BASE_URL?: string;
  readonly VITE_AGENTD_TOKEN?: string;
  readonly VITE_AGENTD_TENANT?: string;
  readonly VITE_TTS_BASE_URL?: string;
  readonly VITE_TTS_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
