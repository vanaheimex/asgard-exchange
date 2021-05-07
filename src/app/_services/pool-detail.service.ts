import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Asset } from '../_classes/asset';

type poolDetail = {
  poolType?: 'member' | 'notMember',
  pooledRune?: number,
  pooledAsset?: number,
  pooledShare?: number,
  pooledAssetTicker?: string,
  pooledAssetChain?: string
}

@Injectable({
  providedIn: 'root'
})
export class PoolDetailService {
  private pooledDetails = new BehaviorSubject<poolDetail>({});
  pooledDetails$ = this.pooledDetails.asObservable();

  private activatedAsset = new BehaviorSubject<Asset>(null);
  activatedAsset$ = this.activatedAsset.asObservable();

  constructor() { }

  getActivatedAsset() {
    return this.activatedAsset;
  }

  setActivatedAsset(val: Asset) {
    this.activatedAsset.next(val);
  }

  getPooledDeatils() {
    return this.pooledDetails;
  }

  setPooledDetails(poolType?: 'member' | 'notMember', pooledRune?: number, pooledAsset?: number, pooledShare?: number, pooledAssetTicker?: string, pooledAssetChain?: string) {
    this.pooledDetails.next({poolType, pooledRune, pooledAsset, pooledShare , pooledAssetTicker, pooledAssetChain});
  }

}
