import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TransactionProcessingModalComponent } from './transaction-processing-modal.component';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatIconModule } from '@angular/material/icon';
import { AssetInputModule } from '../asset-input/asset-input.module';
import { ArrowModule } from '../arrow/arrow.module';
import { TextFieldModule } from '../text-field/text-field.module';
import { DoubleAssetFieldModule } from '../double-asset-field/double-asset-field.module';
import { MatSliderModule } from '@angular/material/slider';

@NgModule({
  declarations: [TransactionProcessingModalComponent],
  imports: [
    CommonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    AssetInputModule,
    ArrowModule,
    TextFieldModule,
    DoubleAssetFieldModule,
    MatSliderModule,
  ],
  exports: [TransactionProcessingModalComponent],
})
export class TransactionProcessingModalModule {}
