import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnDestroy,
  OnInit,
} from "@angular/core";
import { Asset } from "src/app/_classes/asset";
import { MarketsModalComponent } from "../markets-modal/markets-modal.component";
import { MatDialog } from "@angular/material/dialog";
import { UserService } from "src/app/_services/user.service";
import { AssetAndBalance } from "src/app/_classes/asset-and-balance";
import {
  MainViewsEnum,
  OverlaysService,
} from "src/app/_services/overlays.service";
import { EthUtilsService } from "src/app/_services/eth-utils.service";
import { User } from "src/app/_classes/user";
import { Subscription } from "rxjs";
import { baseToAsset } from "@xchainjs/xchain-util";
import { MidgardService } from "src/app/_services/midgard.service";
import { ThorchainPricesService } from "src/app/_services/thorchain-prices.service";
import { CurrencyService } from "src/app/_services/currency.service";
import { Currency } from "../account-settings/currency-converter/currency-converter.component";
import { PoolAddressDTO } from "src/app/_classes/pool-address";
import { TxType } from "src/app/_const/tx-type";

@Component({
  selector: "app-asset-input",
  templateUrl: "./asset-input.component.html",
  styleUrls: ["./asset-input.component.scss"],
})
export class AssetInputComponent implements OnInit, OnDestroy {
  /**
   * Selected Asset
   */
  @Input() set selectedAsset(asset: Asset) {
    this._selectedAsset = asset;
    this.checkUsdBalance();
    this.setInputUsdValue();
  }
  get selectedAsset() {
    return this._selectedAsset;
  }
  @Output() selectedAssetChange = new EventEmitter<Asset>();
  private _selectedAsset: Asset;

  /**
   * Asset Unit
   */
  @Input() set assetUnit(amount: number) {
    this._assetUnit = amount;
    this.setInputUsdValue();
  }
  get assetUnit() {
    return this._assetUnit;
  }
  @Output() assetUnitChange = new EventEmitter<number>();
  _assetUnit: number;

  @Input() label: string;
  @Input() disableInput?: boolean;
  @Input() disableUser?: boolean;
  @Input() disabledAssetSymbol: string;
  @Input() isWallet: boolean = false;

  /**
   * Wallet balance
   */
  @Input() set balance(bal: number) {
    this._balance = bal;
    this.checkUsdBalance();
  }
  get balance() {
    return this._balance;
  }
  _balance: number;

  @Input() hideMax: boolean;
  @Input() extraLabel: string;
  @Input() showBalance: boolean = true;
  @Input() showPrice: boolean = true;
  @Input() isDeposit: boolean = false;
  @Output() lunchMarket = new EventEmitter<null>();

  @Input() disabledMarketSelect: boolean;
  @Input() loading: boolean;
  @Input() error: boolean;
  @Input() set selectableMarkets(markets: AssetAndBalance[]) {
    this._selectableMarkets = markets;
    this.checkUsdBalance();
    this.setInputUsdValue();
  }
  get selectableMarkets() {
    return this._selectableMarkets;
  }
  _selectableMarkets: AssetAndBalance[];

  @Input() priceInput: number;
  @Input() inputColor: string;
  @Input() txType?: TxType;

  usdValue: number;
  user: User;
  subs: Subscription[];
  inputUsdValue: number;
  currency: Currency;
  inboundAddresses: PoolAddressDTO[];

  constructor(
    private userService: UserService,
    private ethUtilsService: EthUtilsService,
    public overlayService: OverlaysService,
    private midgardService: MidgardService,
    private thorchainPricesService: ThorchainPricesService,
    private currencyService: CurrencyService
  ) {
    const user$ = this.userService.user$.subscribe(
      (user) => (this.user = user)
    );

    const curs$ = this.currencyService.cur$.subscribe((currency) => {
      this.currency = currency;
    });
    this.subs = [user$];
  }

  ngOnInit() {
    this.setPoolAddresses();
  }

  setPoolAddresses() {
    this.midgardService
      .getInboundAddresses()
      .subscribe((res) => (this.inboundAddresses = res));
  }

  checkUsdBalance(): void {
    if (!this.balance || !this.selectableMarkets) {
      return;
    }

    const targetPool = this.selectableMarkets.find(
      (market) =>
        `${market.asset.chain}.${market.asset.ticker}` ===
        `${this.selectedAsset.chain}.${this.selectedAsset.ticker}`
    );
    if (!targetPool || !targetPool.assetPriceUSD) {
      return;
    }

    this.usdValue = targetPool.assetPriceUSD * this.balance;
  }

  setInputUsdValue(): void {
    if (!this.selectedAsset || !this.selectableMarkets) {
      return;
    }

    const targetPool = this.selectableMarkets.find(
      (market) =>
        `${market.asset.chain}.${market.asset.ticker}` ===
        `${this.selectedAsset.chain}.${this.selectedAsset.ticker}`
    );
    if (!targetPool || !targetPool.assetPriceUSD) {
      return;
    }
    this.inputUsdValue = targetPool.assetPriceUSD * this.assetUnit;
  }

  updateAssetUnits(val): void {
    this.assetUnitChange.emit(val);
    this.setInputUsdValue();
  }

  getMax() {
    if (this.balance && this.selectedAsset) {
      return this.userService.maximumSpendableBalance(
        this.selectedAsset,
        this.balance,
        this.inboundAddresses,
        this.txType ?? "INBOUND"
      );
    }
  }

  async setMax(): Promise<void> {
    this.loading = true;

    if (this.balance && this.inboundAddresses) {
      const max = this.userService.maximumSpendableBalance(
        this.selectedAsset,
        this.balance,
        this.inboundAddresses,
        this.txType ?? "INBOUND"
      );

      if (max) {
        this.assetUnitChange.emit(max);
      } else {
        console.error("max undefined");
      }
    }

    this.loading = false;
  }

  launchMarketsModal(): void {
    this.lunchMarket.emit();
  }

  async gotoWallet() {
    const userBalance$ = this.userService.userBalances$.subscribe(
      (balances) => {
        if (balances) {
          const balance = balances.filter(
            (balance) =>
              balance.asset.chain === this.selectedAsset.chain &&
              balance.asset.ticker === this.selectedAsset.ticker
          )[0];

          const assetString = `${balance.asset.chain}.${balance.asset.symbol}`;
          const asset = new Asset(
            `${balance.asset.chain}.${balance.asset.symbol}`
          );
          let assetBalance: AssetAndBalance;
          this.midgardService.getPools().subscribe(async (pools) => {
            if (asset.ticker === "RUNE") {
              assetBalance = {
                asset,
                assetPriceUSD:
                  this.thorchainPricesService.estimateRunePrice(pools) ?? 0,
                balance: baseToAsset(balance.amount),
              };
            } else {
              const matchingPool = pools.find((pool) => {
                return pool.asset === assetString;
              });

              assetBalance = {
                asset,
                assetPriceUSD: matchingPool ? +matchingPool.assetPriceUSD : 0,
                balance: baseToAsset(balance.amount),
              };
            }
            const address = await this.userService.getAdrressChain(
              this.selectedAsset.chain
            );
            this.overlayService.setCurrentUserView({
              userView: "Asset",
              address,
              chain: this.selectedAsset.chain,
              asset: assetBalance,
            });
            this.overlayService.setCurrentView(MainViewsEnum.UserSetting);
          });
        }
      }
    );

    this.subs.push(userBalance$);
  }

  ngOnDestroy() {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }
  }
}
