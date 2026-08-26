import { detectEmail, detectPhone, detectUrl, detectIpv4, detectIpv6 } from "./detectors/basic";
import { detectEvm, detectTx, detectSecrets } from "./detectors/crypto";
import { detectCreditCard, detectIban, detectNationalId } from "./detectors/financial";
import { detectPerson, detectLocation, detectOrg, detectMoney, detectDob, detectHealth } from "./detectors/context";
import { Vault } from "./vault";
import type { Detector, Entity, EntityType, PrivacyMode, Receipt, Severity } from "./types";
export { Vault };
export type { Entity, EntityType, PrivacyMode, Receipt };

const detectors: Detector[] = [detectEmail, detectPhone, detectIpv4, detectIpv6, detectUrl, detectEvm, detectTx, detectSecrets, detectCreditCard, detectIban, detectNationalId, detectPerson, detectLocation, detectOrg, detectMoney, detectDob, detectHealth];
const priority: Record<EntityType, number> = { SECRET: 100, NATIONAL_ID: 90, CREDIT_CARD: 90, IBAN: 90, EVM_ADDRESS: 80, TX_HASH: 80, EMAIL: 70, PHONE: 70, PERSON: 60, LOCATION: 50, IP_V4: 40, IP_V6: 40, ORG: 30, MONEY: 20, DATE_OF_BIRTH: 20, HEALTH_TERM: 20, URL: 10 };
const smart = new Set<EntityType>(["PERSON","EMAIL","PHONE","EVM_ADDRESS","TX_HASH","SECRET","CREDIT_CARD","IBAN","NATIONAL_ID","IP_V4","IP_V6","LOCATION"]);
const full = new Set([...smart, "ORG","MONEY","DATE_OF_BIRTH","HEALTH_TERM","URL"]);

export const findEntities = (text: string): Omit<Entity, "placeholder">[] => detectors.flatMap((detector) => detector(text));
const resolve = (found: Omit<Entity, "placeholder">[]) => found.sort((a, b) => priority[b.type] - priority[a.type] || (b.end - b.start) - (a.end - a.start) || a.start - b.start).filter((entity, index, all) => !all.slice(0, index).some((chosen) => entity.start < chosen.end && entity.end > chosen.start)).sort((a, b) => a.start - b.start);
export const redact = (text: string, vault: Vault, mode: PrivacyMode) => {
  const selected = resolve(findEntities(text));
  const entities: Entity[] = [];
  const allowed = mode === "full" ? full : smart;
  const spans = mode === "off" ? [] : selected.filter((entity) => allowed.has(entity.type)).map((entity) => {
    const complete = { ...entity, placeholder: vault.get(entity.value, entity.type) };
    entities.push(complete);
    return complete;
  });
  let cursor = 0; let output = "";
  for (const span of spans) { output += text.slice(cursor, span.start) + span.placeholder; cursor = span.end; }
  output += text.slice(cursor);
  return { text: output, entities: mode === "off" ? selected.map((e) => ({ ...e, placeholder: "" })) : entities, receipt: { count: entities.length, entities: mode === "off" ? selected.map((e) => ({ ...e, placeholder: "" })) : entities, originalLength: text.length, redactedLength: output.length } satisfies Receipt };
};
export const restore = (text: string, vault: Vault) => text.replace(/\[[A-Z_]+_\d+\]/g, (placeholder) => vault.restore(placeholder) ?? placeholder);
export const scoreLeaks = (text: string) => {
  const findings = resolve(findEntities(text)).map((e) => ({ ...e, placeholder: "" }));
  const weights: Record<Severity, number> = { low: 8, medium: 20, high: 38 };
  const raw = findings.reduce((sum, item) => sum + weights[item.severity], 0);
  return { score: Math.min(100, raw), findings, bySeverity: { low: findings.filter((e) => e.severity === "low"), medium: findings.filter((e) => e.severity === "medium"), high: findings.filter((e) => e.severity === "high") } };
};
