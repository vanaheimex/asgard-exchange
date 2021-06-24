import { Component, OnDestroy, OnInit } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { combineLatest, Subscription } from "rxjs";
import {
  CGCoinListItem,
  CoinGeckoService,
} from "../_services/coin-gecko.service";
import { MidgardService } from "../_services/midgard.service";
import { Asset, isNonNativeRuneToken } from "../_classes/asset";
import { UserService } from "../_services/user.service";
import { Balances } from "@xchainjs/xchain-client";
import { AssetAndBalance } from "../_classes/asset-and-balance";
import {
  ConfirmCreatePoolData,
  ConfirmPoolCreateComponent,
} from "./confirm-pool-create/confirm-pool-create.component";
import { MatDialog } from "@angular/material/dialog";
import { User } from "../_classes/user";
import { baseAmount } from "@xchainjs/xchain-util";
import {
  CreatePoolViews,
  OverlaysService,
} from "../_services/overlays.service";
import { TransactionUtilsService } from "../_services/transaction-utils.service";
import { PoolAddressDTO } from "../_classes/pool-address";
import { AnalyticsService, assetString } from "../_services/analytics.service";

@Component({
  selector: "app-pool-create",
  templateUrl: "./pool-create.component.html",
  styleUrls: ["./pool-create.component.scss"],
})
export class PoolCreateComponent implements OnInit, OnDestroy {
  /**
   * Rune
   */
  rune: Asset;

  get runeAmount() {
    return this._runeAmount;
  }
  set runeAmount(val: number) {
    this._runeAmount = val;
  }
  _runeAmount: number;
  recommendedRuneAmount: number;

  /**
   * Asset
   */
  set asset(val: Asset) {
    if (val) {
      if (!this._asset) {
        this._asset = val;
      } else {
        if (val.symbol !== this._asset.symbol) {
          this.router.navigate(["/", "create-pool"], {
            queryParams: { pool: `${val.chain}.${val.symbol}` },
          });
          this._asset = val;
          this.assetBalance = this.userService.findBalance(
            this.balances,
            this.asset
          );
        }
      }
    }
  }
  get asset() {
    return this._asset;
  }
  _asset: Asset;
  get assetAmount() {
    return this._assetAmount;
  }
  set assetAmount(val: number) {
    this._assetAmount = val;

    if (val) {
      this.updateRuneAmount();
    } else {
      this.runeAmount = null;
      this.recommendedRuneAmount = null;
    }
  }
  private _assetAmount: number;

  assetUsdValue: number;
  runeUsdValue: number;
  balances: Balances;
  subs: Subscription[];
  coinGeckoList: CGCoinListItem[];
  runeBalance: number;
  assetBalance: number;
  chainBalance: number;
  pools: string[];
  selectableMarkets: AssetAndBalance[];

  ethRouter: string;
  ethContractApprovalRequired: boolean;
  user: User;
  depositsDisabled: boolean;

