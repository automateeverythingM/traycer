export const STAGING_RELEASE_TOKEN_ENV = "TRAYCER_STAGING_RELEASE_TOKEN";
export const AUTHENTICATION_REQUIRED_MESSAGE =
  "GitHub authentication is required to download Planwise Staging releases.";

export interface GitHubRepoCoordinate {
  readonly owner: string;
  readonly repo: string;
}

export interface GitHubReleaseAuthPolicy {
  readonly repository: GitHubRepoCoordinate;
  readonly authorizedOrigins: readonly string[];
}

export interface CredentialLease {
  readonly source: "environment" | "github-cli";
  readonly token: string;
}
