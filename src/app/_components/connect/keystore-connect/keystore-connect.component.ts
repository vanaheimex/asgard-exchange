import { Component, Output, EventEmitter } from '@angular/core';
import { UserService } from 'src/app/_services/user.service';
import { KeystoreService } from 'src/app/_services/keystore.service';
import {
  MainViewsEnum,
  OverlaysService,
} from 'src/app/_services/overlays.service';
import { AnalyticsService } from 'src/app/_services/analytics.service';

export type Keystore = {
  address: string;
  crypto: {
    cipher: string;
    ciphertext: string;
    cipherparams: {
      iv: string;
    };
    kdf: string;
    kdfparams: {
      prf: string;
      dklen: number;
      salt: string;
      c: number;
    };
    mac: string;
  };
  id: string;
  version: number;
  meta: string;
};

@Component({
  selector: 'app-keystore-connect',
  templateUrl: './keystore-connect.component.html',
  styleUrls: ['./keystore-connect.component.scss'],
})
export class KeystoreConnectComponent {
  keystorePassword: string;
  keystoreFile: File;
  keystoreFileSelected: boolean;
  keystore;
  keystoreConnecting: boolean;
  keystoreError: boolean;
  @Output() back: EventEmitter<null>;
  @Output() closeModal: EventEmitter<null>;

  constructor(
    private userService: UserService,
    private keystoreService: KeystoreService,
    private overlaysService: OverlaysService,
    private analytics: AnalyticsService
  ) {
    this.back = new EventEmitter<null>();
    this.closeModal = new EventEmitter<null>();
  }

  clearKeystore() {
    this.keystorePassword = '';
    this.keystoreFile = null;
    this.keystoreFileSelected = false;
    this.analytics.event('connect_connect_wallet', 'button_cancel');
    this.back.emit();
  }

  breadcrumbNav(val: string) {
    if (val === 'swap') {
      this.analytics.event('connect_connect_wallet', 'breadcrumb_skip');
      this.overlaysService.setViews(MainViewsEnum.Swap, 'Swap');
    } else if (val === 'connect') {
      this.analytics.event('connect_connect_wallet', 'breadcrumb_connect');
      this.back.emit();
    }
  }

  async onKeystoreFileChange(event: Event) {
    this.analytics.event('connect_connect_wallet', 'tag_select_file');
    this.keystoreFileSelected = true;

    const target = event.target as HTMLInputElement;
    const files = target.files;

    if (files && files.length > 0) {
      const keystoreFile = files[0];

      const reader = new FileReader();

      const onLoadHandler = () => {
        try {
          const key = JSON.parse(reader.result as string);
          if (!('version' in key) || !('crypto' in key)) {
            console.error('not a valid keystore file');
          } else {
            this.keystore = key;
          }
        } catch {
          console.error('not a valid json file');
        }
      };
      reader.addEventListener('load', onLoadHandler);

      await reader.readAsText(keystoreFile);
    }
  }

  async initUnlock() {
    if (this.keystoreConnecting) {
      return;
    }

    this.analytics.event('connect_connect_wallet', 'button_connect');
    this.keystoreConnecting = true;

    setTimeout(() => {
      this.keystoreUnlock();
    }, 100);
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
      this.closeModal.emit();
    } catch (error) {
      this.keystoreConnecting = false;
      this.keystoreError = true;
      console.error(error);
    }
  }
}
