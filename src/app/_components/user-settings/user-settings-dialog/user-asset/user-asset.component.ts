import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Tx, TxsPage } from '@xchainjs/xchain-client';
import { Chain } from '@xchainjs/xchain-util';
import { Subscription } from 'rxjs';
import { Asset } from 'src/app/_classes/asset';
import { AssetAndBalance } from 'src/app/_classes/asset-and-balance';
import { User } from 'src/app/_classes/user';
import { Currency } from 'src/app/_components/account-settings/currency-converter/currency-converter.component';
import {
  AnalyticsService,
  assetString,
} from 'src/app/_services/analytics.service';
import { CopyService } from 'src/app/_services/copy.service';
import { CurrencyService } from 'src/app/_services/currency.service';
import { ExplorerPathsService } from 'src/app/_services/explorer-paths.service';
import {
  MainViewsEnum,
  OverlaysService,
} from 'src/app/_services/overlays.service';
import { UserService } from 'src/app/_services/user.service';

@Component({
  selector: 'app-user-asset',
  templateUrl: './user-asset.component.html',
  styleUrls: ['./user-asset.component.scss'],
})
export class UserAssetComponent {
  @Input() set asset(asset: AssetAndBalance) {
    this._asset = asset;
    this.usdValue = this.asset.balance
      .amount()
      .multipliedBy(this.asset.assetPriceUSD)
      .toNumber();
  }
  get asset() {
    return this._asset;
  }
  _asset: AssetAndBalance;
  @Input() address: string;
  @Output() back: EventEmitter<null>;
  @Output() send: EventEmitter<null>;
  @Output() upgradeRune: EventEmitter<null>;
  @Output() deposit: EventEmitter<null>;

  usdValue: number;
  explorerPath: string;
  chain: Chain;
  ticker: string;
  copied: boolean = false;

  subs: Subscription[];
  currency: Currency;
  txs: Tx[];
  activeIndex: number;
  user: User;

  constructor(
    private copyService: CopyService,
    private explorerPathsService: ExplorerPathsService,
    private overlaysService: OverlaysService,
    private currencyService: CurrencyService,
    private userService: UserService,
    private analytics: AnalyticsService
  ) {
    this.back = new EventEmitter();
    this.send = new EventEmitter();
    this.upgradeRune = new EventEmitter();
    this.deposit = new EventEmitter();

    const curs$ = this.currencyService.cur$.subscribe((cur) => {
      this.currency = cur;
    });

    this.subs = [curs$];
  }

  ngOnInit(): void {
    this.setExplorerPath();

    this.chain = this.asset.asset.chain;
    this.ticker = this.asset.asset.ticker;

    this.getTransactions();
  }

  async getTransactions() {
    /**Get transaction of the asset/chain */
    const user$ = this.userService.user$.subscribe((user) => {
      this.user = user;
    });

    let client = this.userService.getChainClient(
      this.user,
      this.asset.asset.chain
    );

    let txsPage: TxsPage = await client.getTransactions({
      address: client.getAddress(),
    });
    this.txs = txsPage.txs.filter((el) => {
      return (
        el.asset.chain === this.asset.asset.chain &&
        el.asset.ticker === this.asset.asset.ticker
      );
    });

    this.subs.push(user$);
  }

  getIconPath(asset_name: Asset): string {
    let asset = new Asset(`${asset_name.chain}.${asset_name.ticker}`);
    return asset.iconPath;
  }

  getExplorerUrl(hash: string) {
    let client = this.userService.getChainClient(
      this.user,
      this.asset.asset.chain
    );

    return client.getExplorerTxUrl(hash);
  }

  getExplorerEvent() {
    /** Analytics section */
    this.analytics.event(
      'wallet_asset',
      'tx_list_tag_txid_explore_*WALLET*_*ASSET*',
      undefined,
      this.chain,
      assetString(this.asset.asset)
    );
  }

  formatDate(date) {
    var d = new Date(date),
      month = '' + (d.getMonth() + 1),
      day = '' + d.getDate(),
      year = d.getFullYear() % 100;

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [day, month, year].join('/');
  }

  setExplorerPath() {
    switch (this.asset.asset.chain) {
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

  breadcrumbNav(nav: string) {
    if (nav === 'swap') {
      this.analytics.event('wallet_asset', 'breadcrumb_skip');
      this.overlaysService.setViews(MainViewsEnum.Swap, 'Swap');
    } else if (nav === 'wallet') {
      this.analytics.event('wallet_asset', 'breadcrumb_wallet');
      this.overlaysService.setCurrentUserView({
        userView: 'Addresses',
        address: null,
        chain: null,
        asset: null,
      });
    } else if (nav === 'chain') {
      this.analytics.event(
        'wallet_asset',
        'breadcrumb_*WALLET*',
        undefined,
        this.chain
      );
      this.overlaysService.setCurrentUserView({
        userView: 'Address',
        address: this.address,
        chain: this.chain,
        asset: null,
      });
    }
  }

  copyToClipboard() {
    if (this.address) {
      this.analytics.event(
        'wallet_asset',
        'tag_txid_copy_*WALLET*_*ASSET*',
        undefined,
        this.chain,
        assetString(this.asset.asset)
      );

      let result = this.copyService.copyToClipboard(this.address);

      if (result) this.copied = true;
    }
  }

  eventClick() {
    this.analytics.event(
      'wallet_asset',
      'tag_txid_explore_*WALLET*_*ASSET*',
      undefined,
      this.chain,
      assetString(this.asset.asset)
    );
  }

  sendNav() {
    this.analytics.event(
      'wallet_asset',
      'button_send_*WALLET*_*ASSET*',
      undefined,
      this.chain,
      assetString(this.asset.asset)
    );
    this.send.emit();
  }

  backNav() {
    this.analytics.event(
      'wallet_asset',
      'button_assets_*WALLET*_*ASSET*',
      undefined,
      this.chain,
      assetString(this.asset.asset)
    );
    this.back.emit();
  }

  ngOnDestroy(): void {
    this.subs.forEach((sub) => {
      sub.unsubscribe();
    });
  }
}
