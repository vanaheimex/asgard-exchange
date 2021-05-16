import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Subscription } from 'rxjs';
import { User } from 'src/app/_classes/user';
import { TransactionStatusService } from 'src/app/_services/transaction-status.service';
import { UserSettingsDialogComponent } from './user-settings-dialog/user-settings-dialog.component';
import { UserService } from 'src/app/_services/user.service';
import { MainViewsEnum, OverlaysService } from 'src/app/_services/overlays.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-user-settings',
  templateUrl: './user-settings.component.html',
  styleUrls: ['./user-settings.component.scss'],
})
export class UserSettingsComponent implements OnDestroy {
  @Input() user: User;
  pendingTxCount: number;
  modalDimensions = {
    maxWidth: '520px',
    width: '50vw',
    minWidth: '260px',
  };
  subs: Subscription[];
  @Input() overlay: boolean;
  @Output() overlayChange = new EventEmitter<boolean>();
  _showMenu: boolean;
  get showMenu() {
    return this.overlaysService.getMenu();
  }
  set showMenu(val: boolean) {
    this.overlaysService.setMenu(val);
    this._showMenu = val
  }

  currentView: MainViewsEnum;

  constructor(private txStatusService: TransactionStatusService, private router: Router, private userService: UserService, public overlaysService: OverlaysService) {
    this.pendingTxCount = 0;
    this.showMenu = false;

    const pendingTx$ = this.txStatusService.txs$.subscribe(
      (_txs) => {
        this.pendingTxCount = this.txStatusService.getPendingTxCount();
      }
    );

    const overlay$ = this.overlaysService.currentView.subscribe(val => {
      this.currentView = val;
    });

    this.subs = [pendingTx$, overlay$];

  }

  openUserSettings() {
    // this.overlayChange.emit(!this.overlay);
    // if (this.currentView == MainViewsEnum.UserSetting)
    //   this.overlaysService.setCurrentView(MainViewsEnum.Swap)
    // else
    this.overlaysService.setCurrentUserView({userView: "Addresses", address: null, chain: null, asset: null});
    this.overlaysService.setSettingViews(MainViewsEnum.UserSetting, 'ACCOUNT');
  }

  openAccountSetting() {
    // if (this.currentView == MainViewsEnum.AccountSetting)
    //   this.overlaysService.setCurrentView(MainViewsEnum.Swap)
    // else
    this.overlaysService.setSettingView('ACCOUNT');
    this.overlaysService.setCurrentView(MainViewsEnum.AccountSetting);
  }

  openTransaction() {
    // if (this.currentView == MainViewsEnum.Transaction)
    //   this.overlaysService.setCurrentView(MainViewsEnum.Swap)
    // else
    this.overlaysService.setCurrentView(MainViewsEnum.Transaction);
  }

  disconnect() {
    this.userService.setUser(null);
    this.overlaysService.setViews(MainViewsEnum.Swap, "Swap");

    // add this guard in case the route is not in the swap change it to the swap
    if (this.router.url !== '/swap') {
      this.router.navigate(['/', 'swap']);
    }
  }

  toggleMenu() {
    this.showMenu = !(this.showMenu)
  }

  ngOnDestroy() {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }
  }
}
