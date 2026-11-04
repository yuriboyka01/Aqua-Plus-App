export function isHttpProtocol(protocol: string): boolean {
  return protocol === 'http:' || protocol === 'https:';
}

export function isAllowedOrigin(origin: string): boolean {
  const configuredAppUrl = process.env.APP_URL?.trim().replace(/\/+$/, '');
  const allowedOrigins = new Set(
    [
      configuredAppUrl,
      'https://localhost',
      'capacitor://localhost',
      `http://${'localhost'}:3000`,
      `http://${'localhost'}:5173`,
      `http://${'127.0.0.1'}:3000`,
      `http://${'127.0.0.1'}:5173`,
    ].filter(Boolean)
  );
  return allowedOrigins.has(origin);
}
