import type { FastifyInstance } from "fastify";

import { registerRuntimeChatRoutes } from "./runtime-chat.routes.js";
import { registerRuntimeConfigRoutes } from "./runtime-config.routes.js";
import { registerRuntimeDiagnosticsRoutes } from "./runtime-diagnostics.routes.js";
import { registerRuntimeInstancesRoutes } from "./runtime-instances.routes.js";
import { registerRuntimeProvisionRoutes } from "./runtime-provision.routes.js";
import { registerRuntimeTraceRoutes } from "./runtime-traces.routes.js";
import type { RuntimeRouteDeps } from "./types.js";

export function registerRuntimeRoutes(app: FastifyInstance, deps: RuntimeRouteDeps): void {
  registerRuntimeDiagnosticsRoutes(app, deps);
  registerRuntimeProvisionRoutes(app, deps);
  registerRuntimeInstancesRoutes(app, deps);
  registerRuntimeChatRoutes(app, deps);
  registerRuntimeTraceRoutes(app, deps);
  registerRuntimeConfigRoutes(app, deps);
}

