import { type VerifiedAuthToken } from "./auth.js";

type LocalAuthConfig = {
  localAuthSub: string;
  localAuthOrgId: string;
};

type ResolveLocalAuthContextOptions = {
  allowHeaderOverrides?: boolean;
};

export function resolveLocalAuthContext(
  headers: Record<string, string | string[] | undefined>,
  config: LocalAuthConfig,
  options: ResolveLocalAuthContextOptions = {}
):
  | {
      ok: true;
      auth: VerifiedAuthToken;
    }
  | {
      ok: false;
      message: string;
    } {
  const orgHeader = readOptionalHeader(headers, "x-atoll-local-org-id");
  const subHeader = readOptionalHeader(headers, "x-atoll-local-sub");
  if (!options.allowHeaderOverrides && (orgHeader.present || subHeader.present)) {
    return {
      ok: false,
      message:
        "Local auth header overrides are disabled. Set ATOLL_LOCAL_AUTH_ALLOW_HEADER_OVERRIDES=true for dev-only override testing."
    };
  }
  if (orgHeader.present && !orgHeader.value) {
    return {
      ok: false,
      message: "Invalid local org id. x-atoll-local-org-id cannot be empty."
    };
  }
  if (subHeader.present && !subHeader.value) {
    return {
      ok: false,
      message: "Invalid local subject. x-atoll-local-sub cannot be empty."
    };
  }

  return {
    ok: true,
    auth: buildLocalAuthContext(config, {
      orgId: orgHeader.value || undefined,
      sub: subHeader.value || undefined
    })
  };
}

function buildLocalAuthContext(
  config: LocalAuthConfig,
  override: {
    sub?: string;
    orgId?: string;
  } = {}
): VerifiedAuthToken {
  return {
    sub: override.sub ?? config.localAuthSub,
    orgId: override.orgId ?? config.localAuthOrgId,
    claims: {
      source: "local-auth",
      overridden: Boolean(override.sub || override.orgId)
    }
  };
}

function readOptionalHeader(
  headers: Record<string, string | string[] | undefined>,
  key: string
): { present: boolean; value: string } {
  const value = headers[key];
  if (typeof value !== "string") {
    return {
      present: false,
      value: ""
    };
  }
  return {
    present: true,
    value: value.trim()
  };
}
