import crypto from 'node:crypto';

export interface SignRequestOptions {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: string;
  secretKey: string;
  timestamp?: string;
}

export interface SignedRequest {
  timestamp: string;
  signature: string;
}

/**
 * Sign an OKX REST API request using HMAC-SHA256 per OKX standard auth.
 *
 * Pre-hash format: `timestamp + METHOD + path + body`
 * Signature: Base64(HMAC-SHA256(preHash, secretKey))
 *
 * Timestamp must be ISO 8601 UTC with milliseconds + "Z" suffix,
 * and within 30 seconds of OKX server time.
 */
export function signOkxRequest(opts: SignRequestOptions): SignedRequest {
  if (opts.method !== opts.method.toUpperCase()) {
    throw new Error('HTTP method must be uppercase (GET, POST, etc.)');
  }

  const timestamp = opts.timestamp ?? isoTimestampWithMs();
  const body = opts.body ?? '';
  const preHash = `${timestamp}${opts.method}${opts.path}${body}`;

  const signature = crypto
    .createHmac('sha256', opts.secretKey)
    .update(preHash)
    .digest('base64');

  return { timestamp, signature };
}

function isoTimestampWithMs(): string {
  return new Date().toISOString();
}
