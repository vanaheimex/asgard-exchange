import { Component, Inject, OnInit } from '@angular/core';
import { Asset } from 'src/app/_classes/asset';
import { Subscription } from 'rxjs';
import { AssetAndBalance } from 'src/app/_classes/asset-and-balance';
import { MidgardService } from 'src/app/_services/midgard.service';
import {
  MainViewsEnum,
  OverlaysService,
} from 'src/app/_services/overlays.service';
import { ThorchainPricesService } from 'src/app/_services/thorchain-prices.service';
import { UserService } from 'src/app/_services/user.service';
import { assetAmount } from '@xchainjs/xchain-util';
import {
  AnalyticsService,
  assetString,
} from 'src/app/_services/analytics.service';

@Component({
  selector: 'app-native-rune-prompt-modal',
  templateUrl: './native-rune-prompt-modal.component.html',
  styleUrls: ['./native-rune-prompt-modal.component.scss'],
})
export class NativeRunePromptModalComponent {
  assets: AssetAndBalance[];
  loading: boolean;
  subs: Subscription[];
  mode: 'SELECT_ASSET' | 'UPGRADE_ASSET' | 'CONFIRM' | 'SUCCESS';
  selectedAsset: AssetAndBalance;
  amountToSend: number;
  successfulTxHash: string;
  nonNativeRuneAssets: AssetAndBalance[];
  nativeRune: AssetAndBalance;

  constructor(
    private userService: UserService,
    private midgardService: MidgardService,
    private thorchainPricesService: ThorchainPricesService,
    private overlaysService: OverlaysService,
    private analytics: AnalyticsService
  ) {
    this.nonNativeRuneAssets = [];
    this.loading = true;
    this.mode = 'SELECT_ASSET';

    const balances$ = this.userService.userBalances$.subscribe((balances) => {
      if (balances) {
        const nonNativeRuneAssets = balances
          // get ETH.RUNE and BNB.RUNE
          .filter((balance) => {
            return (
              (balance.asset.chain === 'BNB' &&
                balance.asset.ticker === 'RUNE') ||
              (balance.asset.chain === 'ETH' && balance.asset.ticker === 'RUNE')
            );
          })
          // filter out 0 amounts
          .filter((balance) => balance.amount.amount().isGreaterThan(0))
          // create Asset
          .map((balance) => ({
            asset: new Asset(`${balance.asset.chain}.${balance.asset.symbol}`),
          }));

        this.nonNativeRuneAssets = this.userService.sortMarketsByUserBalance(
          balances,
          nonNativeRuneAssets
        );
      } else {
        this.nonNativeRuneAssets = [];
      }
    });

    this.subs = [balances$];

    this.getNativeRune();
  }

  getNativeRune(): void {
    const user$ = this.userService.userBalances$.subscribe((balances) => {
      const nativeRune = balances
        //get THOR.RUNE
        .filter((balance) => {
          return (
            balance.asset.chain === 'THOR' && balance.asset.ticker === 'RUNE'
          );
        })
        // Create asset
        .map((balance) => ({
          asset: new Asset(`${balance.asset.chain}.${balance.asset.symbol}`),
        }));

      // in case that happens when thorchain won't gave any asset init
      if (nativeRune && nativeRune.length !== 0)
        this.nativeRune = this.userService.sortMarketsByUserBalance(
          balances,
          nativeRune
        )[0];
      else {
        this.nativeRune = {
          asset: new Asset('THOR.RUNE'),
          balance: assetAmount(0),
        };
      }

      //Adding USD value
      this.midgardService.getPools().subscribe(
        (res) => {
          const availablePools = res.filter(
            (pool) => pool.status === 'available'
          );
          const runePrice =
            this.thorchainPricesService.estimateRunePrice(availablePools);

          this.nonNativeRuneAssets = this.nonNativeRuneAssets.map((asset) => {
            return { ...asset, assetPriceUSD: runePrice };
          });

          this.nativeRune = { ...this.nativeRune, assetPriceUSD: runePrice };

          this.assets = this.nonNativeRuneAssets;
          this.loading = false;
        },
        (err) => console.error('error fetching pools:', err)
      );
    });

    this.subs.push(user$);
  }

  selectAsset(asset: Asset) {
    const withBalance = this.assets.find(
      (anb) =>
        `${anb.asset.chain}.${anb.asset.symbol}` ===
        `${asset.chain}.${asset.symbol}`
    );
    this.selectedAsset = withBalance;
    this.mode = 'UPGRADE_ASSET';

    this.analytics.event(
      'upgrade_select',
      'option_selected_*ASSET*',
      undefined,
      assetString(asset)
    );
  }

  transactionSuccessful(hash: string) {
    this.successfulTxHash = hash;
    this.mode = 'SUCCESS';
  }

  breadcrumbNav(val: string) {
    if (val === 'swap') {
      this.analytics.event('upgrade_select', 'breadcrumb_skip');
      this.overlaysService.setViews(MainViewsEnum.Swap, 'Swap');
    }
  }

  confirmUpgradeRune(p: { amount: number }) {
    this.amountToSend = p.amount;
    this.mode = 'CONFIRM';
  }

  close() {
    this.overlaysService.setViews(MainViewsEnum.Swap, 'Swap');
  }

  ngOnDestroy(): void {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }
  }
}
