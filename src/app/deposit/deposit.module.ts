import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DepositComponent } from './deposit.component';
import { RouterModule } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AssetInputModule } from '../_components/asset-input/asset-input.module';
import { ConfirmDepositModalComponent } from './confirm-deposit-modal/confirm-deposit-modal.component';
import { TransactionProcessingModalModule } from '../_components/transaction-processing-modal/transaction-processing-modal.module';
import { TransactionSuccessModalModule } from '../_components/transaction-success-modal/transaction-success-modal.module';
import { TransactionLedgerConfirmModalModule } from '../_components/transaction-ledger-confirm-modal/transaction-ledger-confirm-modal.module';
import { ApproveEthContractModule } from '../_components/approve-eth-contract/approve-eth-contract.module';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DirectivesModule } from '../_directives/directives.module';
import { SectionHeadModule } from '../_components/section-head/section-head.module';
import { BreadcrumbModule } from '../_components/breadcrumb/breadcrumb.module';
import { RightOptionModule } from '../_components/right-option/right-option.module';
import { ArrowModule } from '../_components/arrow/arrow.module';
import { MarketsModalModule } from '../_components/markets-modal/markets-modal.module';
import { RetryRuneDepositComponent } from './retry-rune-deposit/retry-rune-deposit.component';
import { PoolTypeOptionsModule } from '../_components/pool-type-options/pool-type-options.module';
import { ApproveEthContractModalModule } from '../_components/approve-eth-contract/approve-eth-contract-modal/approve-eth-contract-modal.module';
import { ConnectModule } from '../_components/connect/connect.module';

@NgModule({
  declarations: [
    DepositComponent,
    ConfirmDepositModalComponent,
    RetryRuneDepositComponent,
  ],
  imports: [
    CommonModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatIconModule,
    AssetInputModule,
    TransactionSuccessModalModule,
    TransactionProcessingModalModule,
    TransactionLedgerConfirmModalModule,
    ApproveEthContractModule,
    ApproveEthContractModalModule,
    DirectivesModule,
    SectionHeadModule,
    BreadcrumbModule,
    RightOptionModule,
    ArrowModule,
    MarketsModalModule,
    ConnectModule,
    MatTooltipModule,
    PoolTypeOptionsModule,
    RouterModule.forChild([
      {
        path: ':asset',
        component: DepositComponent,
      },
      {
        path: '',
        redirectTo: '/pool',
      },
    ]),
  ],
})
export class DepositModule {}
