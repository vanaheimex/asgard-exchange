import {
  Component,
  OnDestroy,
  OnInit,
  EventEmitter,
  Output,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { AnalyticsService } from 'src/app/_services/analytics.service';
import {
  MainViewsEnum,
  OverlaysService,
} from 'src/app/_services/overlays.service';
import { SlippageToleranceService } from 'src/app/_services/slippage-tolerance.service';
@Component({
  selector: 'app-slippage-tolerance',
  templateUrl: './slippage-tolerance.component.html',
  styleUrls: ['./slippage-tolerance.component.scss'],
})
export class SlippageToleranceComponent implements OnInit, OnDestroy {
  @Output() close: EventEmitter<null> = new EventEmitter<null>();

  slippageTolerance$: Subscription;
  tolerance: number;
  message: string;

  set customTolerance(num: number) {
    this.message =
      this.tolerance == this.customTolerance || !this.customTolerance
        ? 'adjust'
        : 'ready';
    this._customTolerance = num;
  }
  get customTolerance() {
    return this._customTolerance;
  }
  private _customTolerance: number;

  constructor(
    private slippageToleranceService: SlippageToleranceService,
    private overlaysService: OverlaysService,
    private analytics: AnalyticsService
  ) {
    this.slippageTolerance$ =
      this.slippageToleranceService.slippageTolerance$.subscribe(
        (percent: number) => {
          this.tolerance = percent;
          this.customTolerance = percent;
        }
      );
  }

  ngOnInit(): void {
    this.message = 'adjust';
  }

  breadcrumbNav(val: string) {
    if (val === 'swap') {
      this.analytics.event('setting_slippage_tolerance', 'breadcrumb_skip');
      this.overlaysService.setViews(MainViewsEnum.Swap, 'Swap');
    } else if (val === 'settings') {
      this.analytics.event('setting_slippage_tolerance', 'breadcrumb_settings');
      this.close.emit();
    }
  }

  setSlippage() {
    this.analytics.event(
      'setting_slippage_tolerance',
      'button_save_%_*numerical_value*',
      undefined,
      this.customTolerance.toString()
    );
    this.slippageToleranceService.setSlippageTolerance(this.customTolerance);
    this.message = 'saved';
    this.closeDialog();
  }

  closeButton() {
    this.analytics.event(
      'setting_slippage_tolerance',
      'button_cancel_%_*numerical_value*',
      undefined,
      this.customTolerance.toString()
    );
    this.closeDialog();
  }

  closeDialog() {
    const gotoSwap = this.overlaysService.getSettingNavSwap();
    if (gotoSwap) {
      this.overlaysService.setSettingViews(MainViewsEnum.Swap, 'ACCOUNT');
    }
    this.close.emit();
  }

  ngOnDestroy() {
    this.slippageTolerance$.unsubscribe();
  }
}
