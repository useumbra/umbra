import { readHolderProof } from "./holder-proof";

export const tierFromRequest = (request: Request): string | undefined => {
  const proof = request.headers.get("x-umbra-holder-proof");
  if (!proof) return undefined;
  return readHolderProof(proof)?.tier;
};
