import { Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { AssetAndBalance } from 'src/app/_classes/asset-and-balance';
import {
  MainViewsEnum,
  OverlaysService,
} from 'src/app/_services/overlays.service';
import { UserService } from 'src/app/_services/user.service';
import { Asset } from 'src/app/_classes/asset';
import { AnalyticsService } from 'src/app/_services/analytics.service';

@Component({
  selector: 'app-native-rune-prompt',
  templateUrl: './native-rune-prompt.component.html',
  styleUrls: ['./native-rune-prompt.component.scss'],
})
export class NativeRunePromptComponent implements OnInit {
  subs: Subscription[];
  nonNativeRuneAssets: AssetAndBalance[];
  currentView: MainViewsEnum;

  constructor(
    private userService: UserService,
    private overlaysService: OverlaysService,
    private analytics: AnalyticsService
  ) {
    this.nonNativeRuneAssets = [];

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

    const currentView$ = this.overlaysService.currentView.subscribe((val) => {
      this.currentView = val;
    });

    this.subs = [balances$, currentView$];
  }

  ngOnInit(): void {}

  launchModal() {
    this.analytics.event('menu', 'menu_upgrade');
    this.overlaysService.setCurrentView(MainViewsEnum.Upgrade);
  }
}
