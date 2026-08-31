export type HolderLimits = {
  councilSeats: number;
  chatMaxTokens: number;
  codeMaxTokens: number;
};

export const limitsForTier = (tier?: string): HolderLimits => {
  switch (tier) {
    case "holder":
      return { councilSeats: 3, chatMaxTokens: 12_288, codeMaxTokens: 8_000 };
    case "circle":
      return { councilSeats: 5, chatMaxTokens: 16_384, codeMaxTokens: 12_000 };
    case "council":
      return { councilSeats: 5, chatMaxTokens: 24_576, codeMaxTokens: 16_000 };
    default:
      return { councilSeats: 3, chatMaxTokens: 8_192, codeMaxTokens: 6_000 };
  }
};

export const maxHolderLimits = limitsForTier("council");
