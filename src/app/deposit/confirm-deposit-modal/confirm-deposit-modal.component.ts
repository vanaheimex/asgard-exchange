import {
  Component,
  OnInit,
  Inject,
  OnDestroy,
  Input,
  Output,
  EventEmitter,
} from "@angular/core";
import { MatDialogRef, MAT_DIALOG_DATA } from "@angular/material/dialog";
import { assetToString } from "@xchainjs/xchain-util";
import { Subscription } from "rxjs";
import { PoolAddressDTO } from "src/app/_classes/pool-address";
import { User } from "src/app/_classes/user";
import { TransactionConfirmationState } from "src/app/_const/transaction-confirmation-state";
import { MidgardService } from "src/app/_services/midgard.service";
import { UserService } from "src/app/_services/user.service";
import {
  TransactionStatusService,
  TxActions,
  TxStatus,
} from "src/app/_services/transaction-status.service";
import { EthUtilsService } from "src/app/_services/eth-utils.service";
import { OverlaysService } from "src/app/_services/overlays.service";
import { Router } from "@angular/router";
import { Balances } from "@xchainjs/xchain-client";
import { AssetAndBalance } from "src/app/_classes/asset-and-balance";
import { KeystoreDepositService } from "src/app/_services/keystore-deposit.service";
import { Asset } from "src/app/_classes/asset";
import { AnalyticsService, assetString } from "src/app/_services/analytics.service";

// assets should be added for asset-input as designed.
export interface ConfirmDepositData {
  asset: AssetAndBalance;
  rune: AssetAndBalance;
  assetAmount: number;
  runeAmount: number;
  user: User;
  runeBasePrice: number;
  assetBasePrice: number;
  runeBalance: number;
  assetBalance: number;
  runePrice: number;
  assetPrice: number;
  estimatedFee: number;
  runeFee: number;
}

@Component({
  selector: "app-confirm-deposit-modal",
  templateUrl: "./confirm-deposit-modal.component.html",
  styleUrls: ["./confirm-deposit-modal.component.scss"],
})
export class ConfirmDepositModalComponent implements OnInit, OnDestroy {
  txState: TransactionConfirmationState | "RETRY_RUNE_DEPOSIT";
  hash: string;
  subs: Subscription[];
  error: string;
  insufficientChainBalance: boolean;
  loading: boolean;
  estimatedMinutes: number;
  balances: Balances;

  //foe this interface it should be imported from despoit page
  @Input() data: ConfirmDepositData;
  @Output() close: EventEmitter<boolean> = new EventEmitter<boolean>();

  constructor(
    private txStatusService: TransactionStatusService,
    private midgardService: MidgardService,
    private ethUtilsService: EthUtilsService,
    private userService: UserService,
    private overlaysService: OverlaysService,
    private router: Router,
    private keystoreDepositService: KeystoreDepositService,
    private analyticsService: AnalyticsService
  ) {
    this.loading = true;
    this.txState = TransactionConfirmationState.PENDING_CONFIRMATION;
    const user$ = this.userService.user$.subscribe((user) => {
      if (!user) {
        this.closeDialog();
      }
    });

    const balances$ = this.userService.userBalances$.subscribe(
      (balances) => (this.balances = balances)
    );

    this.subs = [user$, balances$];
  }

  ngOnInit(): void {
    this.estimateTime();
    this.loading = false;
  }

  async estimateTime() {
    if (
      this.data.asset.asset.chain === "ETH" &&
      this.data.asset.asset.symbol !== "ETH"
    ) {
      this.estimatedMinutes = await this.ethUtilsService.estimateERC20Time(
        assetToString(this.data.asset.asset),
        this.data.assetAmount
      );
    } else {
      this.estimatedMinutes = this.txStatusService.estimateTime(
        this.data.asset.asset.chain,
        this.data.assetAmount
      );
    }
  }

  submitTransaction(): void {
    this.txState = TransactionConfirmationState.SUBMITTING;

    this.midgardService.getInboundAddresses().subscribe(async (res) => {
      if (res && res.length > 0) {
        this.deposit(res);
      }
    });

    let depositAmountUSD = this.data.runeAmount * this.data.runePrice + this.data.assetAmount * this.data.assetPrice;
    this.analyticsService.event('pool_deposit_symmetrical_confirm', 'button_deposit_confirm_symmetrical_*POOL_ASSET*_usd_*numerical_usd_value*', depositAmountUSD, assetString(this.data.asset.asset), depositAmountUSD.toString());
  }

