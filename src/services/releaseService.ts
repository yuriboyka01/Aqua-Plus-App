import {
  APP_VERSION,
  APP_LATEST_RELEASE_URL,
  GITHUB_API_LATEST_RELEASE,
} from '../lib/constants';

export interface GitHubReleaseInfo {
  tagName: string;
  version: string;
  name: string;
  publishedAt: string;
  publishedDateFormatted: string;
  htmlUrl: string;
  apkDownloadUrl: string;
  apkFileName: string;
  apkSize: number | null;
  apkSizeFormatted: string;
  body: string;
  isUpdateAvailable: boolean;
}

/**
 * Strips leading 'v' or 'V' and whitespace.
 */
export function normalizeVersion(v: string): string {
  return v.trim().replace(/^v/i, '');
}

/**
 * Returns true if candidateVersion is strictly newer than currentVersion according to semver.
 */
export function isVersionNewer(candidateVersion: string, currentVersion: string): boolean {
  const c1 = normalizeVersion(candidateVersion);
  const c2 = normalizeVersion(currentVersion);
  if (!c1 || !c2) return false;

  const p1 = c1.split('.').map((n) => parseInt(n, 10) || 0);
  const p2 = c2.split('.').map((n) => parseInt(n, 10) || 0);
  const maxLen = Math.max(p1.length, p2.length);

  for (let i = 0; i < maxLen; i++) {
    const num1 = p1[i] ?? 0;
    const num2 = p2[i] ?? 0;
    if (num1 > num2) return true;
    if (num1 < num2) return false;
  }
  return false;
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return 'Unknown size';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export function formatReleaseDate(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

/**
 * Fetches the latest published release for AquaPlus Service from the public GitHub API.
 */
export async function fetchLatestRelease(): Promise<GitHubReleaseInfo> {
  const response = await fetch(GITHUB_API_LATEST_RELEASE, {
    headers: {
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API returned HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  const rawTag = (data.tag_name as string) || '';
  const version = normalizeVersion(rawTag);

  // Look for the compiled APK asset
  const apkAsset = Array.isArray(data.assets)
    ? data.assets.find((a: any) => typeof a.name === 'string' && a.name.endsWith('.apk'))
    : null;

  const apkDownloadUrl = apkAsset?.browser_download_url || (data.html_url as string) || APP_LATEST_RELEASE_URL;
  const apkFileName = apkAsset?.name || `AquaPlus-Service-v${version || APP_VERSION}.apk`;
  const apkSize = typeof apkAsset?.size === 'number' ? apkAsset.size : null;

  return {
    tagName: rawTag || `v${version}`,
    version: version || APP_VERSION,
    name: (data.name as string) || `AquaPlus Service v${version}`,
    publishedAt: (data.published_at as string) || '',
    publishedDateFormatted: formatReleaseDate(data.published_at as string),
    htmlUrl: (data.html_url as string) || APP_LATEST_RELEASE_URL,
    apkDownloadUrl,
    apkFileName,
    apkSize,
    apkSizeFormatted: formatBytes(apkSize),
    body: (data.body as string) || '',
    isUpdateAvailable: isVersionNewer(version, APP_VERSION),
  };
}
