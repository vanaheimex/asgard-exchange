import { Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { User } from 'src/app/_classes/user';
import { AnalyticsService } from 'src/app/_services/analytics.service';
import { CurrencyService } from 'src/app/_services/currency.service';
import {
  MainViewsEnum,
  OverlaysService,
  SettingViews,
} from 'src/app/_services/overlays.service';
import { SlippageToleranceService } from 'src/app/_services/slippage-tolerance.service';
import { UserService } from 'src/app/_services/user.service';
import { Currency } from './currency-converter/currency-converter.component';

@Component({
  selector: 'app-account-settings',
  templateUrl: './account-settings.component.html',
  styleUrls: ['./account-settings.component.scss'],
})
export class AccountSettingsComponent implements OnInit {
  loading: boolean;
  slippageTolerance: number;
  subs: Subscription[];
  user: User;

  currency: Currency;

  constructor(
    private overlaysService: OverlaysService,
    private slipLimitService: SlippageToleranceService,
    private userService: UserService,
    private currencyService: CurrencyService,
    private analytics: AnalyticsService
  ) {
    const slippageTolerange$ =
      this.slipLimitService.slippageTolerance$.subscribe(
        (limit) => (this.slippageTolerance = limit)
      );

    const user$ = this.userService.user$.subscribe(async (user) => {
      if (user) {
        this.user = user;
      }
    });

    const cur$ = currencyService.cur$.subscribe((cur) => {
      this.currency = cur;
    });

    this.subs = [slippageTolerange$, user$, cur$];
  }

  breadcrumbNav(val: string) {
    if (val === 'swap') {
      this.analytics.event('setting_select', 'breadcrumb_skip');
      this.overlaysService.setViews(MainViewsEnum.Swap, 'Swap');
    }
  }

  ngOnInit(): void {
    this.loading = true;
  }

  close() {
    this.analytics.event('setting_select', 'button_close');
    this.overlaysService.setViews(MainViewsEnum.Swap, 'Swap');
  }

  getSettingView() {
    return this.overlaysService.getSettingViews();
  }

  setSettingView(val: SettingViews) {
    this.analytics.event(
      'setting_select',
      'option_selected_*SETTING*',
      undefined,
      val
    );
    this.overlaysService.setSettingView(val);
  }

  changeSettingView(val: SettingViews) {
    this.overlaysService.setSettingView(val);
  }

  ngOnDestroy() {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }

    this.overlaysService.setSettingView('ACCOUNT');
  }
}