  async deposit(pools: PoolAddressDTO[]) {
    const clients = this.data.user.clients;
    const asset = this.data.asset.asset;
    const thorClient = clients.thorchain;
    const thorchainAddress = await thorClient.getAddress();
    let hash = "";

    // get token address
    const address = this.userService.getTokenAddress(
      this.data.user,
      this.data.asset.asset.chain
    );
    if (!address || address === "") {
      console.error("no address found");
      return;
    }

    // find recipient pool
    const recipientPool = pools.find(
      (pool) => pool.chain === this.data.asset.asset.chain
    );
    if (!recipientPool) {
      console.error("no recipient pool found");
      return;
    }

    // Deposit token
    try {
      // deposit using xchain
      switch (this.data.asset.asset.chain) {
        case "BNB":
          hash = await this.keystoreDepositService.binanceDeposit({
            asset: this.data.asset.asset as Asset,
            inputAmount: this.data.assetAmount,
            client: this.data.user.clients.binance,
            thorchainAddress,
            recipientPool,
          });
          break;

        case "BTC":
          hash = await this.keystoreDepositService.bitcoinDeposit({
            asset: this.data.asset.asset as Asset,
            inputAmount: this.data.assetAmount,
            client: this.data.user.clients.bitcoin,
            balances: this.balances,
            thorchainAddress,
            recipientPool,
            estimatedFee: this.data.estimatedFee,
          });
          break;

        case "LTC":
          hash = await this.keystoreDepositService.litecoinDeposit({
            asset: this.data.asset.asset as Asset,
            inputAmount: this.data.assetAmount,
            client: this.data.user.clients.litecoin,
            balances: this.balances,
            thorchainAddress,
            recipientPool,
            estimatedFee: this.data.estimatedFee,
          });
          break;

        case "BCH":
          hash = await this.keystoreDepositService.bchDeposit({
            asset: this.data.asset.asset as Asset,
            inputAmount: this.data.assetAmount,
            client: this.data.user.clients.bitcoinCash,
            balances: this.balances,
            thorchainAddress,
            recipientPool,
            estimatedFee: this.data.estimatedFee,
          });

          break;

        case "ETH":
          hash = await this.keystoreDepositService.ethereumDeposit({
            asset: this.data.asset.asset as Asset,
            inputAmount: this.data.assetAmount,
            balances: this.balances,
            client: this.data.user.clients.ethereum,
            thorchainAddress,
            recipientPool,
          });
          break;

        default:
          console.error(`${this.data.asset.asset.chain} does not match`);
          return;
      }

      if (hash === "") {
        console.error("no hash set");
        return;
      }
    } catch (error) {
      console.error("error making token transfer: ", error);
      this.txState = TransactionConfirmationState.ERROR;
      this.error = error;
      return;
    }

    console.log("pending hash is: ", hash);

    // deposit RUNE
    try {
      const runeHash = await this.keystoreDepositService.runeDeposit({
        client: thorClient,
        inputAmount: this.data.runeAmount,
        memo: `+:${asset.chain}.${asset.symbol}:${address}`,
      });

      this.runeDepositSuccess(runeHash);
    } catch (error) {
      console.error("error making RUNE transfer: ", error);
      this.txState = "RETRY_RUNE_DEPOSIT";
      this.error = error;
    }
  }

  runeDepositSuccess(runeHash: string) {
    this.hash = runeHash;
    this.txStatusService.addTransaction({
      chain: "THOR",
      hash: runeHash,
      ticker: `${this.data.asset.asset.ticker}-RUNE`,
      status: TxStatus.PENDING,
      action: TxActions.DEPOSIT,
      symbol: this.data.asset.asset.symbol,
      isThorchainTx: true,
    });
    this.txState = TransactionConfirmationState.SUCCESS;
  }

  withdrawSuccess(hash: string) {
    this.hash = hash;
    this.txStatusService.addTransaction({
      chain: "THOR",
      hash,
      ticker: `${this.data.asset.asset.ticker}-RUNE`,
      status: TxStatus.PENDING,
      action: TxActions.WITHDRAW,
      symbol: this.data.asset.asset.symbol,
      isThorchainTx: true,
      pollThornodeDirectly: true,
    });
    this.txState = TransactionConfirmationState.SUCCESS;
  }

  breadcrumbNav(nav: string, type: 'pending' | 'success' | 'process') {
    if (nav === "pool") {
      this.router.navigate(["/", "pool"]);
      if (type === 'pending')
        this.analyticsService.event('pool_deposit_symmetrical_confirm', 'breadcrumb_pools');
      else if (type === 'process')
        this.analyticsService.event('pool_deposit_symmetrical_processing', 'breadcrumb_pools');
      else if (type === 'success')
        this.analyticsService.event('pool_deposit_symmetrical_success', 'breadcrumb_pools');
    } else if (nav === "swap") {
      this.router.navigate(["/", "swap"]);
      if (type === 'pending')
        this.analyticsService.event('pool_deposit_symmetrical_confirm', 'breadcrumb_skip');
      else if (type === 'process')
        this.analyticsService.event('pool_deposit_symmetrical_processing', 'breadcrumb_skip');
      else if (type === 'success')
        this.analyticsService.event('pool_deposit_symmetrical_success', 'breadcrumb_skip');
    } else if (nav === "deposit") {
      this.router.navigate([
        "/",
        "deposit",
        `${this.data.asset.asset.chain}.${this.data.asset.asset.symbol}`,
      ]);
    } else if (nav === "deposit-back") {
      this.overlaysService.setCurrentDepositView("Deposit");
    }
  }

  getMessage(): string {
    if (this.error) {
      return this.error;
    } else {
      return "confirm";
    }
  }

  closeDialog(transactionSucess?: boolean) {
    let depositAmountUSD = this.data.runeAmount * this.data.runePrice + this.data.assetAmount * this.data.assetPrice;
    this.analyticsService.event('pool_deposit_symmetrical_confirm', 'button_deposit_cancel_symmetrical_*POOL_ASSET*_usd_*numerical_usd_value*', depositAmountUSD, assetString(this.data.asset.asset), depositAmountUSD.toString());
    this.close.emit(transactionSucess);
  }

  closeToPool() {
    this.router.navigate(["/", "pool"]);
  }

  ngOnDestroy() {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }
  }
}
