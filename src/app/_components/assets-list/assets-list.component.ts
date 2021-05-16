import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Asset } from 'src/app/_classes/asset';
import { AssetAndBalance } from 'src/app/_classes/asset-and-balance';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-assets-list',
  templateUrl: './assets-list.component.html',
  styleUrls: ['./assets-list.component.scss'],
})
export class AssetsListComponent {
  @Input() loading: boolean;
  @Input() assetListItems: AssetAndBalance[];
  @Input() disabledAssetSymbol: string;
  @Input() displayAddTokenButton: boolean;
  @Output() selectAsset: EventEmitter<Asset>;
  @Output() addToken: EventEmitter<null>;
  @Input() noAssets: string = "NO ASSETS";

  // Wheter show the icon or not
  @Input() showIcons: boolean = true;
  @Input() expandable: 'full' | 'semi'= 'full';
  safariExpand: boolean;
  isTestnet: boolean;

  constructor() {
    this.selectAsset = new EventEmitter<Asset>();
    this.addToken = new EventEmitter<null>();

    this.isTestnet = environment.network === 'testnet' ? true : false;
  }

  ngOnInit(): void {
    if (this.disabledAssetSymbol) {
      this.assetListItems = this.assetListItems.filter((asset) => {
        return asset.asset.symbol != this.disabledAssetSymbol;
      })
    }
    this.safariExpand = /^((?!chrome|android).)*safari/i.test(navigator.userAgent) ? true : false;
  }

}
