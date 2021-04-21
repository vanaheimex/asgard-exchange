import { Component, Input, OnInit } from '@angular/core';
import { MemberPool } from 'src/app/_classes/member';
import { PoolDTO } from 'src/app/_classes/pool';
import { PoolDetailService } from 'src/app/_services/pool-detail.service';

@Component({
  selector: 'app-staked-pools-list',
  templateUrl: './staked-pools-list.component.html',
  styleUrls: ['./staked-pools-list.component.scss']
})
export class StakedPoolsListComponent implements OnInit {

  activePool: PoolDTO;

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

  constructor(private poolDetailService : PoolDetailService) { }

  ngOnInit(): void { }

  mapPools() {

    if (this.pools && this.memberPools) {
      this.mappedPools = this.memberPools.map( (memberPool) => {
        return {
          poolData: this.pools.find( (pool) => pool.asset === memberPool.pool ),
          memberData: memberPool
        };
      });
    }

  }

}
