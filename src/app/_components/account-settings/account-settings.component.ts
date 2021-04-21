import { Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { MainViewsEnum, OverlaysService, SettingViews } from 'src/app/_services/overlays.service';
import { SlippageToleranceService } from 'src/app/_services/slippage-tolerance.service';

@Component({
  selector: 'app-account-settings',
  templateUrl: './account-settings.component.html',
  styleUrls: ['./account-settings.component.scss']
})
export class AccountSettingsComponent implements OnInit {

  loading: boolean;
  slippageTolerance: number;
  subs: Subscription[];

  constructor(
    private overlaysService: OverlaysService,
    private slipLimitService: SlippageToleranceService) {

    const slippageTolerange$ = this.slipLimitService.slippageTolerance$.subscribe(
      (limit) => this.slippageTolerance = limit
    );

    this.subs = [slippageTolerange$];

  }

  ngOnInit(): void {
    this.loading = true;
  }

  close() {
    this.overlaysService.setViews(MainViewsEnum.Swap, 'Swap');
  }

  getSettingView() {
    return this.overlaysService.getSettingViews();
  }

  setSettingView(val: SettingViews) {
    this.overlaysService.setSettingView(val)
  }

  ngOnDestroy() {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }

    this.overlaysService.setSettingView('ACCOUNT');
  }

}
