import { Component, OnDestroy, OnInit } from "@angular/core";
import { Balances } from "@xchainjs/xchain-client";
import { combineLatest, Subscription } from "rxjs";
import { User } from "../_classes/user";
import { MidgardService } from "../_services/midgard.service";
import { UserService } from "../_services/user.service";
import { PoolDTO } from "../_classes/pool";
import { MemberPool } from "../_classes/member";
import {
  TransactionStatusService,
  Tx,
} from "../_services/transaction-status.service";
import { PoolDetailService } from "../_services/pool-detail.service";
import { Router } from "@angular/router";
import { isNonNativeRuneToken } from "../_classes/asset";
import { ThorchainPricesService } from "../_services/thorchain-prices.service";
import { CurrencyService } from "../_services/currency.service";
import { Currency } from "../_components/account-settings/currency-converter/currency-converter.component";
import { OverlaysService, PoolViews } from "../_services/overlays.service";
import { AnalyticsService } from "../_services/analytics.service";

@Component({
  selector: "app-pool",
  templateUrl: "./pool.component.html",
  styleUrls: ["./pool.component.scss"],
})
export class PoolComponent implements OnInit, OnDestroy {
  user: User;
  pools: PoolDTO[];
  userPoolError: boolean;
  subs: Subscription[];
  loading: boolean;
  balances: Balances;
  createablePools: string[];
  memberPools: MemberPool[];
  poolType: "member" | "notMember";
  runePrice: number;
  currency: Currency;
  pooledRune: number;
  pooledAsset: number;
  pooledShare: number;
  pooledAssetTicker: String;
  pooledAssetChain: String;
  pendingPoolTxs: Tx[];
  addresses: string[];
  maxLiquidityRune: number;
  totalPooledRune: number;
  depositsDisabled: boolean;
  txStreamInitSuccess: boolean;
  mode: PoolViews;

  constructor(
    private userService: UserService,
    private midgardService: MidgardService,
    private txStatusService: TransactionStatusService,
    private poolDetailService: PoolDetailService,
    private router: Router,
    private thorchainPricesService: ThorchainPricesService,
    private currencyService: CurrencyService,
    public ovrService: OverlaysService,
    private analytics: AnalyticsService
  ) {
    this.subs = [];
    this.memberPools = [];
    this.depositsDisabled = false;

    const user$ = this.userService.user$.subscribe((user) => {
      this.user = user;
      this.getAccountPools();
    });

    const balances$ = this.userService.userBalances$.subscribe((balances) => {
      this.balances = balances;
      this.checkCreateableMarkets();
    });

    const pendingTx$ = this.txStatusService.txs$.subscribe((_) => {
      //clear until you get the new memeberPools
      this.memberPools = [];

      if (!this.txStreamInitSuccess) {
        this.txStreamInitSuccess = true;
      } else {
        setTimeout(() => {
          this.getAccountPools();
        }, 3000);
      }

      this.pendingPoolTxs = this.txStatusService.getPoolPedingTx();
    });

    const poolDeatil$ = this.poolDetailService.pooledDetails$.subscribe(
      (poolDetails) => {
        this.poolType = poolDetails.poolType;
        this.pooledRune = poolDetails.pooledRune;
        this.pooledAsset = poolDetails.pooledAsset;
        this.pooledShare = poolDetails.pooledShare;
        this.pooledAssetTicker = poolDetails.pooledAssetTicker;
        this.pooledAssetChain = poolDetails.pooledAssetChain;
      }
    );

    const activePool$ = this.poolDetailService.activatedAsset$.subscribe(
      (activatedAsset) => {
        if (this.memberPools && activatedAsset) {
          let activatedAssetInPools = this.memberPools.find(
            (asset) =>
              asset.pool === `${activatedAsset.chain}.${activatedAsset.ticker}`
          );
          if (!activatedAssetInPools) {
            this.clearPoolDetail();
          }
        } else {
          this.clearPoolDetail();
        }
      }
    );

    const cur$ = this.currencyService.cur$.subscribe((cur) => {
      this.currency = cur;
    });

    const ovr$ = this.ovrService.PoolView.subscribe(
      (ovr) => {
        this.mode = ovr;
      }
    )

    this.subs.push(
      user$,
      balances$,
      pendingTx$,
      poolDeatil$,
      activePool$,
      cur$,
      ovr$
    );
  }

  getBreadcrumbText() {
    if (this.userPoolError) {
      return { text: "Cannot fetch user Pools", isError: true };
    }

    if (this.depositsDisabled) {
      return { text: "CAPS REACHED", isError: true };
    }

    return "SELECT";
  }