  //view of the page
  view: CreatePoolViews;
  data: ConfirmCreatePoolData;
  networkFee: number;
  runeFee: number;
  minRuneDepositAmount = 1000;
  inboundAddresses: PoolAddressDTO[];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private midgardService: MidgardService,
    private cgService: CoinGeckoService,
    private userService: UserService,
    public overlaysService: OverlaysService,
    private txUtilsService: TransactionUtilsService,
    private analytics: AnalyticsService
  ) {
    this.rune = new Asset(`THOR.RUNE`);
    this.depositsDisabled = false;

    const balances$ = this.userService.userBalances$.subscribe((balances) => {
      this.balances = balances;
      this.runeBalance = this.userService.findBalance(this.balances, this.rune);
      if (this.asset) {
        this.assetBalance = this.userService.findBalance(
          this.balances,
          this.asset
        );
        const chainAsset =
          this.asset.chain === "BNB"
            ? new Asset("BNB.BNB")
            : new Asset("ETH.ETH");
        this.chainBalance = this.userService.findBalance(
          this.balances,
          chainAsset
        );
      }
    });

    const createPoolView$ = this.overlaysService.createPoolView.subscribe(
      (view) => {
        this.view = view;
      }
    );

    this.overlaysService.setCurrentCreatePoolView("Create");

    this.subs = [balances$, createPoolView$];
  }

  async ngOnInit(): Promise<void> {
    this.getEthRouter();
    this.inboundAddresses = await this.midgardService
      .getInboundAddresses()
      .toPromise();

    const params$ = this.route.queryParamMap.subscribe((params) => {
      const pool = params.get("pool");
      this.runeAmount = null;
      this.recommendedRuneAmount = null;

      if (pool) {
        this.asset = new Asset(pool);
        this.checkExisting(pool);
        this.getUsdValue();
        if (this.balances) {
          this.assetBalance = this.userService.findBalance(
            this.balances,
            this.asset
          );
        }

        this.getFees();

        if (this.asset.chain === "ETH" && this.asset.ticker !== "ETH") {
          this.checkContractApproved(this.asset);
        }
      } else {
        this.router.navigate(["/", "pool"]);
      }
    });

    this.getCoinGeckoCoinList();
    this.getPoolCap();

    //because you get the user already before prop init this will be called with asset of undifiend
    const user$ = this.userService.user$.subscribe((user) => {
      this.user = user;
      if (
        this.asset &&
        this.asset.chain === "ETH" &&
        this.asset.ticker !== "ETH"
      ) {
        this.checkContractApproved(this.asset);
      }
    });

    this.subs.push(params$, user$);
  }

  async getFees() {
    const inboundAddresses = await this.midgardService
      .getInboundAddresses()
      .toPromise();
    const asset =
      this.asset.chain === "BNB" ? new Asset("BNB.BNB") : new Asset("ETH.ETH");
    this.networkFee = this.txUtilsService.calculateNetworkFee(
      asset,
      inboundAddresses,
      "INBOUND"
    );
    this.runeFee = this.txUtilsService.calculateNetworkFee(
      new Asset("THOR.RUNE"),
      inboundAddresses,
      "INBOUND"
    );
  }

  getPoolCap() {
    const mimir$ = this.midgardService.mimir$;
    const network$ = this.midgardService.network$;
    const combined = combineLatest([mimir$, network$]);
    const sub = combined.subscribe(([mimir, network]) => {
      // prettier-ignore
      const totalPooledRune = +network.totalPooledRune / (10 ** 8);

      if (mimir && mimir["mimir//MAXIMUMLIQUIDITYRUNE"]) {
        // prettier-ignore
        const maxLiquidityRune = mimir['mimir//MAXIMUMLIQUIDITYRUNE'] / (10 ** 8);
        this.depositsDisabled = totalPooledRune / maxLiquidityRune >= 0.99;
      }
    });

    this.subs.push(sub);
  }

  getEthRouter() {
    this.midgardService.getInboundAddresses().subscribe((addresses) => {
      const ethInbound = addresses.find((inbound) => inbound.chain === "ETH");
      if (ethInbound) {
        this.ethRouter = ethInbound.router;
        //fixed werid bug from reskin not getting this eth router before user assignment
        this.checkContractApproved(this.asset);
      }
    });
  }

  checkExisting(currentPool: string) {
    this.midgardService.getPools().subscribe((res) => {
      const poolNames = res.map((pool) => pool.asset);
      this.pools = poolNames;

      /** MCCN TESTING */
      if (this.pools.includes(currentPool)) {
        this.router.navigate(["/", "deposit", currentPool]);
      }

      this.checkCreateableMarkets();
    });
  }

  getCoinGeckoCoinList() {
    this.cgService.getCoinList().subscribe((res) => {
      this.coinGeckoList = res;
      this.getUsdValue();
      this.getRuneValue();
    });
  }

  getUsdValue() {
    if (this.asset?.ticker && this.coinGeckoList) {
      const id = this.cgService.getCoinIdBySymbol(
        this.asset.ticker,
        this.coinGeckoList
      );
      if (id) {
        this.cgService.getCurrencyConversion(id).subscribe((res) => {
          for (const [_key, value] of Object.entries(res)) {
            this.assetUsdValue = value.usd;
          }
        });
      } else {
        this.assetUsdValue = null;
      }
    }
  }

  getRuneValue() {
    if (this.coinGeckoList) {
      const id = this.cgService.getCoinIdBySymbol("RUNE", this.coinGeckoList);
      if (id) {
        this.cgService.getCurrencyConversion(id).subscribe((res) => {
          for (const [_key, value] of Object.entries(res)) {
            this.runeUsdValue = value.usd;
          }
        });
      }
    }
  }

  updateRuneAmount() {
    if (this.assetUsdValue && this.runeUsdValue) {
      const totalAssetValue = this.assetAmount * this.assetUsdValue;
      this.recommendedRuneAmount = totalAssetValue / this.runeUsdValue;
    } else {
      this.recommendedRuneAmount = null;
    }
  }

  formDisabled(): boolean {
    return (
      !this.balances ||
      !this.runeAmount ||
      !this.assetAmount ||
      this.runeAmount < this.minRuneDepositAmount ||
      this.ethContractApprovalRequired ||
      this.chainBalance <= this.networkFee ||
      this.depositsDisabled ||
      !this.inboundAddresses ||
      (this.balances &&
        (this.runeAmount > this.runeBalance ||
          this.assetAmount >
            this.userService.maximumSpendableBalance(
              this.asset,
              this.assetBalance,
              this.inboundAddresses
            )))
    );
  }

  mainButtonText() {
    if (!this.balances) {
      return {text: "connect wallet", isError: false};
    } else if (this.ethContractApprovalRequired) {
      return {text: "Ready", isError: false};
    } else if (this.depositsDisabled) {
      return {text: "CAPS REACHED", isError: true};
    } else if (this.ethContractApprovalRequired) {
      return {text: "Create Pool", isError: false};
    } else if (this.balances && (!this.runeAmount || !this.assetAmount)) {
      return {text: "Prepare", isError: false};
    } else if (!this.inboundAddresses) {
      return {text: "Loading", isError: false};
    } else if (
      this.balances &&
      (this.runeAmount > this.runeBalance ||
        this.assetAmount >
          this.userService.maximumSpendableBalance(
            this.asset,
            this.assetBalance,
            this.inboundAddresses
          ))
    ) {
      if (this.runeAmount > this.runeBalance)
        return {text: `Insufficient ${this.rune.chain}.${this.rune.ticker} balance`, isError: true};
      else
        return {text: `Insufficient ${this.asset.chain}.${this.asset.ticker} balance`, isError: true};
    } else if (this.chainBalance <= this.networkFee) {
      return {text: `Insufficient ${this.asset.chain}.${this.asset.ticker}`, isError: true};
    } else if (this.runeAmount < this.minRuneDepositAmount) {
      return {text: "Not enough RUNE to create pool", isError: true};
    } else if (
      this.balances &&
      this.runeAmount &&
      this.assetAmount &&
      this.runeAmount <= this.runeBalance &&
      this.assetAmount <= this.assetBalance
    ) {
      return {text: "Ready", isError: false};
    } else {
      console.warn("mismatch case for main button text");
      return;
    }
  }

  checkCreateableMarkets() {
    if (this.pools && this.balances) {
      // TODO: consolidate this is also used in pool.component
      this.selectableMarkets = this.balances
        .filter((balance) => {
          const asset = balance.asset;

          return (
            !this.pools.find(
              (pool) => pool === `${asset.chain}.${asset.symbol}`
            ) &&
            !isNonNativeRuneToken(asset) &&
            asset.chain !== "THOR"
          );
        })
        .map((balance) => {
          return {
            asset: new Asset(`${balance.asset.chain}.${balance.asset.symbol}`),
          };
        });
    }
  }

  breadcrumbNav(nav: string) {
    if (nav === "pool") {
      this.analytics.event('pool_create_approve_contract', 'breadcrumb_skip');
      this.router.navigate(["/", "pool"]);
    } else if (nav === "swap") {
      this.analytics.event('pool_create_approve_contract', 'breadcrumb_skip');
      this.router.navigate(["/", "swap"]);
    } else if (nav === "create") {
      this.analytics.event('pool_create_approve_contract', 'breadcrumb_pool');
      this.router.navigate(["/", "create-pool"], {
        queryParams: { pool: `${this.asset.chain}.${this.asset.symbol}` },
      });
    } else if (nav === "create-back") {
      this.analytics.event('pool_create_approve_contract', 'breadcrumb_create');
      this.overlaysService.setCurrentCreatePoolView("Create");
    }
  }

  openConfirmationDialog() {
    this.data = {
      asset: this.asset,
      rune: this.rune,
      assetAmount: this.assetAmount,
      runeAmount: this.runeAmount,
      assetBalance: this.assetBalance,
      runeBalance: this.runeBalance,
      networkFee: this.networkFee,
      runeFee: this.runeFee,
    };
    let createdAmountUSD = this.assetAmount * this.assetUsdValue + this.runeAmount * this.runeUsdValue;
    this.analytics.event('pool_create', 'button_create_pool_*ASSET*_usd_*numerical_usd_value*', createdAmountUSD, assetString(this.asset), createdAmountUSD.toString());
    this.overlaysService.setCurrentCreatePoolView("Confirm");
  }

  async checkContractApproved(asset: Asset) {
    if (this.ethRouter && this.user) {
      const assetAddress = asset.symbol.slice(asset.ticker.length + 1);
      const strip0x = assetAddress.substr(2);
      const isApproved = await this.user.clients.ethereum.isApproved(
        this.ethRouter,
        strip0x,
        baseAmount(1)
      );

      this.ethContractApprovalRequired = !isApproved;

      //analytics for approve event
      if (!isApproved)
        this.analytics.event('pool_create_approve_contract', 'deposit_container_asset');
    }
  }

  close(transactionSuccess: boolean) {
    if (transactionSuccess) {
      this.assetAmount = 0;
    }
    this.overlaysService.setCurrentCreatePoolView("Create");
  }

  back() {
    this.analytics.event('pool_create', 'button_cancel');
    this.router.navigate(["/", "pool"]);
  }

  contractApproved() {
    this.ethContractApprovalRequired = false;
  }

  ngOnDestroy() {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }
  }
}
