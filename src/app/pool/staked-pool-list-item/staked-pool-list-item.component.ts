import { Component, Input, OnChanges } from "@angular/core";
import { getPoolShare, PoolData, UnitData } from "@thorchain/asgardex-util";
import { assetToString, baseAmount } from "@xchainjs/xchain-util";
import BigNumber from "bignumber.js";
import { Subscription } from "rxjs";
import { take } from "rxjs/operators";
import { Asset } from "src/app/_classes/asset";
import { MemberPool } from "src/app/_classes/member";
import { PoolDTO } from "src/app/_classes/pool";
import { Currency } from "src/app/_components/account-settings/currency-converter/currency-converter.component";
import { AnalyticsService } from "src/app/_services/analytics.service";
import { PoolDetailService } from "src/app/_services/pool-detail.service";
import {
  RuneYieldPoolResponse,
  RuneYieldService,
} from "src/app/_services/rune-yield.service";
import {
  TransactionStatusService,
  Tx,
} from "src/app/_services/transaction-status.service";
import { UserService } from "src/app/_services/user.service";
import { environment } from "src/environments/environment";

@Component({
  selector: "app-staked-pool-list-item",
  templateUrl: "./staked-pool-list-item.component.html",
  styleUrls: ["./staked-pool-list-item.component.scss"],
})
export class StakedPoolListItemComponent implements OnChanges {
  expanded: boolean;

  @Input() activate: boolean;
  hover: boolean = false;

  /**
   * Member Pool Data
   */
  @Input() set memberPoolData(data: MemberPool) {
    this._memberPoolData = data;
  }
  get memberPoolData() {
    return this._memberPoolData;
  }
  _memberPoolData: MemberPool;

  /**
   * Pool Data
   */
  @Input() set poolData(data: PoolDTO) {
    this._poolData = data;
    this.setAsset();
  }
  get poolData() {
    return this._poolData;
  }
  _poolData: PoolDTO;

  @Input() depositsDisabled: boolean;
  @Input() currency: Currency;
  @Input() runeYieldPool: RuneYieldPoolResponse[];

  pooledRune: number;
  pooledAsset: number;
  poolShare: number;

  asset: Asset;
  subs: Subscription[];

  isPending: Tx;
  isTestnet: boolean;
  assetDepth: number;
  gainLoss: number;

  constructor(
    private poolDetailService: PoolDetailService,
    private txStatusService: TransactionStatusService,
    private analyticsService: AnalyticsService,
    private userService: UserService,
    private analytics: AnalyticsService
  ) {
    this.expanded = false;
    this.activate = false;

    this.isTestnet = environment.network === "testnet" ? true : false;
  }

  ngOnChanges() {
    this.getPoolShare();
  }

  ngOnInit(): void {
    const poolDetail$ = this.poolDetailService.activatedAsset$.subscribe(
      (asset) => {
        if (asset && this.asset) {
          this.activate =
            asset.symbol === this.asset.symbol &&
            asset.chain === this.asset.chain;
          this.getPoolShare();
        }
      }
    );

    const pendingTx$ = this.txStatusService.txs$.subscribe((tx) => {
      this.isPending = this.txStatusService.getPoolPedingTx().find((tx) => {
        return tx.symbol === this.asset.symbol;
      });
    });

    this.assetDepth =
      (new BigNumber(+this.poolData.assetDepth).div(10 ** 8).toNumber() *
        +this.poolData.assetPriceUSD +
        new BigNumber(+this.poolData.runeDepth).div(10 ** 8).toNumber() *
          +this.poolData.runePrice) *
      this.currency.value;

    this.subs = [poolDetail$, pendingTx$];
  }

  toggleExpanded() {
    if (!this.isPending) this.poolDetailService.setActivatedAsset(this.asset);
  }

  setAsset(): void {
    if (this.poolData) {
      this.asset = new Asset(this.poolData.asset);
    }
  }

  statEvent() {
    this.analytics.event('pool_select', 'tag_pool_stats_*POOL_ASSET*', undefined, `${this.asset.chain}.${this.asset.ticker}`);
  }

  depositEvent() {
    this.analytics.event('pool_select', 'tag_pool_deposit_*POOL_ASSET*', undefined, `${this.asset.chain}.${this.asset.ticker}`);
  }

  withdrawEvent() {
    this.analytics.event('pool_select', 'tag_pool_withdraw_*POOL_ASSET*', undefined, `${this.asset.chain}.${this.asset.ticker}`)
  }

  getPoolShare(): void {
    if (this.memberPoolData && this.poolData) {
      const unitData: UnitData = {
        stakeUnits: baseAmount(this.memberPoolData.liquidityUnits),
        totalUnits: baseAmount(this.poolData.units),
      };

      const poolData: PoolData = {
        assetBalance: baseAmount(this.poolData.assetDepth),
        runeBalance: baseAmount(this.poolData.runeDepth),
      };

      const poolShare = getPoolShare(unitData, poolData);

      this.pooledRune = poolShare.rune
        .amount()
        .div(10 ** 8)
        .toNumber();
      this.pooledAsset = poolShare.asset
        .amount()
        .div(10 ** 8)
        .toNumber();
      this.poolShare =
        Number(this.memberPoolData.liquidityUnits) /
        Number(this.poolData.units);

      if (this.activate) {
        this.poolDetailService.setPooledDetails(
          "member",
          this.pooledRune,
          this.pooledAsset,
          this.poolShare,
          this.asset.ticker,
          this.asset.chain
        );
      }

      // gain/loss calculation
      let currentValue = new BigNumber(
        this.poolShare * +this.poolData.runeDepth * this.poolData.runePrice +
          this.poolShare *
            +this.poolData.assetDepth *
            +this.poolData.assetPriceUSD
      ).plus(
        new BigNumber(this.runeYieldPool?.find(
          (p) => p.pool === this.memberPoolData.pool
        )?.totalunstakedusd)
      )
        .div(10 ** 8)
        .toNumber();

      let addedValue = new BigNumber(
        this.runeYieldPool?.find(
          (p) => p.pool === this.memberPoolData.pool
        )?.totalstakedusd
      )
        .div(10 ** 8)
        .toNumber();

      if (!addedValue) {
        this.gainLoss = undefined;
      }
      this.gainLoss = ((currentValue - addedValue) / addedValue) * 100;
    }
  }

  ngOnDestroy(): void {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }

    // guard to see the staked list item goes away
    if (this.activate) this.poolDetailService.setActivatedAsset(null);
  }
}