  clearPoolDetail() {
    this.pooledRune = null;
    this.pooledAsset = null;
    this.pooledShare = null;
    this.pooledAssetTicker = null;
    this.pooledAssetChain = null;
  }

  ngOnInit(): void {
    this.getPools();
    this.getPoolCap();
  }

  getPools() {
    this.midgardService.getPools().subscribe((res) => {
      this.pools = res;
      let availablePools = this.pools.filter(
        (pool) => pool.status === "available"
      );
      this.runePrice =
        this.thorchainPricesService.estimateRunePrice(availablePools);
      this.checkCreateableMarkets();
    });
  }

  breadcrumbNav(nav: string) {
    if (nav === "pool") {
      this.router.navigate(["/", "pool"]);
    } else if (nav === "swap") {
      this.router.navigate(["/", "swap"]);
      if (!this.user) {
        this.analytics.event('pool_disconnected', 'breadcrumb_vanaheimex');
      }
      else {
        this.analytics.event('pool_select', 'breadcrumb_vanaheimex');
      }
    }
  }

  switchNav(val: string) {
    if (val === "left") {
      if (!this.user)
        this.analytics.event('pool_disconnected', 'switch_swap');
      else if (this.user) {
        this.analytics.event('pool_select', 'switch_swap');
      }
      this.router.navigate([
        "/",
        "swap"
      ]);
    }
    else if (val === "right") {
      this.router.navigate([
        "/",
        "pool"
      ]);
    }
  }

  connectWallet() {
    this.analytics.event('pool_disconnected', 'button_connect_wallet');
    this.ovrService.setCurrentPoolView('Connect')
  }

  checkCreateableMarkets() {
    if (this.pools && this.balances) {
      this.createablePools = this.balances
        .filter((balance) => {
          const asset = balance.asset;
          return (
            !this.pools.find(
              (pool) => pool.asset === `${asset.chain}.${asset.symbol}`
            ) &&
            !isNonNativeRuneToken(asset) &&
            asset.chain !== "THOR"
          );
        })
        .map((balance) => `${balance.asset.chain}.${balance.asset.symbol}`);
    }
  }

  getPoolCap() {
    const mimir$ = this.midgardService.mimir$;
    const network$ = this.midgardService.network$;
    const combined = combineLatest([mimir$, network$]);
    const sub = combined.subscribe(([mimir, network]) => {
      // prettier-ignore
      this.totalPooledRune = +network.totalPooledRune / (10 ** 8);

      if (mimir && mimir["mimir//MAXIMUMLIQUIDITYRUNE"]) {
        // prettier-ignore
        this.maxLiquidityRune = mimir['mimir//MAXIMUMLIQUIDITYRUNE'] / (10 ** 8);
        this.depositsDisabled =
          this.totalPooledRune / this.maxLiquidityRune >= 0.9;
      }

      setTimeout(() => {
        this.loading = false;
        this.userPoolError = false;
      }, 500);
    });

    this.subs.push(sub);
  }

  async getAddresses(): Promise<string[]> {
    const thorClient = this.user.clients.thorchain;
    const thorAddress = await thorClient.getAddress();

    const btcClient = this.user.clients.bitcoin;
    const btcAddress = await btcClient.getAddress();

    const ltcClient = this.user.clients.litecoin;
    const ltcAddress = await ltcClient.getAddress();

    const bchClient = this.user.clients.bitcoinCash;
    const bchAddress = await bchClient.getAddress();

    const bnbClient = this.user.clients.binance;
    const bnbAddress = await bnbClient.getAddress();

    const ethClient = this.user.clients.ethereum;
    const ethAddress = await ethClient.getAddress();

    return [
      thorAddress,
      btcAddress,
      ltcAddress,
      bchAddress,
      bnbAddress,
      ethAddress,
    ];
  }

  async getAccountPools() {
    this.loading = true;
    this.memberPools = [];

    if (this.user) {
      if (!this.addresses) {
        this.addresses = await this.getAddresses();
      }

      for (const address of this.addresses) {
        this.midgardService.getMember(address).subscribe((res) => {
          for (const pool of res.pools) {
            const match = this.memberPools.find(
              (existingPool) => existingPool.pool === pool.pool
            );
            if (!match) {
              const memberPools = this.memberPools;
              memberPools.push(pool);
              this.memberPools = [...memberPools];
            }
          }
        });
      }

      this.analytics.event('pool_select', 'button_refresh');
    }

    this.loading = false;
  }

  createPoolEvent() {
    this.analytics.event('pool_select', 'button_create_pool');
  }

  ngOnDestroy(): void {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }

    this.clearPoolDetail();
    console.log("destory the pool veiw");
  }
}
