export enum QueueType {
  CLAIM_EXECUTOR = "claim_executor",
}
export interface ClaimData {
  walletAddress: string;
  receiver: string;
  amount: string;
  claimTxHash: string;
  saleContractId: string;
  tokenId: number;
}
