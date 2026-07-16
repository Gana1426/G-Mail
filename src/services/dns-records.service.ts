import crypto from "crypto";
import type { Domain } from "@prisma/client";
import { dnsRecordRepository } from "@/repositories/dns-record.repository";
import { config } from "@/config";
import type { DnsRecordItem, DkimKeyPair, DnsCheckResult } from "@/types";

export class DnsRecordsService {
  getServerIp(): string {
    return config.mail.serverIp;
  }

  getMailHost(domainName: string): string {
    return `mail.${domainName.toLowerCase()}`;
  }

  /** Use the domain-scoped mail host; ignore stale placeholder mxRecord values. */
  resolveMailHost(domainName: string, mxRecord?: string | null): string {
    const expected = this.getMailHost(domainName);
    if (!mxRecord) return expected;

    const normalized = mxRecord.toLowerCase().replace(/\.$/, "");
    if (
      normalized === "mail.example.com" ||
      normalized === expected ||
      normalized.endsWith(`.${domainName.toLowerCase()}`)
    ) {
      return normalized === "mail.example.com" ? expected : normalized;
    }

    return expected;
  }

  generateSpfRecord(): string {
    return `v=spf1 mx ip4:${this.getServerIp()} -all`;
  }

  generateDmarcRecord(domainName: string): string {
    return `v=DMARC1; p=none; rua=mailto:dmarc@${domainName.toLowerCase()}`;
  }

  generateDkimKeys(selector = "mail"): DkimKeyPair {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });

    const publicKeyBase64 = publicKey
      .replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\n/g, "");

    return {
      selector,
      privateKey,
      publicKey,
      dnsRecord: `${selector}._domainkey IN TXT "v=DKIM1; k=rsa; p=${publicKeyBase64}"`,
    };
  }

  formatDkimTxtValue(publicKeyPem: string): string {
    const publicKeyBase64 = publicKeyPem
      .replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\n/g, "");
    return `v=DKIM1; k=rsa; p=${publicKeyBase64}`;
  }

  buildRecords(domain: Domain, dkimPublicKeyPem?: string): DnsRecordItem[] {
    const mailHost = this.resolveMailHost(domain.name, domain.mxRecord);
    const dkimHost = `${domain.dkimSelector}._domainkey`;
    const publicKey = dkimPublicKeyPem ?? domain.dkimPublicKey ?? "";
    const dkimValue = publicKey ? this.formatDkimTxtValue(publicKey) : "";

    return [
      {
        type: "MX",
        host: "@",
        value: mailHost,
        priority: 10,
        ttl: 3600,
        status: domain.mxStatus,
      },
      {
        type: "A",
        host: "mail",
        value: this.getServerIp(),
        ttl: 3600,
        status: domain.aRecordStatus,
      },
      {
        type: "TXT",
        host: "@",
        value: domain.spfRecord ?? this.generateSpfRecord(),
        ttl: 3600,
        status: domain.spfStatus,
      },
      {
        type: "TXT",
        host: dkimHost,
        value: dkimValue,
        ttl: 3600,
        status: domain.dkimStatus,
      },
      {
        type: "TXT",
        host: "_dmarc",
        value: domain.dmarcRecord ?? this.generateDmarcRecord(domain.name),
        ttl: 3600,
        status: domain.dmarcStatus,
      },
      {
        type: "CNAME",
        host: "autodiscover",
        value: mailHost,
        ttl: 3600,
        status: domain.autodiscoverStatus,
      },
      {
        type: "CNAME",
        host: "autoconfig",
        value: mailHost,
        ttl: 3600,
        status: domain.autoconfigStatus,
      },
    ];
  }

  async saveRecords(domainId: string, records: DnsRecordItem[]): Promise<void> {
    await dnsRecordRepository.deleteByDomain(domainId);
    await dnsRecordRepository.createMany(
      records.map((r) => ({
        domainId,
        type: r.type,
        host: r.host,
        value: r.value,
        priority: r.priority ?? null,
        ttl: r.ttl,
        status: r.status ?? "PENDING",
      }))
    );
  }

  async getOrGenerateRecords(domain: Domain): Promise<DnsRecordItem[]> {
    const stored = await dnsRecordRepository.findByDomain(domain.id);

    if (stored.length > 0) {
      return stored.map((r) => ({
        type: r.type,
        host: r.host,
        value: r.value,
        priority: r.priority ?? undefined,
        ttl: r.ttl,
        status: r.status,
      }));
    }

    const generated = this.buildRecords(domain);
    await this.saveRecords(domain.id, generated);
    return generated;
  }

  async syncStatusesFromCheck(
    domainId: string,
    domain: Domain,
    dnsCheck: DnsCheckResult
  ): Promise<DnsRecordItem[]> {
    const records = await this.getOrGenerateRecords(domain);

    const statusByHost: Record<string, DnsRecordItem["status"]> = {
      "@": dnsCheck.mx.status,
      mail: dnsCheck.a.status,
      _dmarc: dnsCheck.dmarc.status,
      autodiscover: dnsCheck.autodiscover.status,
      autoconfig: dnsCheck.autoconfig.status,
      [`${domain.dkimSelector}._domainkey`]: dnsCheck.dkim.status,
    };

    for (const record of records) {
      let status: DnsRecordItem["status"] = "PENDING";

      if (record.type === "TXT" && record.host === "@") {
        status = dnsCheck.spf.status;
      } else if (record.host.includes("_domainkey")) {
        status = dnsCheck.dkim.status;
      } else {
        status = statusByHost[record.host] ?? "PENDING";
      }

      record.status = status;
    }

    await this.saveRecords(domainId, records);
    return records;
  }

  countVerified(dnsCheck: DnsCheckResult): { verified: number; total: number } {
    const checks = [
      dnsCheck.mx,
      dnsCheck.a,
      dnsCheck.spf,
      dnsCheck.dkim,
      dnsCheck.dmarc,
      dnsCheck.autodiscover,
      dnsCheck.autoconfig,
    ];
    const verified = checks.filter((c) => c.status === "VALID").length;
    return { verified, total: checks.length };
  }

  isFullyVerified(dnsCheck: DnsCheckResult): boolean {
    const { verified, total } = this.countVerified(dnsCheck);
    return verified === total;
  }
}

export const dnsRecordsService = new DnsRecordsService();
