export class Vault {
  private values = new Map<string, string>();
  private reverse = new Map<string, string>();

  get(value: string, type: string): string {
    const existing = this.values.get(`${type}:${value}`);
    if (existing) return existing;
    const prefix =
      type === "EVM_ADDRESS" || type === "TX_HASH" ? "WALLET" : type;
    const used = [...this.values.values()].filter((item) =>
      item.startsWith(`[${prefix}_`),
    ).length;
    const placeholder = `[${prefix}_${used + 1}]`;
    this.values.set(`${type}:${value}`, placeholder);
    this.reverse.set(placeholder, value);
    return placeholder;
  }

  restore(placeholder: string) {
    return this.reverse.get(placeholder);
  }
  toJSON() {
    return { values: [...this.values], reverse: [...this.reverse] };
  }
  static fromJSON(input: {
    values?: [string, string][];
    reverse?: [string, string][];
  }) {
    const vault = new Vault();
    vault.values = new Map(input.values ?? []);
    vault.reverse = new Map(input.reverse ?? []);
    return vault;
  }
}
