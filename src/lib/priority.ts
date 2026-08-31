export type PriorityPlan = {
  retries: number;
  upgradeGeneralRoute: boolean;
};

export const priorityForTier = (tier?: string): PriorityPlan => {
  switch (tier) {
    case "holder":
      return { retries: 1, upgradeGeneralRoute: false };
    case "circle":
      return { retries: 2, upgradeGeneralRoute: true };
    case "council":
      return { retries: 3, upgradeGeneralRoute: true };
    default:
      return { retries: 0, upgradeGeneralRoute: false };
  }
};

export const retryableProviderStatuses = new Set([429, 500, 502, 503, 504]);
