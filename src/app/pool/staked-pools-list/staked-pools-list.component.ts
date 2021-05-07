import { Component, Input, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { MemberPool } from 'src/app/_classes/member';
import { PoolDTO } from 'src/app/_classes/pool';
import { Currency } from 'src/app/_components/account-settings/currency-converter/currency-converter.component';
import { CurrencyService } from 'src/app/_services/currency.service';

@Component({
  selector: 'app-staked-pools-list',
  templateUrl: './staked-pools-list.component.html',
  styleUrls: ['./staked-pools-list.component.scss']
})
export class StakedPoolsListComponent implements OnInit {

  activePool: PoolDTO;

  @Input() runePrice: number;
  @Input() set pools(pools: PoolDTO[]) {
    this._pools = pools;
    this.mapPools();
  }
  get pools() {
    return this._pools;
  }
  _pools: PoolDTO[];
  @Input() depositsDisabled: boolean;

  @Input() set memberPools(memberPools: MemberPool[]) {
    this._memberPools = memberPools;
    this.mapPools();
  }
  get memberPools() {
    return this._memberPools;
  }
  _memberPools: MemberPool[];

  mappedPools: {
    poolData: PoolDTO,
    memberData: MemberPool
  }[];

  notMamberPools: PoolDTO[];
  currency: Currency;
  subs: Subscription[];

  constructor(private currencyService: CurrencyService) { 
    const cur$ = this.currencyService.cur$.subscribe(
      (cur) => {
        this.currency = cur;
      }
    )

    this.subs = [cur$]
  }

  ngOnInit(): void { }

  mapPools() {

    if (this.pools && this.memberPools) {
      this.mappedPools = this.memberPools.map( (memberPool) => {
        return {
          poolData: {...this.pools.find( (pool) => pool.asset === memberPool.pool ), runePrice: this.runePrice},
          memberData: memberPool
        };
      });

      this.mappedPools.sort((a,b) => (a.poolData.asset > b.poolData.asset) ? 1 : ((b.poolData.asset > a.poolData.asset) ? -1 : 0))
    }

    if(this.pools && this.memberPools) {
      this.notMamberPools = [] as PoolDTO[];
      console.log(this.memberPools)
      console.log(this.pools)
      this.pools.forEach(
        (pool) => {
          if (this.memberPools.find( (p) => p.pool === pool.asset )) {
            return;
          }
          this.notMamberPools.push({...pool, runePrice: this.runePrice})
        }
      )

      this.notMamberPools.sort((a,b) => (a.asset > b.asset) ? 1 : ((b.asset > a.asset) ? -1 : 0));

    }

  }

  ngOnDestroy(): void {
    this.subs.forEach(sub => sub.unsubscribe())
  }

}
