import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApproveEthContractModalComponent } from './approve-eth-contract-modal.component';
import { NoticeModule } from '../../notice/notice.module';
import { BreadcrumbModule } from '../../breadcrumb/breadcrumb.module';



@NgModule({
  declarations: [ApproveEthContractModalComponent],
  imports: [
    CommonModule,
    BreadcrumbModule,
    NoticeModule
  ],
  exports: [ApproveEthContractModalComponent]
})
export class ApproveEthContractModalModule { }