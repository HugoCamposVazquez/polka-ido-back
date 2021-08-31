import { ApiPromise, Keyring, WsProvider } from "@polkadot/api";
import { AddressOrPair, SubmittableExtrinsic } from "@polkadot/api/types";
import { EventRecord, ExtrinsicStatus } from "@polkadot/types/interfaces";
import { BN } from "@polkadot/util";

import { logger } from "../logger";
import { waitFor } from "../utils";

export class StatemintWallet {
  private mnemonic: string;

  private api!: ApiPromise;
  private wallet!: AddressOrPair;

  constructor(mnemonic: string) {
    this.mnemonic = mnemonic;
  }

  public async initWallet(statemintUrl: string): Promise<void> {
    const wsProvider = new WsProvider(statemintUrl);
    await wsProvider.isReady;
    this.api = await ApiPromise.create({ provider: wsProvider });

    const keyring = new Keyring({ type: "sr25519" });
    this.wallet = keyring.addFromUri(this.mnemonic);
  }

  public async transferFrom(
    tokenId: number,
    owner: string,
    receiver: string,
    amount: BN,
    claimId: string
  ): Promise<void> {
    const tx = this.api.tx.assets.transferApproved(
      tokenId,
      owner,
      receiver,
      amount
    );
    await this.executeAndWaitForTx(tx, {
      claimId: claimId,
    });
  }

  public async executeAndWaitForTx(
    tx: SubmittableExtrinsic<"promise">,
    txInfo: Record<string, unknown>
  ): Promise<void> {
    let currentTxDone = false;
    let error: string | undefined;

    const txStatusFunction = function ({
      events = [],
      status,
    }: {
      events?: EventRecord[];
      status: ExtrinsicStatus;
    }): void {
      if (status.isInvalid) {
        error = "Invalid transaction";
        currentTxDone = true;
      } else if (status.isInBlock) {
        logger.info(
          { txInfo: txInfo, blockHash: status.asInBlock },
          "Transaction included in block"
        );
      } else if (status.isFinalized) {
        logger.info(
          {
            txInfo: txInfo,
            blockHash: status.asFinalized,
          },
          `Transaction finalized`
        );

        events.forEach(({ event }) => {
          if (event.method === "ExtrinsicFailed") {
            console.log(JSON.stringify(event, null, 2));
            error = event.meta.documentation.toString();
          }
        });

        currentTxDone = true;
      }
    };

    await tx.signAndSend(this.wallet, txStatusFunction);
    await waitFor(() => currentTxDone, { timeout: 100000 });

    if (error) {
      throw new Error(error);
    }
  }
}
