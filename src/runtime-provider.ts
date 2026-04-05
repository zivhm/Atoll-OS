import type {
  ManagedRuntimeContainer,
  ProvisionRuntimeContainerInput,
  RuntimeRecoveredIdentity,
  RuntimeSharedFile,
  RuntimeEnvironmentDiagnostics,
  RuntimeEnvironmentDiagnosticsInput,
  RuntimeOps,
  RuntimePairingInfo,
  WriteRuntimeConfigInput
} from "./runtime.js";

export type RuntimeProvider = {
  id: string;
  displayName: string;
  checkPrereqs: (
    input: RuntimeEnvironmentDiagnosticsInput
  ) => Promise<RuntimeEnvironmentDiagnostics>;
  provisionRuntimeContainer: (input: ProvisionRuntimeContainerInput) => Promise<void>;
  writeRuntimeConfig: (input: WriteRuntimeConfigInput) => Promise<void>;
  restartRuntimeContainer: (containerName: string) => Promise<void>;
  startRuntimeContainer: (containerName: string) => Promise<void>;
  stopRuntimeContainer: (containerName: string) => Promise<void>;
  readRuntimeContainerLogs: (containerName: string, tail?: number) => Promise<string>;
  getRuntimePairingInfo: (containerName: string) => Promise<RuntimePairingInfo>;
  getRuntimeEnvironmentDiagnostics: (
    input: RuntimeEnvironmentDiagnosticsInput
  ) => Promise<RuntimeEnvironmentDiagnostics>;
  destroyRuntimeContainer: (input: {
    containerName: string;
    volumeName: string;
    destroyVolume?: boolean;
  }) => Promise<void>;
  listManagedRuntimeContainers?: () => Promise<ManagedRuntimeContainer[]>;
  readRuntimeBearerToken?: (input: {
    runtimeType?: ProvisionRuntimeContainerInput["runtimeType"];
    volumeName: string;
  }) => Promise<string | undefined>;
  readRuntimeIdentity?: (input: {
    runtimeType?: ProvisionRuntimeContainerInput["runtimeType"];
    volumeName: string;
  }) => Promise<RuntimeRecoveredIdentity | undefined>;
  listRuntimeSharedFiles?: (input: {
    runtimeType?: ProvisionRuntimeContainerInput["runtimeType"];
    volumeName: string;
  }) => Promise<RuntimeSharedFile[]>;
  readRuntimeSharedFile?: (input: {
    runtimeType?: ProvisionRuntimeContainerInput["runtimeType"];
    volumeName: string;
    relativePath: string;
  }) => Promise<{ fileName: string; content: Buffer }>;
  writeRuntimeSharedFile?: (input: {
    runtimeType?: ProvisionRuntimeContainerInput["runtimeType"];
    volumeName: string;
    fileName: string;
    content: Buffer;
  }) => Promise<RuntimeSharedFile>;
  deleteRuntimeSharedFile?: (input: {
    runtimeType?: ProvisionRuntimeContainerInput["runtimeType"];
    volumeName: string;
    relativePath: string;
  }) => Promise<void>;
};

export function createLocalRuntimeProvider(runtimeOps: RuntimeOps): RuntimeProvider {
  return {
    id: "local-container",
    displayName: "Local Container Runtime",
    checkPrereqs: (input) => runtimeOps.getRuntimeEnvironmentDiagnostics(input),
    provisionRuntimeContainer: (input) => runtimeOps.provisionRuntimeContainer(input),
    writeRuntimeConfig: (input) => runtimeOps.writeRuntimeConfig(input),
    restartRuntimeContainer: (containerName) => runtimeOps.restartRuntimeContainer(containerName),
    startRuntimeContainer: (containerName) => runtimeOps.startRuntimeContainer(containerName),
    stopRuntimeContainer: (containerName) => runtimeOps.stopRuntimeContainer(containerName),
    readRuntimeContainerLogs: (containerName, tail) => runtimeOps.readRuntimeContainerLogs(containerName, tail),
    getRuntimePairingInfo: (containerName) => runtimeOps.getRuntimePairingInfo(containerName),
    getRuntimeEnvironmentDiagnostics: (input) => runtimeOps.getRuntimeEnvironmentDiagnostics(input),
    destroyRuntimeContainer: (input) => runtimeOps.destroyRuntimeContainer(input),
    listManagedRuntimeContainers: () =>
      runtimeOps.listManagedRuntimeContainers ? runtimeOps.listManagedRuntimeContainers() : Promise.resolve([]),
    readRuntimeBearerToken: (input) =>
      runtimeOps.readRuntimeBearerToken ? runtimeOps.readRuntimeBearerToken(input) : Promise.resolve(undefined),
    readRuntimeIdentity: (input) =>
      runtimeOps.readRuntimeIdentity ? runtimeOps.readRuntimeIdentity(input) : Promise.resolve(undefined),
    listRuntimeSharedFiles: (input) =>
      runtimeOps.listRuntimeSharedFiles ? runtimeOps.listRuntimeSharedFiles(input) : Promise.resolve([]),
    readRuntimeSharedFile: (input) =>
      runtimeOps.readRuntimeSharedFile
        ? runtimeOps.readRuntimeSharedFile(input)
        : Promise.reject(new Error("Runtime shared file reads are not supported")),
    writeRuntimeSharedFile: (input) =>
      runtimeOps.writeRuntimeSharedFile
        ? runtimeOps.writeRuntimeSharedFile(input)
        : Promise.reject(new Error("Runtime shared file writes are not supported")),
    deleteRuntimeSharedFile: (input) =>
      runtimeOps.deleteRuntimeSharedFile
        ? runtimeOps.deleteRuntimeSharedFile(input)
        : Promise.reject(new Error("Runtime shared file deletes are not supported"))
  };
}
