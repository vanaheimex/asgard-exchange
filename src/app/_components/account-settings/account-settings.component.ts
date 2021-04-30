import { Component, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { User } from 'src/app/_classes/user';
import { MainViewsEnum, OverlaysService, SettingViews } from 'src/app/_services/overlays.service';
import { SlippageToleranceService } from 'src/app/_services/slippage-tolerance.service';
import { UserService } from 'src/app/_services/user.service';

@Component({
  selector: 'app-account-settings',
  templateUrl: './account-settings.component.html',
  styleUrls: ['./account-settings.component.scss']
})
export class AccountSettingsComponent implements OnInit {

  loading: boolean;
  slippageTolerance: number;
  subs: Subscription[];
  user: User;


  constructor(
    private overlaysService: OverlaysService,
    private slipLimitService: SlippageToleranceService,
    private userService: UserService) {

    const slippageTolerange$ = this.slipLimitService.slippageTolerance$.subscribe(
      (limit) => this.slippageTolerance = limit
    );

    const user$ = this.userService.user$.subscribe(
      async (user) => {

        if (user) {
          this.user = user;          
        }

      }
    );

    this.subs = [slippageTolerange$, user$];

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
