import type { FastifyInstance, FastifyRequest } from "fastify";

import {
  parseSettingsConfigUpdateInput,
  readSettingsConfigSnapshot,
  writeSettingsConfigValues
} from "../../settings-config.js";

type AuthContext = {
  sub: string;
  orgId: string;
};

export function registerSettingsConfigRoutes(
  app: FastifyInstance,
  deps: {
    envFilePath: string;
    getAuthContextOrThrow: (request: FastifyRequest) => AuthContext;
  }
): void {
  const { envFilePath, getAuthContextOrThrow } = deps;

  app.get("/api/settings/config", async (request) => {
    getAuthContextOrThrow(request);
    return readSettingsConfigSnapshot({
      envFilePath
    });
  });

  app.post("/api/settings/config", async (request) => {
    getAuthContextOrThrow(request);
    const values = parseSettingsConfigUpdateInput(request.body);
    writeSettingsConfigValues(envFilePath, values);
    return readSettingsConfigSnapshot({
      envFilePath,
      restartRequired: true
    });
  });
}
