import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Chain } from '@xchainjs/xchain-util';
import { Subscription } from 'rxjs';
import { AssetAndBalance } from 'src/app/_classes/asset-and-balance';
import { Currency } from 'src/app/_components/account-settings/currency-converter/currency-converter.component';
import { CopyService } from 'src/app/_services/copy.service';
import { CurrencyService } from 'src/app/_services/currency.service';
import { ExplorerPathsService } from 'src/app/_services/explorer-paths.service';
import { OverlaysService } from 'src/app/_services/overlays.service';

@Component({
  selector: 'app-user-asset',
  templateUrl: './user-asset.component.html',
  styleUrls: ['./user-asset.component.scss']
})
export class UserAssetComponent implements OnInit {

  @Input() set asset(asset: AssetAndBalance) {
    this._asset = asset;
    this.usdValue = this.asset.balance.amount().multipliedBy(this.asset.assetPriceUSD).toNumber();
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

  constructor(private copyService: CopyService, private explorerPathsService: ExplorerPathsService, private overlaysService: OverlaysService, private currencyService: CurrencyService) {
    this.back = new EventEmitter();
    this.send = new EventEmitter();
    this.upgradeRune = new EventEmitter();
    this.deposit = new EventEmitter();

    const curs$ = this.currencyService.cur$.subscribe(
      (cur) => {
        this.currency = cur;
      }
    )

    this.subs = [curs$];
  }

  ngOnInit(): void {
    this.setExplorerPath();

    this.chain = this.asset.asset.chain;
    this.ticker = this.asset.asset.ticker;
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

  navCaller(nav) {
    console.log(this.asset)
    if (nav === 'wallet')
      this.overlaysService.setCurrentUserView({userView: 'Addresses', address: null, chain: null, asset: null});
    else if (nav === 'chain')
      this.overlaysService.setCurrentUserView({userView: 'Address', address: this.address, chain: this.chain, asset: null})
  }

  copyToClipboard() {
    if (this.address) {
      let result = this.copyService.copyToClipboard(this.address);

      if (result)
        this.copied = true;
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach(
      (sub) => {
        sub.unsubscribe();
      }
    )
  }

}
