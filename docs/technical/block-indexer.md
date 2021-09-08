# Block-indexer

## Description
- processes all blocks from the last processed block to the `headBlock - REORG_PROTECTION_COUNT`
- subscribe to the `block` event and process the block
- single instance

## Block processing
From the last processed block, we are fetching block loggs per block loggs. If the block contains any loggs, we insert the block into the postgres database. 
if the log address is the same as one of the saleContracts addresses, we check the name of the log. If the log name is `Claim`, we insert the log data into the redis queue for future processing from the `claim_executor`.
```
{
    walletAddress: parsedLog.args?.token.walletAddress,
    receiver: parsedLog.args?.substrateAddress,
    amount: parsedLog.args?.amount.toNumber(),
    claimTxHash: log.transactionHash,
    saleContractId: parsedLog.args?.token.tokenID
}
```
 
If the log comes from the factoryContract (we get the factoryContract address from the deployments.json file) and the log name is `CreateSaleContract` we insert the saleContract information into postgres database 
```
{
    id: ${this.config.CHAIN_ID}_${parsedLog.args?.tokenSaleAddress}`,
    address: parsedLog.args?.tokenSaleAddress,
    walletAddress: parsedLog.args.token.walletAddress,
    chainId: this.config.CHAIN_ID,
    blockHash: log.blockHash
}
```        
 and store the address in an in-memory array for future block loggs checks.
                
After we process all blocks to the `headBlock -REORG_PROTECTION_COUNT`, we subscribe to the `block` event. When a new block is mined(every 6 seconds) we do the block processing for the block that is `mined - REORG_PROTECTION_COUNT`.