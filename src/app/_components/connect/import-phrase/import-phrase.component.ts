import { Component, OnInit, Output, Input, EventEmitter } from '@angular/core';
import { generatePhrase, encryptToKeyStore } from '@xchainjs/xchain-crypto';
import { AnalyticsService } from 'src/app/_services/analytics.service';
import { KeystoreService } from 'src/app/_services/keystore.service';
import {
  MainViewsEnum,
  OverlaysService,
} from 'src/app/_services/overlays.service';
import { PhraseConfirmService } from 'src/app/_services/phrase-confirm.service';
import { UserService } from 'src/app/_services/user.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-import-phrase',
  templateUrl: './import-phrase.component.html',
  styleUrls: ['./import-phrase.component.scss'],
})
export class ImportPhraseComponent implements OnInit {
  @Output() back: EventEmitter<null>;
  @Output() closeModal: EventEmitter<null>;
  @Output() keystoreCreated: EventEmitter<{ phrase: string; label: string }>;
  password: string;
  confirmPassword: string;
  phrase: string;
  loading: boolean;
  error: boolean;
  message: string;

  constructor(
    private userService: UserService,
    private keystoreService: KeystoreService,
    private phraseConfirm: PhraseConfirmService,
    private overlaysService: OverlaysService,
    private analytics: AnalyticsService
  ) {
    this.loading = false;
    this.message = 'PREPARE';
    this.back = new EventEmitter<null>();
    this.closeModal = new EventEmitter<null>();
    this.keystoreCreated = new EventEmitter<{
      phrase: string;
      label: string;
    }>();
  }

  ngOnInit(): void {}

  breadcrumbNav(val: string) {
    if (val === 'swap') {
      this.analytics.event('connect_create_wallet', 'breadcrumb_skip');
      this.overlaysService.setViews(MainViewsEnum.Swap, 'Swap');
    } else if (val === 'connect') {
      this.analytics.event('connect_create_wallet', 'breadcrumb_connect');
      this.back.emit();
    }
  }

  async createKeystore() {
    this.loading = true;

    try {
      const keystore = await encryptToKeyStore(this.phrase, this.password);

      localStorage.setItem('keystore', JSON.stringify(keystore));

      //adding this to hide menu and notification bar + logo redirection
      this.phraseConfirm.setConfirmation(false);

      const user = await this.keystoreService.unlockKeystore(
        keystore,
        this.password
      );
      this.userService.setUser(user);

      const thorAddress = await user.clients.thorchain.getAddress();
      const addressLength = thorAddress.length;
      const minAddress = `${thorAddress.substring(
        0,
        environment.network === 'testnet' ? 7 : 6
      )}_${thorAddress.substring(addressLength - 3, addressLength)}`;
      const bl = new Blob([JSON.stringify(keystore)], {
        type: 'text/plain',
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(bl);
      a.download = `keystore_thorchain_${minAddress}`;
      a.hidden = true;
      document.body.appendChild(a);
      a.innerHTML = 'loading';
      a.click();

      this.keystoreCreated.emit({
        phrase: this.phrase,
        label: 'connect_create_wallet',
      });
      this.analytics.event('connect_create_wallet', 'button_create');
    } catch (error) {
      console.error(error);
      this.message = error.message;
      this.error = true;
    }

    this.loading = false;
  }

  backNav() {
    this.analytics.event('connect_create_wallet', 'button_cancel');
    this.back.emit();
  }
}
