import { ApiPromise, Keyring, WsProvider } from "@polkadot/api";
import { AddressOrPair, SubmittableResultResult } from "@polkadot/api/types";
import { BN } from "@polkadot/util";

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
    amount: BN
  ): Promise<SubmittableResultResult<"promise">> {
    return await this.api.tx.assets
      .transferApproved(tokenId, owner, receiver, amount)
      .signAndSend(this.wallet);
  }
}
