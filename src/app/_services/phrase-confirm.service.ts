import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PhraseConfirmService {
  private isUnderStood = new BehaviorSubject<boolean>(true);
  isUnderStood$ = this.isUnderStood.asObservable();

  constructor() {}

  getConfirmation() {
    return this.isUnderStood;
  }

  setConfirmation(val: boolean) {
    this.isUnderStood.next(val);
  }
}
