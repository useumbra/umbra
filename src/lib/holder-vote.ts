export type PollOption = { id: string; label: string };
export type Poll = { id: string; question: string; options: PollOption[] };

export const polls: Poll[] = [
  {
    id: "provider",
    question: "Which provider should Umbra add next?",
    options: [
      { id: "anthropic", label: "Anthropic direct" },
      { id: "groq", label: "Groq" },
      { id: "mistral", label: "Mistral" },
      { id: "ollama", label: "Local Ollama bridge" },
    ],
  },
  {
    id: "detector",
    question: "Which redaction detector ships next?",
    options: [
      { id: "iban", label: "IBAN and bank account numbers" },
      { id: "medical", label: "Medical record numbers" },
      { id: "diff", label: "Secrets inside pasted diffs" },
    ],
  },
  {
    id: "surface",
    question: "Which surface should open in early access next?",
    options: [
      { id: "sync", label: "Encrypted conversation sync" },
      { id: "team", label: "Shared team workspace" },
      { id: "mobile", label: "Mobile app" },
      { id: "extension", label: "Browser extension" },
    ],
  },
];

export const voteWeight = (tier?: string): number => {
  switch (tier) {
    case "holder":
      return 1;
    case "circle":
      return 3;
    case "council":
      return 10;
    default:
      return 0;
  }
};

export const canVote = (tier?: string): boolean => voteWeight(tier) > 0;

export const findPoll = (pollId: string): Poll | undefined =>
  polls.find((poll) => poll.id === pollId);

export const isPollOption = (pollId: string, optionId: string): boolean =>
  findPoll(pollId)?.options.some((option) => option.id === optionId) ?? false;
