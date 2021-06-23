import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CommonModule } from '@angular/common';

/** MATERIAL */
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { IconTickerModule } from '../_components/icon-ticker/icon-ticker.module';

/** COMPONENTS */
import { SwapComponent } from './swap.component';
import { ConfirmSwapModalComponent } from './confirm-swap-modal/confirm-swap-modal.component';
import { ConnectModule } from '../_components/connect/connect.module';

/** MODULES */
import { AssetInputModule } from '../_components/asset-input/asset-input.module';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TransactionProcessingModalModule } from '../_components/transaction-processing-modal/transaction-processing-modal.module';
import { TransactionSuccessModalModule } from '../_components/transaction-success-modal/transaction-success-modal.module';
import { TransactionLedgerConfirmModalModule } from '../_components/transaction-ledger-confirm-modal/transaction-ledger-confirm-modal.module';
import { MarketsModalModule } from '../_components/markets-modal/markets-modal.module';
import { from } from 'rxjs';
import { UpdateTargetAddressModalComponent } from './update-target-address-modal/update-target-address-modal.component';

import { ApproveEthContractModule } from '../_components/approve-eth-contract/approve-eth-contract.module';
import { DirectivesModule } from '../_directives/directives.module';
import { ArrowModule } from '../_components/arrow/arrow.module';
import { BreadcrumbModule } from '../_components/breadcrumb/breadcrumb.module';
import { TagModule } from '../_components/tag/tag.module';
import { NoticeModule } from '../_components/notice/notice.module';
import { RightOptionModule } from '../_components/right-option/right-option.module';
import { PhraseWordsListModule } from '../_components/phrase-words-list/phrase-words-list.module';
import { ApproveEthContractModalModule } from '../_components/approve-eth-contract/approve-eth-contract-modal/approve-eth-contract-modal.module';
import { TextFieldModule } from '../_components/text-field/text-field.module';
@NgModule({
  declarations: [
    SwapComponent,
    ConfirmSwapModalComponent,
    UpdateTargetAddressModalComponent,
  ],
  imports: [
    CommonModule,
    AssetInputModule,
    FormsModule,
    MatButtonModule,
    MatIconModule,
    IconTickerModule,
    MatRadioModule,
    MatProgressSpinnerModule,
    MarketsModalModule,
    TransactionProcessingModalModule,
    TransactionSuccessModalModule,
    TransactionLedgerConfirmModalModule,
    DirectivesModule,
    ApproveEthContractModule,
    ApproveEthContractModalModule,
    ArrowModule,
    BreadcrumbModule,
    TextFieldModule,
    TagModule,
    NoticeModule,
    RightOptionModule,
    PhraseWordsListModule,
    ConnectModule,
    RouterModule.forChild([
      {
        path: ':sourceAsset/:targetAsset',
        component: SwapComponent,
      },
      {
        path: ':sourceAsset',
        component: SwapComponent,
      },
      {
        path: '',
        component: SwapComponent,
      },
      {
        path: '',
        redirectTo: '/swap',
      },
    ]),
  ],
  entryComponents: [ConfirmSwapModalComponent],
})
export class SwapModule {}
