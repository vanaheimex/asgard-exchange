import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { ExplorerPathsService } from 'src/app/_services/explorer-paths.service';
import { TransactionStatusService, Tx } from 'src/app/_services/transaction-status.service';
import { OverlaysService, MainViewsEnum } from 'src/app/_services/overlays.service';
import { Asset } from 'src/app/_classes/asset';

@Component({
  selector: 'app-pending-txs-modal',
  templateUrl: './pending-txs-modal.component.html',
  styleUrls: ['./pending-txs-modal.component.scss']
})
export class PendingTxsModalComponent implements OnInit, OnDestroy {

  txs: Tx[];
  subs: Subscription[];
  bitcoinExplorerUrl: string;
  bchExplorerUrl: string;
  binanceExplorerUrl: string;
  thorchainExplorerUrl: string;
  ethereumExplorerUrl: string;
  litecoinExplorerUrl: string;
  @Output() back: EventEmitter<null>;

  constructor(
    // public dialogRef: MatDialogRef<PendingTxsModalComponent>,
    private explorerPathsService: ExplorerPathsService,
    private txStatusService: TransactionStatusService,
    private overlaysService: OverlaysService
  ) {

    this.back = new EventEmitter<null>();
    this.txs = [];

    this.binanceExplorerUrl = `${this.explorerPathsService.binanceExplorerUrl}/tx`;
    this.bitcoinExplorerUrl = `${this.explorerPathsService.bitcoinExplorerUrl}/tx`;
    this.thorchainExplorerUrl = `${this.explorerPathsService.thorchainExplorerUrl}/txs`;
    this.ethereumExplorerUrl = `${this.explorerPathsService.ethereumExplorerUrl}/tx`;
    this.litecoinExplorerUrl = `${this.explorerPathsService.litecoinExplorerUrl}`;
    this.bchExplorerUrl = `${this.explorerPathsService.bchExplorerUrl}/tx`;

    const pendingTxs$ = this.txStatusService.txs$.subscribe( (txs) => {
      this.txs = txs;
    });

    this.subs = [pendingTxs$];

  }

  ngOnInit(): void {

  }

  getIconPath(tx: Tx) {
    const asset = new Asset(`${tx.chain}.${tx.symbol}`);
    return asset.iconPath
  }

  explorerUrl(chain: string): string {
    switch (chain) {
      case 'BTC':
        return this.bitcoinExplorerUrl;

      case 'BNB':
        return this.binanceExplorerUrl;

      case 'THOR':
        return this.thorchainExplorerUrl;

      case 'ETH':
        return this.ethereumExplorerUrl;

      case 'LTC':
        return this.litecoinExplorerUrl;

      case 'BCH':
        return this.bchExplorerUrl;

      default:
        return '';
    }
  }

  explorerPath(tx: Tx): string {
    if (tx.isThorchainTx) {
      return this.thorchainExplorerUrl + '/' + tx.hash;
    } else if (tx.chain === 'ETH') {
      return `${this.ethereumExplorerUrl}/0x${tx.hash}`;
    } else {
      return this.explorerUrl(tx.chain) + '/' + tx.hash;
    }
  }

  goToExternal(url: string) {
    console.log(url)
    window.open(url, '_blank');
  }

  close(): void {
    // this.dialogRef.close();
    this.overlaysService.setViews(MainViewsEnum.Swap, 'Swap');
  }

  ngOnDestroy() {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }
  }

}
