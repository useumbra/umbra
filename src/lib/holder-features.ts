export type EarlyFeature = {
  id: string;
  name: string;
  description: string;
  minTier: string;
};

export const earlyFeatures: EarlyFeature[] = [
  {
    id: "vote",
    name: "Roadmap vote",
    description:
      "Verified holders vote on which provider, detector, and surface Umbra ships next.",
    minTier: "holder",
  },
];

export const tierRank = (tier?: string): number => {
  switch (tier) {
    case "holder":
      return 1;
    case "circle":
      return 2;
    case "council":
      return 3;
    default:
      return 0;
  }
};

export const unlockedFeatures = (tier?: string): EarlyFeature[] =>
  earlyFeatures.filter(
    (feature) => tierRank(tier) >= tierRank(feature.minTier),
  );

export const hasFeature = (id: string, tier?: string): boolean =>
  unlockedFeatures(tier).some((feature) => feature.id === id);
