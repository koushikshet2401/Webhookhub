// backend/src/utils/urlSafety.js

const dns = require('dns').promises;
const net = require('net');

// IPv4 ranges that must never be reachable via a registered webhook
// endpoint - private networks, loopback, link-local (which is also where
// every major cloud provider's metadata service lives: 169.254.169.254).
const BLOCKED_IPV4_RANGES = [
  { base: '127.0.0.0', bits: 8 },   // loopback
  { base: '10.0.0.0', bits: 8 },    // private
  { base: '172.16.0.0', bits: 12 }, // private
  { base: '192.168.0.0', bits: 16 }, // private
  { base: '169.254.0.0', bits: 16 }, // link-local / cloud metadata
  { base: '100.64.0.0', bits: 10 }, // shared address space (CGNAT)
  { base: '0.0.0.0', bits: 8 },     // "this network"
];

function ipv4ToLong(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0;
}

function isBlockedIPv4(ip) {
  const ipLong = ipv4ToLong(ip);
  return BLOCKED_IPV4_RANGES.some(({ base, bits }) => {
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (ipLong & mask) === (ipv4ToLong(base) & mask);
  });
}

// IPv6: block loopback, unique-local (private), and link-local. This is a
// prefix check, not a full IPv6 CIDR engine - good enough to stop the
// realistic threat without pulling in a dependency for it.
function isBlockedIPv6(ip) {
  const lower = ip.toLowerCase();
  if (lower === '::1') return true; // loopback
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // fc00::/7 unique-local
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) {
    return true; // fe80::/10 link-local
  }
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) - check the embedded IPv4 address too
  const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIPv4(mapped[1]);
  return false;
}

function isBlockedIp(ip) {
  return net.isIP(ip) === 4 ? isBlockedIPv4(ip) : isBlockedIPv6(ip);
}

/**
 * Resolves the URL's hostname and throws if it points anywhere private,
 * loopback, link-local, or at a cloud metadata service. Call this both when
 * an endpoint is created/updated AND again right before actual delivery -
 * checking only at creation time leaves a DNS-rebinding gap where the
 * hostname could resolve to a different (internal) IP by the time a
 * delivery actually fires.
 */
async function assertPublicUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('URL must use http or https');
  }

  const hostname = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new Error('URL must not point at localhost');
  }

  // If the hostname is already a literal IP, check it directly
  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new Error('URL resolves to a private, loopback, or link-local address');
    }
    return;
  }

  // Otherwise resolve it - this is the step that catches "evil.com" being
  // pointed at 127.0.0.1 or an internal IP via DNS.
  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  } catch {
    throw new Error('Could not resolve URL hostname');
  }

  const blocked = addresses.find((a) => isBlockedIp(a.address));
  if (blocked) {
    throw new Error('URL resolves to a private, loopback, or link-local address');
  }
}

module.exports = { assertPublicUrl, isBlockedIp };