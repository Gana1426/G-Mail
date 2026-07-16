import dns from "dns/promises";
import type { DnsRecordCheck } from "@/types";

function normalizeTxt(records: string[][]): string[] {
  return records.map((parts) => parts.join(""));
}

function txtMatches(actual: string[], expected: string): boolean {
  const normalized = expected.replace(/\s+/g, "").toLowerCase();
  return actual.some((r) => r.replace(/\s+/g, "").toLowerCase().includes(normalized));
}

function mxMatches(
  records: { exchange: string; priority: number }[],
  expectedHost: string,
  expectedPriority = 10
): boolean {
  const host = expectedHost.toLowerCase().replace(/\.$/, "");
  return records.some(
    (r) =>
      r.exchange.toLowerCase().replace(/\.$/, "") === host &&
      r.priority === expectedPriority
  );
}

function cnameMatches(records: string[], expected: string): boolean {
  const target = expected.toLowerCase().replace(/\.$/, "");
  return records.some((r) => r.toLowerCase().replace(/\.$/, "") === target);
}

function aMatches(records: string[], expectedIp: string): boolean {
  return records.includes(expectedIp);
}

async function safeResolve<T>(
  fn: () => Promise<T>
): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export class DnsService {
  async checkMx(domain: string, expectedHost: string, priority = 10): Promise<DnsRecordCheck> {
    const records = await safeResolve(() => dns.resolveMx(domain));
    if (!records || records.length === 0) {
      return {
        status: "MISSING",
        expected: `${priority} ${expectedHost}`,
        actual: null,
        message: "No MX records found",
      };
    }

    const actual = records.map((r) => `${r.priority} ${r.exchange}`).join(", ");
    const valid = mxMatches(records, expectedHost, priority);
    return {
      status: valid ? "VALID" : "INVALID",
      expected: `${priority} ${expectedHost}`,
      actual,
      message: valid ? "MX record verified" : "MX record does not match expected value",
    };
  }

  async checkA(host: string, expectedIp: string): Promise<DnsRecordCheck> {
    const records = await safeResolve(() => dns.resolve4(host));
    if (!records || records.length === 0) {
      return {
        status: "MISSING",
        expected: expectedIp,
        actual: null,
        message: `No A record found for ${host}`,
      };
    }

    const valid = aMatches(records, expectedIp);
    return {
      status: valid ? "VALID" : "INVALID",
      expected: expectedIp,
      actual: records.join(", "),
      message: valid ? "A record verified" : "A record IP does not match",
    };
  }

  async checkTxt(host: string, expected: string): Promise<DnsRecordCheck> {
    const records = await safeResolve(() => dns.resolveTxt(host));
    if (!records || records.length === 0) {
      return {
        status: "MISSING",
        expected,
        actual: null,
        message: `No TXT records found for ${host}`,
      };
    }

    const flat = normalizeTxt(records);
    const valid = txtMatches(flat, expected);
    return {
      status: valid ? "VALID" : "INVALID",
      expected,
      actual: flat.join(" | "),
      message: valid ? "TXT record verified" : "TXT record does not match expected value",
    };
  }

  async checkDmarc(host: string, expected: string): Promise<DnsRecordCheck> {
    const records = await safeResolve(() => dns.resolveTxt(host));
    if (!records || records.length === 0) {
      return {
        status: "MISSING",
        expected,
        actual: null,
        message: `No DMARC record found for ${host}`,
      };
    }

    const flat = normalizeTxt(records);
    const valid = flat.some((r) => {
      const norm = r.replace(/\s+/g, "").toLowerCase();
      return norm.includes("v=dmarc1") && norm.includes("p=none");
    });

    return {
      status: valid ? "VALID" : "INVALID",
      expected,
      actual: flat.join(" | "),
      message: valid ? "DMARC record verified" : "DMARC record does not match",
    };
  }

  async checkCname(host: string, expected: string): Promise<DnsRecordCheck> {
    const records = await safeResolve(() => dns.resolveCname(host));
    if (!records || records.length === 0) {
      return {
        status: "MISSING",
        expected,
        actual: null,
        message: `No CNAME record found for ${host}`,
      };
    }

    const valid = cnameMatches(records, expected);
    return {
      status: valid ? "VALID" : "INVALID",
      expected,
      actual: records.join(", "),
      message: valid ? "CNAME record verified" : "CNAME record does not match",
    };
  }

  async checkDkim(
    domain: string,
    selector: string,
    publicKeyPem: string
  ): Promise<DnsRecordCheck> {
    const host = `${selector}._domainkey.${domain}`;
    const publicKeyBase64 = publicKeyPem
      .replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\n/g, "");
    const expected = `v=DKIM1; k=rsa; p=${publicKeyBase64}`;

    const records = await safeResolve(() => dns.resolveTxt(host));
    if (!records || records.length === 0) {
      return {
        status: "MISSING",
        expected: host,
        actual: null,
        message: "DKIM record not found",
      };
    }

    const flat = normalizeTxt(records);
    const valid = flat.some((r) =>
      r.replace(/\s+/g, "").includes(publicKeyBase64.slice(0, 32))
    );

    return {
      status: valid ? "VALID" : "INVALID",
      expected: host,
      actual: flat.join(" | "),
      message: valid ? "DKIM record verified" : "DKIM public key does not match",
    };
  }
}

export const dnsService = new DnsService();
