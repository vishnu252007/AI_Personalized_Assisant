/**
 * Merged server environment module.
 * Consolidates env.server.ts into a single canonical import path.
 * DEPRECATED: import from "@/lib/env.server" directly. This file exists only for
 * backwards-compatibility with existing imports.
 */
import "server-only";

export {
  serverEnvSchema,
  type ServerEnv,
  getServerEnv,
  _resetServerEnvCache,
  serverEnv,
} from "./env.server";
