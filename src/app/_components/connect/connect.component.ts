import {
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { User } from 'src/app/_classes/user';
import { MetamaskService } from 'src/app/_services/metamask.service';
import { UserService } from 'src/app/_services/user.service';
import { environment } from 'src/environments/environment';
import { ethers } from 'ethers';
import { combineLatest, Subscription } from 'rxjs';
import {
  MainViewsEnum,
  OverlaysService,
} from 'src/app/_services/overlays.service';
import { AnalyticsService } from 'src/app/_services/analytics.service';
import { WalletConnectService } from 'src/app/_services/wallet-connect.service';

@Component({
  selector: 'app-connect',
  templateUrl: './connect.component.html',
  styleUrls: ['./connect.component.scss'],
})
export class ConnectComponent implements OnInit, OnDestroy {
  metaMaskProvider: ethers.providers.Web3Provider;
  subs: Subscription[];
  @Output() openWalletOptions: EventEmitter<null>;

  constructor(
    private metaMaskService: MetamaskService,
    private userService: UserService
  ) {
    this.openWalletOptions = new EventEmitter<null>();
    this.subs = [];
  }

  ngOnInit() {
    const user$ = this.userService.user$;
    const metaMaskProvider$ = this.metaMaskService.provider$;
    const combined = combineLatest([user$, metaMaskProvider$]);
    const subs = combined.subscribe(async ([_user, _metaMaskProvider]) => {
      if (_metaMaskProvider) {
        const accounts = await _metaMaskProvider.listAccounts();
        if (accounts.length > 0 && !_user) {
          const signer = _metaMaskProvider.getSigner();
          const address = await signer.getAddress();
          const user = new User({
            type: 'metamask',
            wallet: address,
          });
          this.userService.setUser(user);
        }
      } else {
        console.log('metamask provider is null');
      }
    });

    this.subs = [subs];
  }

  openDialog() {
    this.openWalletOptions.emit();
  }

  ngOnDestroy() {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }
  }
}

export enum ConnectionMethod {
  LEDGER = 'LEDGER',
  KEYSTORE = 'KEYSTORE',
  KEYSTORE_CREATE = 'KEYSTORE_CREATE',
  WALLET_CONNECT = 'WALLET_CONNECT',
  XDEFI = 'XDEFI',
}
export enum ConnectionView {
  KEYSTORE_CONNECT = 'KEYSTORE_CONNECT',
  KEYSTORE_CREATE = 'KEYSTORE_CREATE',
  KEYSTORE_WRITE_PHRASE = 'KEYSTORE_WRITE_PHRASE',
  KEYSTORE_IMPORT_PHRASE = 'KEYSTORE_IMPORT_PHRASE',
  XDEFI = 'XDEFI',
}

@Component({
  selector: 'app-connect-modal',
  templateUrl: 'connect-modal.component.html',
  styleUrls: ['./connect.component.scss'],
})
// eslint-disable-next-line @angular-eslint/component-class-suffix
export class ConnectModal {
  connectionView: ConnectionView;
  isTestnet: boolean;
  isXDEFIConnected: boolean;
  isXDEFI: boolean;
  phrase: string;
  writePhraseCategory: string;
  message: string = 'select';

  @Output() closeEvent = new EventEmitter<null>();

  constructor(
    public overlaysService: OverlaysService,
    private analytics: AnalyticsService,
    private metaMaskService: MetamaskService,
    private wcService: WalletConnectService
  ) {
    this.isTestnet = environment.network === 'testnet' ? true : false;

    this.isXDEFIConnected = false;
    if ((window as any).xfi) {
      this.isXDEFIConnected = true;
    }

    this.isXDEFI = false;
    if (
      (window as any)?.ethereum?.constructor.name
        .toUpperCase()
        .includes('XDEFI')
    ) {
      this.isXDEFI = true;
    }
  }

  breadcrumbNav(val: string) {
    if (val === 'swap') {
      this.overlaysService.setViews(MainViewsEnum.Swap, 'Swap');
      this.analytics.event('connect_select_wallet', 'breadcrumb_skip');
    }
  }

  createKeystore(): void {
    this.connectionView = ConnectionView.KEYSTORE_CREATE;
    this.analytics.event('connect_select_wallet', 'option_create_wallet');
  }

  connectKeystore(): void {
    this.connectionView = ConnectionView.KEYSTORE_CONNECT;
    this.analytics.event('connect_select_wallet', 'option_connect_wallet');
  }

  createKeystoreFromPhrase() {
    this.connectionView = ConnectionView.KEYSTORE_IMPORT_PHRASE;
    this.analytics.event('connect_select_wallet', 'option_create_wallet');
  }

  connectXDEFI() {
    if (!this.isXDEFIConnected) {
      this.analytics.event('connect_select_wallet', 'option_connect_wallet');
      return window.open('https://www.xdefi.io', '_blank');
    }
    this.connectionView = ConnectionView.XDEFI;
    this.analytics.event('connect_select_wallet', 'option_connect_wallet');
  }

  async connectMetaMask(): Promise<void> {
    if (!this.isXDEFI) {
      this.analytics.event('connect_select_wallet', 'option_connect_wallet');
      await this.metaMaskService.connect();
      this.closeEvent.emit();
    }
  }

  async connectWalletConnect() {
    this.analytics.event('connect_select_wallet', 'option_connect_wallet');
    this.message = 'loading';
    await this.wcService.connect();
    this.message = 'select';
    this.closeEvent.emit();
  }

  storePhrasePrompt(values: { phrase: string; label: string }) {
    this.phrase = values.phrase;
    this.writePhraseCategory = values.label;
    this.connectionView = ConnectionView.KEYSTORE_WRITE_PHRASE;
  }

  clearConnectionMethod(): void {
    this.phrase = null;
    this.connectionView = null;
  }

  close() {
    if (!this.connectionView) {
      this.analytics.event('connect_select_wallet', 'button_cancel');
    }

    this.closeEvent.emit();
    this.phrase = null;
  }
}
