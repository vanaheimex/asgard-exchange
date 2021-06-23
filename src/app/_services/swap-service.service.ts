import { Injectable } from '@angular/core';
import BigNumber from 'bignumber.js';

@Injectable({
  providedIn: 'root',
})
export class SwapServiceService {
  private targetAmount: BigNumber = new BigNumber(0);
  private sourceAmount: number = 0;
  private sourceAsset;
  private targetAsset;

  setTarget(val: BigNumber) {
    this.targetAmount = val;
  }

  setSource(val: number) {
    this.sourceAmount = val;
  }

  getTargetAmount() {
    return this.targetAmount;
  }

  getSourceAmount() {
    return this.sourceAmount;
  }
}
