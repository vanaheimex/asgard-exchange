import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { PhraseConfirmService } from 'src/app/_services/phrase-confirm.service';

@Component({
  selector: 'app-keystore-create-store-phrase',
  templateUrl: './keystore-create-store-phrase.component.html',
  styleUrls: ['./keystore-create-store-phrase.component.scss']
})
export class KeystoreCreateStorePhraseComponent implements OnInit {

  @Input() phrase: string;
  @Output() closeModal: EventEmitter<null>;

  constructor(private phraseConfirm : PhraseConfirmService) {
    this.closeModal = new EventEmitter<null>();
  }

  ngOnInit(): void {
  }

  confirm() {
    this.phraseConfirm.setConfirmation(true);
    this.closeModal.emit();
  }
}
