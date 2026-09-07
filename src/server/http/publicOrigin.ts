export class PublicOriginConfigurationError extends Error {
  constructor(message = 'Public application origin is not configured safely') {
    super(message);
    this.name = 'PublicOriginConfigurationError';
  }
}

function isPrivateIpv4(hostname: string): boolean {
  if (/^127\./.test(hostname) || /^10\./.test(hostname) || /^192\.168\./.test(hostname)) return true;
  const match = hostname.match(/^172\.(\d+)\./);
  return Boolean(match && Number(match[1]) >= 16 && Number(match[1]) <= 31);
}

function isInternalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  return host === 'localhost' || host === '0.0.0.0' || host === '::1' ||
    host.startsWith('169.254.') || isPrivateIpv4(host) || host.startsWith('fc') || host.startsWith('fd') || host.startsWith('fe80:');
}

function configuredOrigin(value: string, production: boolean): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new PublicOriginConfigurationError();
  }
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new PublicOriginConfigurationError();
  }
  if (production && (url.protocol !== 'https:' || isInternalHost(url.hostname))) {
    throw new PublicOriginConfigurationError();
  }
  if (!production && url.protocol !== 'https:' && !(url.protocol === 'http:' && url.hostname === 'localhost')) {
    throw new PublicOriginConfigurationError();
  }
  return url.origin;
}

export function resolvePublicOrigin(
  requestUrl: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const configured = env.APP_ORIGIN?.trim();
  const production = env.NODE_ENV === 'production';
  if (configured) return configuredOrigin(configured, production);
  if (production) throw new PublicOriginConfigurationError();
  return new URL(requestUrl).origin;
}

export function buildPublicUrl(
  pathname: string,
  requestUrl: string,
  env: NodeJS.ProcessEnv = process.env,
): URL {
  return new URL(pathname, `${resolvePublicOrigin(requestUrl, env)}/`);
}
