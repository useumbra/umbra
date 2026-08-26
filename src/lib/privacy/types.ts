export type EntityType =
  | "EMAIL"
  | "PHONE"
  | "IP_V4"
  | "IP_V6"
  | "URL"
  | "EVM_ADDRESS"
  | "TX_HASH"
  | "SECRET"
  | "CREDIT_CARD"
  | "IBAN"
  | "NATIONAL_ID"
  | "PERSON"
  | "LOCATION"
  | "ORG"
  | "MONEY"
  | "DATE_OF_BIRTH"
  | "HEALTH_TERM";
export type Severity = "low" | "medium" | "high";
export type PrivacyMode = "off" | "smart" | "full";
export type Entity = {
  type: EntityType;
  start: number;
  end: number;
  value: string;
  placeholder: string;
  severity: Severity;
  confidence: number;
};
export type Detector = (text: string) => Omit<Entity, "placeholder">[];
export type Receipt = {
  count: number;
  entities: Entity[];
  originalLength: number;
  redactedLength: number;
};
