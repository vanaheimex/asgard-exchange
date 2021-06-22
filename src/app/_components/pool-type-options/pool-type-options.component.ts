import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Asset } from 'src/app/_classes/asset';
import {
  AvailablePoolTypeOptions,
  PoolTypeOption,
} from 'src/app/_const/pool-type-options';
import { OverlaysService } from 'src/app/_services/overlays.service';

@Component({
  selector: 'app-pool-type-options',
  templateUrl: './pool-type-options.component.html',
  styleUrls: ['./pool-type-options.component.scss'],
})
export class PoolTypeOptionsComponent implements OnInit {
  @Input() asset: Asset;
  @Input() selectedPoolType: PoolTypeOption;
  @Input() poolTypeOptions: AvailablePoolTypeOptions;
  @Output() selectPoolType: EventEmitter<PoolTypeOption>;

  _poolType: PoolTypeOption;
  rune: Asset = new Asset('THOR.RUNE');

  constructor(private overlaysSerivice: OverlaysService, private router: Router) {
    this.selectPoolType = new EventEmitter<PoolTypeOption>();
  }

  ngOnInit() {
    this._poolType = this.selectedPoolType;
  }

  choosenPoolType(poolType: PoolTypeOption) {
    this._poolType = poolType;
  }

  submitPoolType() {
    this.selectPoolType.emit(this._poolType);
    this.overlaysSerivice.setCurrentDepositView('Deposit');
  }

  back() {
    this.router.navigate(['/', 'pool']);
  }
}
