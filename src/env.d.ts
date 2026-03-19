/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_RELAY_WS: string;
  readonly VITE_RELAY_HTTP: string;
  readonly VITE_SESSION_API: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
