import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Asset } from '@xchainjs/xchain-util';
import { AssetAndBalance } from 'src/app/_classes/asset-and-balance';

@Component({
  selector: 'app-transaction-processing-modal',
  templateUrl: './transaction-processing-modal.component.html',
  styleUrls: ['./transaction-processing-modal.component.scss']
})
export class TransactionProcessingModalComponent implements OnInit {

  @Input() transactionDetail: string;
  @Output() closeDialog: EventEmitter<null>;
  @Input() isSending: boolean = false;
  @Input() isWithdraw: boolean = false;
  @Input() asset: Array<AssetAndBalance>;
  @Input() label: Array<string>;
  @Input() amount: Array<number>;
  @Input() recipientAddress: string;
  @Input() percentage: number;
  @Input() isPlus: boolean = false;
  @Input() memo: string;

  constructor() {
    this.closeDialog = new EventEmitter<null>();
  }

  ngOnInit(): void {
  }

  onCloseDialog() {
    this.closeDialog.emit();
  }

}
