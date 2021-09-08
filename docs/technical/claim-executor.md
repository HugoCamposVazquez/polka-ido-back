# Claim-executor

### Prerequisits
- to make claimExecutor capable of token transfer from owner to the user, the asset owner needs to give claimExecutor wallet transfer approval.
- wallet address defined on the saleContract needs to be the same as the address of the asset owner from which the asset will be transferred to the user.

### Description
- executing claim events from moonbeam parachain on statemint parachain
- supports multi instances

claim executor inits the wallet with mnemonic from `STATEMINT_MNEMONIC` env variable, and starts processing claim event jobs from the redis queue.

### event processing
`claimExecutor` fetches the claim event jobs stored in redis queue and stores them into postgres database 
```
{
    status: ClaimStatus.SUCCESSFUL,
    claimTxHash: job.data.claimTxHash,
    saleContractId: job.data.saleContractId,
    amount: job.data.amount,
    receiver: job.data.receiver
}
```
 after that, the claim executor makes request to the statemint parachain to transfer a certain amount of tokens from the wallet to the user address, that is written in the claim event.