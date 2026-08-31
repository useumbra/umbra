export const holderBonusPercent = (tier?: string): number => {
  switch (tier) {
    case "holder":
      return 5;
    case "circle":
      return 10;
    case "council":
      return 20;
    default:
      return 0;
  }
};

export const holderBonusCredits = (credits: number, tier?: string): number => {
  if (!Number.isFinite(credits) || credits < 0)
    throw new Error("Invalid credit amount");
  return Math.round(((credits * holderBonusPercent(tier)) / 100) * 1e6) / 1e6;
};
