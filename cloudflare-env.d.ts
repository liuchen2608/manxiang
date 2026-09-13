/// <reference types="vite/client" />
declare namespace Cloudflare {
  interface Env {
    MANXIANG_DEV_AI_RELAY?: string;
    MANXIANG_DEV_AI_TOKEN?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
