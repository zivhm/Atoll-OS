export type VerifiedAuthToken = {
  sub: string;
  orgId?: string;
  claims: Record<string, unknown>;
};
