import assert from "node:assert/strict";
import test from "node:test";

import { SETTINGS_CONFIG_FIELDS, readSettingsConfigSnapshot } from "../src/settings-config.js";

test("settings config exposes GUI sidecar image override", () => {
  const sidecarImageField = SETTINGS_CONFIG_FIELDS.find((field) => field.key === "RUNTIME_GUI_SIDECAR_IMAGE");

  assert.ok(sidecarImageField);
  assert.equal(sidecarImageField.defaultValue, "");
  assert.equal(sidecarImageField.groupId, "runtime-behavior");
});

test("settings config runtime type fields exclude desktop", () => {
  const supportedTypesField = SETTINGS_CONFIG_FIELDS.find((field) => field.key === "ATOLL_SUPPORTED_RUNTIME_TYPES");
  const defaultRuntimeTypeField = SETTINGS_CONFIG_FIELDS.find((field) => field.key === "ATOLL_DEFAULT_RUNTIME_TYPE");

  assert.ok(supportedTypesField);
  assert.equal(supportedTypesField.placeholder, "openclaw,zeroclaw,hermes");

  assert.ok(defaultRuntimeTypeField);
  assert.equal(defaultRuntimeTypeField.options?.some((option) => option.value === "desktop"), false);
});

test("settings snapshot materializes GUI sidecar image and excludes desktop image field", () => {
  const snapshot = readSettingsConfigSnapshot({
    envFilePath: "C:\\nonexistent\\.env"
  });

  const runtimeBehaviorGroup = snapshot.groups.find((group) => group.id === "runtime-behavior");
  assert.ok(runtimeBehaviorGroup);
  assert.equal(
    runtimeBehaviorGroup.fields.some((field) => field.key === "RUNTIME_GUI_SIDECAR_IMAGE"),
    true
  );
  assert.equal(
    runtimeBehaviorGroup.fields.some((field) => field.key === "RUNTIME_DESKTOP_IMAGE"),
    false
  );
});
