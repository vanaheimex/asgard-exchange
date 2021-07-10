import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { baseToAsset, Chain } from '@xchainjs/xchain-util';
import { Balances } from '@xchainjs/xchain-client';
import { Subscription } from 'rxjs';
import { Asset } from 'src/app/_classes/asset';
import { AssetAndBalance } from 'src/app/_classes/asset-and-balance';
import { User } from 'src/app/_classes/user';
import { CopyService } from 'src/app/_services/copy.service';
import { ExplorerPathsService } from 'src/app/_services/explorer-paths.service';
import { UserService } from 'src/app/_services/user.service';
import { PoolDTO } from 'src/app/_classes/pool';
import { ThorchainPricesService } from 'src/app/_services/thorchain-prices.service';
import {
  MainViewsEnum,
  OverlaysService,
} from 'src/app/_services/overlays.service';
import {
  AnalyticsService,
  assetString,
} from 'src/app/_services/analytics.service';

@Component({
  selector: 'app-user-address',
  templateUrl: './user-address.component.html',
  styleUrls: ['./user-address.component.scss'],
})
export class UserAddressComponent implements OnInit {
  @Input() address: string;
  @Input() chain: Chain;
  @Input() pools: PoolDTO[];
  @Output() back: EventEmitter<null>;
  @Output() navigateToAsset: EventEmitter<AssetAndBalance>;
  @Output() navigateToAddToken: EventEmitter<null>;
  iconPath: string;
  user: User;
  balances: Balances;
  subs: Subscription[];
  assets: AssetAndBalance[];
  loading: boolean;
  loadingBalance: boolean;
  explorerPath: string;
  error: string;
  copied: boolean = false;

  constructor(
    private userService: UserService,
    private copyService: CopyService,
    private explorerPathsService: ExplorerPathsService,
    private thorchainPricesService: ThorchainPricesService,
    private overlaysService: OverlaysService,
    private analytics: AnalyticsService
  ) {
    this.back = new EventEmitter<null>();
    this.navigateToAsset = new EventEmitter<AssetAndBalance>();
    this.navigateToAddToken = new EventEmitter<null>();
    this.loading = true;
    this.loadingBalance = false;
  }

  ngOnInit(): void {
    this.iconPath = this.getIconPath(this.chain);

    const balances$ = this.userService.userBalances$.subscribe((balances) => {
      if (balances) {
        this.balances = balances.filter(
          (balance) => balance.asset.chain === this.chain
        );
        this.error = undefined;
      }

      this.createAssetList();
    });

    const chainBalanceErrors$ = this.userService.chainBalanceErrors$.subscribe(
      (chains) => {
        if (chains.includes(this.chain)) {
          this.error = `There was an error fetching data from the ${this.chain} endpoint. \n Your funds are safe, just an error connecting. Please try again later.`;
        }
      }
    );

    this.setExplorerPath();

    this.subs = [balances$, chainBalanceErrors$];
  }

  getMessage(): string {
    if (this.error) {
      return `${this.chain} END POINT ERROR`;
    } else {
      return 'SELECT';
    }
  }

  createAssetList() {
    if (this.balances && this.pools) {
      this.assets = this.balances.reduce((list: AssetAndBalance[], balance) => {
        const assetString = `${balance.asset.chain}.${balance.asset.symbol}`;
        const asset = new Asset(
          `${balance.asset.chain}.${balance.asset.symbol}`
        );
        let assetBalance: AssetAndBalance;

        if (asset.ticker === 'RUNE') {
          assetBalance = {
            asset,
            assetPriceUSD:
              this.thorchainPricesService.estimateRunePrice(this.pools) ?? 0,
            balance: baseToAsset(balance.amount),
          };
        } else {
          const matchingPool = this.pools.find((pool) => {
            return (
              pool.asset.localeCompare(assetString, undefined, {
                sensitivity: 'accent',
              }) === 0
            );
          });

          assetBalance = {
            asset,
            assetPriceUSD: matchingPool ? +matchingPool.assetPriceUSD : 0,
            balance: baseToAsset(balance.amount),
          };
        }

        list.push(assetBalance);

        return list;
      }, []);

      this.loading = false;
    }
  }

  setExplorerPath() {
    switch (this.chain) {
      case 'BTC':
        this.explorerPath = `${this.explorerPathsService.bitcoinExplorerUrl}/address/${this.address}`;
        break;

      case 'BNB':
        this.explorerPath = `${this.explorerPathsService.binanceExplorerUrl}/address/${this.address}`;
        break;

      case 'THOR':
        this.explorerPath = `${this.explorerPathsService.thorchainExplorerUrl}/address/${this.address}`;
        break;

      case 'ETH':
        this.explorerPath = `${this.explorerPathsService.ethereumExplorerUrl}/address/${this.address}`;
        break;

      case 'LTC':
        this.explorerPath = `${this.explorerPathsService.litecoinExplorerUrl}/${this.address}`;
        break;

      case 'BCH':
        this.explorerPath = `${this.explorerPathsService.bchExplorerUrl}/address/${this.address}`;
        break;

      default:
        break;
    }
  }

  getIconPath(chain: Chain): string {
    switch (chain) {
      case 'BNB':
        return 'assets/images/token-icons/bnb.png';

      case 'BTC':
        return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/binance/assets/BTCB-1DE/logo.png';

      case 'ETH':
        return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png';

      case 'THOR':
        return '/assets/icons/logo-thor-rune.svg';
    }
  }

  copyToClipboard(address: string) {
    let result = this.copyService.copyToClipboard(address);

    if (result) this.copied = true;

    this.analytics.event(
      'wallet_asset_select',
      'tag_txid_copy_*WALLET*',
      undefined,
      this.chain
    );
  }

  eventClick() {
    this.analytics.event(
      'wallet_asset_select',
      'tag_txid_explore_*WALLET*',
      undefined,
      this.chain
    );
  }

  async refreshBalances() {
    this.analytics.event(
      'wallet_asset_select',
      'button_refresh_*WALLET*',
      undefined,
      this.chain
    );
    this.loadingBalance = true;
    this.error = undefined;
    await this.userService.fetchBalances();
    setTimeout(() => {
      this.loadingBalance = false;
    }, 1500);
  }

  breadcrumbNav(nav) {
    if (nav === 'swap') {
      this.analytics.event('wallet_asset_select', 'breadcrumb_skip');
      this.overlaysService.setViews(MainViewsEnum.Swap, 'Swap');
    } else if (nav === 'wallet') {
      this.analytics.event('wallet_asset_select', 'breadcrumb_wallet');
      this.overlaysService.setCurrentUserView({
        userView: 'Addresses',
        address: null,
        chain: null,
        asset: null,
      });
    }
  }

  selectAsset(asset: Asset) {
    const match = this.assets.find(
      (assetAndBalance) => assetAndBalance.asset === asset
    );
    if (match) {
      this.navigateToAsset.next(match);
      this.analytics.event(
        'wallet_asset_select',
        'option_selected_*ASSET*',
        undefined,
        assetString(match.asset)
      );
    } else {
      console.error('no match found for asset: ', asset);
    }
  }

  backNav() {
    this.analytics.event(
      'wallet_asset_select',
      'button_wallet_*WALLET*',
      undefined,
      this.chain
    );
    this.back.emit();
  }

  ngOnDestroy(): void {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }
  }
}
