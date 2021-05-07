import { Component, Input, OnChanges } from '@angular/core';
import { getPoolShare, PoolData, UnitData } from '@thorchain/asgardex-util';
import { baseAmount } from '@xchainjs/xchain-util';
import BigNumber from 'bignumber.js';
import { Subscription } from 'rxjs';
import { Asset } from 'src/app/_classes/asset';
import { MemberPool } from 'src/app/_classes/member';
import { PoolDTO } from 'src/app/_classes/pool';
import { Currency } from 'src/app/_components/account-settings/currency-converter/currency-converter.component';
import { PoolDetailService } from 'src/app/_services/pool-detail.service';
import { TransactionStatusService, Tx } from 'src/app/_services/transaction-status.service';
import { UserService } from 'src/app/_services/user.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-staked-pool-list-item',
  templateUrl: './staked-pool-list-item.component.html',
  styleUrls: ['./staked-pool-list-item.component.scss']
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

  pooledRune: number;
  pooledAsset: number;
  poolShare: number;

  asset: Asset;
  subs: Subscription[];

  isPending: Tx;
  thorAddress: string;
  isTestnet: boolean;
  assetDepth: number;

  constructor(private poolDetailService : PoolDetailService, private txStatusService: TransactionStatusService, private userService: UserService) {
    this.expanded = false;
    this.activate = false;

    userService.user$.subscribe(
      (user) => {
        this.thorAddress = user.clients.thorchain.getAddress();
      }
    )

    this.isTestnet = environment.network === 'testnet' ? true : false;
  }

  ngOnChanges() {
    this.getPoolShare();
  }

  ngOnInit(): void {
    const poolDetail$ = this.poolDetailService.activatedAsset$.subscribe(
      (asset) => {
        if (asset && this.asset) {
          this.activate = asset.symbol === this.asset.symbol && asset.chain === this.asset.chain;
          this.getPoolShare();
        }
      })

      const pendingTx$ = this.txStatusService.txs$.subscribe(
        (tx) => {
          this.isPending = this.txStatusService.getPoolPedingTx().find( (tx) => {
            return tx.symbol === this.asset.symbol
          });
        }
      );

      this.assetDepth = (new BigNumber(+this.poolData.assetDepth).div(10 ** 8).toNumber()) * +this.poolData.assetPriceUSD * this.currency.value

      this.subs = [poolDetail$, pendingTx$]
  }

  toggleExpanded() {
    if (!this.isPending)
      this.poolDetailService.setActivatedAsset(this.asset);
  }

  setAsset(): void {
    if (this.poolData) {
      this.asset = new Asset(this.poolData.asset);
    }
  }

  getPoolShare(): void {
    if (this.memberPoolData && this.poolData) {

      const unitData: UnitData = {
        stakeUnits: baseAmount(this.memberPoolData.liquidityUnits),
        totalUnits: baseAmount(this.poolData.units)
      };

      const poolData: PoolData = {
        assetBalance: baseAmount(this.poolData.assetDepth),
        runeBalance: baseAmount(this.poolData.runeDepth)
      };

      const poolShare = getPoolShare(unitData, poolData);

      this.pooledRune = poolShare.rune.amount().div(10 ** 8).toNumber();
      this.pooledAsset = poolShare.asset.amount().div(10 ** 8).toNumber();
      this.poolShare = Number(this.memberPoolData.liquidityUnits) / Number(this.poolData.units);

      if (this.activate) {
        this.poolDetailService.setPooledDetails('member', this.pooledRune, this.pooledAsset, this.poolShare, this.asset.ticker, this.asset.chain);
      }
    }

  }

  ngOnDestroy(): void {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }

    // guard to see the staked list item goes away
    if (this.activate)
      this.poolDetailService.setActivatedAsset(null);
  }

}
