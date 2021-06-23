import {
  Component,
  Inject,
  OnInit,
  Input,
  Output,
  EventEmitter,
} from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { AnalyticsService } from 'src/app/_services/analytics.service';
import { KeystoreService } from 'src/app/_services/keystore.service';
import {
  OverlaysService,
  MainViewsEnum,
} from 'src/app/_services/overlays.service';
import { UserService } from 'src/app/_services/user.service';

@Component({
  selector: 'app-reconnect-dialog',
  templateUrl: './reconnect-dialog.component.html',
  styleUrls: ['./reconnect-dialog.component.scss'],
})
export class ReconnectDialogComponent {
  keystorePassword: string;
  keystoreError: boolean;
  keystoreConnecting: boolean;
  // keystore;

  constructor(
    // @Inject(MAT_DIALOG_DATA) public data,
    // private dialogRef: MatDialogRef<ReconnectDialogComponent>,
    private keystoreService: KeystoreService,
    private userService: UserService,
    public overlayService: OverlaysService,
    private analytics: AnalyticsService
  ) {
    this.keystoreConnecting = false;
    // this.keystore = data.keystore;
  }

  @Input() keystore: any;

  ngOnInit(): void {}

  async initUnlock() {
    if (this.keystoreConnecting) {
      return;
    }

    this.analytics.event('connect_reconnect_wallet', 'button_connect');

    this.keystoreConnecting = true;

    setTimeout(() => {
      this.keystoreUnlock();
    }, 100);
  }

  breadcrumbNav(val: string) {
    if (val === 'skip') {
      this.analytics.event('connect_reconnect_wallet', 'breadcrumb_skip');
      this.overlayService.setViews(MainViewsEnum.Swap, 'Swap');
    } else if (val === 'connect') {
      this.analytics.event('connect_reconnect_wallet', 'breadcrumb_connect');
      this.overlayService.setViews(MainViewsEnum.Swap, 'Connect');
    }
  }

  async keystoreUnlock() {
    this.keystoreError = false;

    try {
      localStorage.setItem('keystore', JSON.stringify(this.keystore));
      const user = await this.keystoreService.unlockKeystore(
        this.keystore,
        this.keystorePassword
      );
      this.userService.setUser(user);
      this.overlayService.setViews(MainViewsEnum.Swap, 'Swap');
    } catch (error) {
      this.keystoreConnecting = false;
      this.keystoreError = true;
      console.error(error);
    }
  }

  forgetKeystore() {
    this.analytics.event('connect_reconnect_wallet', 'button_forget');
    localStorage.clear();
    this.overlayService.setViews(MainViewsEnum.Swap, 'Swap');
  }
}
