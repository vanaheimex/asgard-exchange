import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { PoolCreateComponent } from './pool-create.component';
import { ConfirmPoolCreateComponent } from './confirm-pool-create/confirm-pool-create.component';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AssetInputModule } from '../_components/asset-input/asset-input.module';
import { SectionHeadModule } from '../_components/section-head/section-head.module';
import { MatDialogModule } from '@angular/material/dialog';
import { TransactionSuccessModalModule } from '../_components/transaction-success-modal/transaction-success-modal.module';
import { TransactionProcessingModalModule } from '../_components/transaction-processing-modal/transaction-processing-modal.module';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApproveEthContractModule } from '../_components/approve-eth-contract/approve-eth-contract.module';
import { DirectivesModule } from '../_directives/directives.module';
import { BreadcrumbModule } from '../_components/breadcrumb/breadcrumb.module';
import { ArrowModule } from '../_components/arrow/arrow.module';
import { MarketsModalModule } from '../_components/markets-modal/markets-modal.module';
// import { ApproveEthContractModalComponent } from '../_components/approve-eth-contract/approve-eth-contract-modal/approve-eth-contract-modal.component';
import { NoticeModule } from '../_components/notice/notice.module';
import { ApproveEthContractModalModule } from '../_components/approve-eth-contract/approve-eth-contract-modal/approve-eth-contract-modal.module';

@NgModule({
  declarations: [PoolCreateComponent, ConfirmPoolCreateComponent],
  imports: [
    CommonModule,
    AssetInputModule,
    MatIconModule,
    MatButtonModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    SectionHeadModule,
    TransactionSuccessModalModule,
    TransactionProcessingModalModule,
    ApproveEthContractModule,
    ApproveEthContractModalModule,
    DirectivesModule,
    BreadcrumbModule,
    ArrowModule,
    MarketsModalModule,
    NoticeModule,
    RouterModule.forChild([
      {
        path: '',
        component: PoolCreateComponent,
      },
    ]),
  ],
})
export class PoolCreateModule {}
