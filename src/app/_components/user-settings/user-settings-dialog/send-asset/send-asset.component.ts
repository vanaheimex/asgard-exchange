import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from "@angular/core";
import { address } from "bitcoinjs-lib";
import { Subscription } from "rxjs";
import { getChainAsset } from "src/app/_classes/asset";
import { AssetAndBalance } from "src/app/_classes/asset-and-balance";
import { PoolAddressDTO } from "src/app/_classes/pool-address";
import { User } from "src/app/_classes/user";
import { OverlaysService } from "src/app/_services/overlays.service";
import { MidgardService } from "src/app/_services/midgard.service";
import { TransactionUtilsService } from "src/app/_services/transaction-utils.service";
import { UserService } from "src/app/_services/user.service";

@Component({
  selector: "app-send-asset",
  templateUrl: "./send-asset.component.html",
  styleUrls: ["./send-asset.component.scss"],
})
export class SendAssetComponent implements OnInit, OnDestroy {
  @Output() back: EventEmitter<null>;
  @Output() confirmSend: EventEmitter<{
    amount: number;
    recipientAddress: string;
    memo: string;
  }>;
  @Input() asset: AssetAndBalance;

  message: string;

  get amount() {
    return this._amount;
  }
  set amount(val: number) {
    this._amount = val;
    if (!val) this._amount = 0;
    this.checkSpendable();
  }
  private _amount: number;
  recipientAddress: string;
  chainBalance: number;
  balance: number;
  amountSpendable: boolean;
  user: User;
  subs: Subscription[];
  explorerPath: string;
  address: string;
  isMaxError: boolean;

  memo: string;
  inboundAddresses: PoolAddressDTO[];

  constructor(
    private userService: UserService,
    private overlaysService: OverlaysService,
    private midgardService: MidgardService,
    private txUtilsService: TransactionUtilsService
  ) {
    this.recipientAddress = "";
    this.memo = "";
    this.back = new EventEmitter<null>();
    this.confirmSend = new EventEmitter<{
      amount: number;
      recipientAddress: string;
      memo: string;
    }>();
    this.amountSpendable = false;
    this.message = "prepare";
  }

  ngOnInit(): void {
    this.setInboundAddresses();

    if (this.asset) {
      const balances$ = this.userService.userBalances$.subscribe((balances) => {
        this.balance = this.userService.findBalance(balances, this.asset.asset);

        this.chainBalance = this.userService.findBalance(
          balances,
          getChainAsset(this.asset?.asset.chain)
        );
      });

      const user$ = this.userService.user$.subscribe((user) => {
        this.user = user;
      });

      this.subs = [balances$, user$];
    }
  }

  setInboundAddresses() {
    this.midgardService.getInboundAddresses().subscribe({
      next: (res) => (this.inboundAddresses = res),
    });
  }

  nextDisabled(): boolean {
    if (!this.user) {
      return true;
    }

    if (!this.asset) {
      return true;
    }

    const client = this.userService.getChainClient(
      this.user,
      this.asset.asset.chain
    );
    if (!client) {
      return true;
    }

    if (!this.inboundAddresses || !this.asset || !this.chainBalance) {
      return true;
    }

    if (
      this.chainBalance <
      this.txUtilsService.calculateNetworkFee(
        getChainAsset(this.asset.asset.chain),
        this.inboundAddresses,
        "EXTERNAL"
      )
    ) {
      return true;
    }

    if (client.getAddress() === this.recipientAddress) {
      return true;
    }

    return (
      !this.amountSpendable ||
      !client.validateAddress(this.recipientAddress) ||
      this.amount <= 0
    );
  }

  mainButtonText(): string {
    if (!this.user) {
      return "Connect Wallet";
    }

    if (!this.asset) {
      return "Prepare";
    }

    if (!this.inboundAddresses || this.chainBalance == undefined) {
      return "Loading";
    }

    const client = this.userService.getChainClient(
      this.user,
      this.asset.asset.chain
    );
    if (!client) {
      return `No ${this.asset.asset.chain} Client Found`;
    }

    if (this.isMaxError) {
      return "Input Amount Less Than Fees";
    }

    if (
      this.amount <= 0 ||
      !this.amount ||
      !this.recipientAddress ||
      (this.recipientAddress && this.recipientAddress.length <= 10)
    ) {
      return "Prepare";
    }

    if (
      !client.validateAddress(this.recipientAddress) ||
      client.getAddress() === this.recipientAddress
    ) {
      return `Invalid ${this.asset.asset.chain} Address`;
    }

    /** Insufficient Chain balance */
    if (
      this.chainBalance <
      this.txUtilsService.calculateNetworkFee(
        getChainAsset(this.asset.asset.chain),
        this.inboundAddresses,
        "EXTERNAL"
      )
    ) {
      const chainAsset = getChainAsset(this.asset.asset.chain);
      return `Insufficient ${chainAsset.chain}.${chainAsset.ticker} for fees`;
    }

    if (!this.amountSpendable) {
      return `INSUFFICIENT ${this.asset.asset.ticker}`;
    }

    return "Ready";
  }

  isError(): boolean {
    if (
      this.mainButtonText() === "Ready" ||
      this.mainButtonText() === "Prepare" ||
      this.mainButtonText() === "Connect Wallet" ||
      this.mainButtonText() === "Loading"
    ) {
      return false;
    }

    return true;
  }

  setMaxError(val) {
    this.isMaxError = val;

    setTimeout(
      () => {
        this.isMaxError = false;
      }
    , 2000)
  }

  checkSpendable(): void {
    const maximumSpendableBalance = this.userService.maximumSpendableBalance(
      this.asset.asset,
      this.balance,
      this.inboundAddresses,
      "EXTERNAL"
    );
    this.amountSpendable = this.amount <= maximumSpendableBalance;
    console.log("amount", this.amount);
    console.log("max spend", maximumSpendableBalance);
    this.message =
      this.amount > 0 &&
      this.amountSpendable &&
      this.recipientAddress.length > 12
        ? "ready"
        : "prepare";
  }

  async navCaller(nav) {
    this.address = await this.userService.getAdrressChain(
      this.asset.asset.chain
    );

    if (nav === "wallet")
      this.overlaysService.setCurrentUserView({
        userView: "Addresses",
        address: null,
        chain: null,
        asset: null,
      });
    else if (nav === "chain")
      this.overlaysService.setCurrentUserView({
        userView: "Address",
        address: this.address,
        chain: this.asset.asset.chain,
        asset: null,
      });
    else if (nav === "asset")
      this.overlaysService.setCurrentUserView({
        userView: "Address",
        address: this.address,
        chain: this.asset.asset.chain,
        asset: this.asset,
      });
  }

  ngOnDestroy() {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }
  }
}
