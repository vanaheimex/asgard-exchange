import { Component, Input, OnChanges, OnDestroy, OnInit } from '@angular/core';
import { getPoolShare, PoolData, UnitData } from '@thorchain/asgardex-util';
import { assetToString, baseAmount, bn } from '@xchainjs/xchain-util';
import BigNumber from 'bignumber.js';
import { Subscription } from 'rxjs';
import { take } from 'rxjs/operators';
import { Asset } from 'src/app/_classes/asset';
import { Liquidity } from 'src/app/_classes/liquidiyt';
import { MemberPool } from 'src/app/_classes/member';
import { PoolDTO } from 'src/app/_classes/pool';
import { Currency } from 'src/app/_components/account-settings/currency-converter/currency-converter.component';
import { PoolTypeOption } from 'src/app/_const/pool-type-options';
import { AnalyticsService } from 'src/app/_services/analytics.service';
import { PoolDetailService } from 'src/app/_services/pool-detail.service';
import {
  RuneYieldPoolResponse,
  RuneYieldService,
} from 'src/app/_services/rune-yield.service';
import {
  TransactionStatusService,
  Tx,
} from 'src/app/_services/transaction-status.service';
import { UserService } from 'src/app/_services/user.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-staked-pool-list-item',
  templateUrl: './staked-pool-list-item.component.html',
  styleUrls: ['./staked-pool-list-item.component.scss'],
})
export class StakedPoolListItemComponent
  implements OnChanges, OnDestroy, OnInit
{
  expanded: boolean;

  @Input() activate: boolean;
  hover: boolean = false;
  runeAddress: string;

  /**
   * Member Pool Data
   */
  @Input() set memberPoolData(data: MemberPool[]) {
    this._memberPoolData = data;
  }
  get memberPoolData() {
    return this._memberPoolData;
  }
  _memberPoolData: MemberPool[];

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

    this.isTestnet = environment.network === 'testnet' ? true : false;
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
    this.analytics.event(
      'pool_select',
      'tag_pool_stats_*POOL_ASSET*',
      undefined,
      `${this.asset.chain}.${this.asset.ticker}`
    );
  }

  depositEvent() {
    this.analytics.event(
      'pool_select',
      'tag_pool_deposit_*POOL_ASSET*',
      undefined,
      `${this.asset.chain}.${this.asset.ticker}`
    );
  }

  withdrawEvent() {
    this.analytics.event(
      'pool_select',
      'tag_pool_withdraw_*POOL_ASSET*',
      undefined,
      `${this.asset.chain}.${this.asset.ticker}`
    );
  }

  calculatePoolShare(memberPoolData: MemberPool, poolType: PoolTypeOption) {
    // calculating the sym deposit
    const unitData: UnitData = {
      stakeUnits: baseAmount(memberPoolData.liquidityUnits),
      totalUnits: baseAmount(this.poolData.units),
    };

    const poolData: PoolData = {
      assetBalance: baseAmount(this.poolData.assetDepth),
      runeBalance: baseAmount(this.poolData.runeDepth),
    };

    // driverded from getPoolshare (asgardex util)
    const units = unitData.stakeUnits.amount();
    const total = unitData.totalUnits.amount();
    const R = poolData.runeBalance.amount();
    const T = poolData.assetBalance.amount();
    let asset: BigNumber;
    let rune: BigNumber;
    if (poolType === 'SYM') {
      asset = T.times(units).div(total);
      rune = R.times(units).div(total);
    } else if (poolType === 'ASYM_ASSET') {
      asset = Liquidity.getAsymAssetShare(units, total, T);
      rune = bn(0);
    } else if (poolType === 'ASYM_RUNE') {
      asset = bn(0);
      rune = Liquidity.getAsymAssetShare(units, total, R);
    }
    const stakeData = {
      asset: baseAmount(asset),
      rune: baseAmount(rune),
    };

    let pooledRune = stakeData.rune
      .amount()
      .div(10 ** 8)
      .toNumber();
    let pooledAsset = stakeData.asset
      .amount()
      .div(10 ** 8)
      .toNumber();
    let poolShareData =
      Number(memberPoolData.liquidityUnits) / Number(this.poolData.units);

    // for now we only calculate the sym deposit gain/loss
    if (memberPoolData.runeAddress && memberPoolData.assetAddress) {
      let currentValue = new BigNumber(
        poolShareData * +this.poolData.runeDepth * this.poolData.runePrice +
          poolShareData *
            +this.poolData.assetDepth *
            +this.poolData.assetPriceUSD
      )
        .plus(
          new BigNumber(
            this.runeYieldPool?.find(
              (p) => p.pool === memberPoolData.pool
            )?.totalunstakedusd
          )
        )
        .div(10 ** 8)
        .toNumber();

      let addedValue = new BigNumber(
        this.runeYieldPool?.find(
          (p) => p.pool === memberPoolData.pool
        )?.totalstakedusd
      )
        .div(10 ** 8)
        .toNumber();

      if (!addedValue) {
        this.gainLoss = undefined;
      }
      this.gainLoss = ((currentValue - addedValue) / addedValue) * 100;
    }

    return { pooledRune, pooledAsset, poolShare: poolShareData };
  }

  getPoolType(poolData: MemberPool): PoolTypeOption {
    let { assetAdded, runeAdded } = poolData;

    if (Number(assetAdded) === 0 && Number(runeAdded) > 0) {
      return 'ASYM_RUNE';
    } else if (Number(runeAdded) === 0 && Number(assetAdded) > 0) {
      return 'ASYM_ASSET';
    } else {
      return 'SYM';
    }
  }

  getPoolShare(): void {
    if (this.memberPoolData && this.poolData) {
      // rune address
      this.runeAddress = this.memberPoolData.find(
        (pool) => pool.runeAddress
      ).runeAddress;

      for (let memPoolData of this.memberPoolData) {
        const poolType = this.getPoolType(memPoolData);

        const { pooledRune, pooledAsset, poolShare } = this.calculatePoolShare(
          memPoolData,
          poolType
        );

        this.pooledRune = this.pooledRune ?? 0 + pooledRune;
        this.pooledAsset = this.pooledAsset ?? 0 + pooledAsset;
        this.poolShare = this.poolShare ?? 0 + poolShare;
      }

      //calculating the sum of pool share from the whole deposited options
      if (this.activate) {
        this.poolDetailService.setPooledDetails(
          'member',
          this.pooledRune,
          this.pooledAsset,
          this.poolShare,
          this.asset.ticker,
          this.asset.chain
        );
      }
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
