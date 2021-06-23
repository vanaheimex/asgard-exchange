import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { AnalyticsService } from 'src/app/_services/analytics.service';
import { PhraseConfirmService } from 'src/app/_services/phrase-confirm.service';

@Component({
  selector: 'app-keystore-create-store-phrase',
  templateUrl: './keystore-create-store-phrase.component.html',
  styleUrls: ['./keystore-create-store-phrase.component.scss'],
})
export class KeystoreCreateStorePhraseComponent {
  @Input() phrase: string;
  @Input() eventCategory: string;
  @Output() closeModal: EventEmitter<null>;

  constructor(
    private phraseConfirm: PhraseConfirmService,
    private analytics: AnalyticsService
  ) {
    this.closeModal = new EventEmitter<null>();
  }

  ngOnInit(): void {}

  confirm() {
    this.analytics.event(this.eventCategory, 'button_understand');
    this.phraseConfirm.setConfirmation(true);
    this.closeModal.emit();
  }
}
