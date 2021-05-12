import { Component, OnInit, Output, Input, EventEmitter } from '@angular/core';
import { generatePhrase, encryptToKeyStore } from '@xchainjs/xchain-crypto';
import { KeystoreService } from 'src/app/_services/keystore.service';
import { PhraseConfirmService } from 'src/app/_services/phrase-confirm.service';
import { UserService } from 'src/app/_services/user.service';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-import-phrase',
  templateUrl: './import-phrase.component.html',
  styleUrls: ['./import-phrase.component.scss']
})
export class ImportPhraseComponent implements OnInit {

  @Output() back: EventEmitter<null>;
  @Output() closeModal: EventEmitter<null>;
  @Output() keystoreCreated: EventEmitter<string>;
  password: string;
  confirmPassword: string;
  phrase: string;
  loading: boolean;
  error: boolean;
  message: string;
  
  constructor(private userService: UserService, private keystoreService: KeystoreService, private phraseConfirm: PhraseConfirmService) { 
    this.loading = false;
    this.message = "import phrase"
    this.back = new EventEmitter<null>();
    this.closeModal = new EventEmitter<null>();
    this.keystoreCreated = new EventEmitter<string>();
  }

  ngOnInit(): void {
  }

  async createKeystore() {

    this.loading = true;

    try {
      const keystore = await encryptToKeyStore(this.phrase, this.password);

      localStorage.setItem('keystore', JSON.stringify(keystore));

      //adding this to hide menu and notification bar + logo redirection
      this.phraseConfirm.setConfirmation(false);

      const user = await this.keystoreService.unlockKeystore(keystore, this.password);
      this.userService.setUser(user);

      const thorAddress = await user.clients.thorchain.getAddress();
      const addressLength = thorAddress.length;
      const minAddress = `${thorAddress.substring(0, environment.network === 'testnet' ? 7 : 6)}_${thorAddress.substring(addressLength - 3, addressLength)}`;
      const bl = new Blob([JSON.stringify(keystore)], {
        type: 'text/plain'
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(bl);
      a.download = `keystore_thorchain_${minAddress}`;
      a.hidden = true;
      document.body.appendChild(a);
      a.innerHTML =
        'loading';
      a.click();

      this.keystoreCreated.emit(this.phrase);
    } catch (error) {
      console.error(error);
      this.message = error.message;
      this.error = true;
    }

    this.loading = false;

  }

}
