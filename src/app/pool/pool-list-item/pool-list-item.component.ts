import { Component, Input, OnChanges } from "@angular/core";
import { getPoolShare, PoolData, UnitData } from "@thorchain/asgardex-util";
import { baseAmount } from "@xchainjs/xchain-util";
import BigNumber from "bignumber.js";
import { Subscription } from "rxjs";
import { Asset } from "src/app/_classes/asset";
import { MemberPool } from "src/app/_classes/member";
import { PoolDTO } from "src/app/_classes/pool";
import { Currency } from "src/app/_components/account-settings/currency-converter/currency-converter.component";
import { PoolDetailService } from "src/app/_services/pool-detail.service";
import {
  TransactionStatusService,
  Tx,
} from "src/app/_services/transaction-status.service";
import { environment } from "src/environments/environment";

@Component({
  selector: "app-pool-list-item",
  templateUrl: "./pool-list-item.component.html",
  styleUrls: ["./pool-list-item.component.scss"],
})
export class PoolListItemComponent implements OnChanges {
  expanded: boolean;

  @Input() activate: boolean;
  @Input() currency: Currency;

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

  pooledRune: number;
  pooledAsset: number;
  poolShare: number;

  asset: Asset;
  subs: Subscription[];

  isPending: Tx;
  isTestnet: boolean;
  assetDepth: number;

  constructor(
    private poolDetailService: PoolDetailService,
    private txStatusService: TransactionStatusService
  ) {
    this.expanded = false;
    this.activate = false;

    this.isTestnet = environment.network === "tesnet" ? true : false;
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

  getPoolShare(): void {
    if (this.poolData) {
      this.pooledRune =
        new BigNumber(+this.poolData.volume24h).div(10 ** 8).toNumber() *
        this.poolData?.runePrice *
        this.currency.value;

      this.pooledAsset = this.assetDepth;

      if (this.activate) {
        this.poolDetailService.setPooledDetails(
          "notMember",
          this.pooledRune,
          this.pooledAsset,
          0,
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
