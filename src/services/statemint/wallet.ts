import { ApiPromise, Keyring, WsProvider } from "@polkadot/api";
import { AddressOrPair, SubmittableExtrinsic } from "@polkadot/api/types";
import { EventRecord, ExtrinsicStatus } from "@polkadot/types/interfaces";
import { BN } from "@polkadot/util";

import { logger } from "../logger";
import { waitFor } from "../utils";

export class StatemintWallet {
  private wallet: AddressOrPair;
  private api!: ApiPromise;

  constructor(mnemonic: string) {
    const keyring = new Keyring({ type: "sr25519" });
    this.wallet = keyring.addFromUri(mnemonic);
  }

  public async initWallet(statemintUrl: string): Promise<void> {
    const wsProvider = new WsProvider(statemintUrl);
    this.api = await ApiPromise.create({ provider: wsProvider });
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
      } else if (status.isBroadcast) {
        logger.info(txInfo, "Broadcasted transaction");
      } else if (status.isFinalized) {
        events.forEach(({ event }) => {
          if (event.method === "ExtrinsicFailed") {
            error = event.meta.documentation.toString();
          }
        });

        currentTxDone = true;
      }
    };

    await tx.signAndSend(this.wallet, txStatusFunction);
    await waitFor(() => currentTxDone, { timeout: 20000 });

    if (error) {
      throw new Error(error);
    }
  }
}
