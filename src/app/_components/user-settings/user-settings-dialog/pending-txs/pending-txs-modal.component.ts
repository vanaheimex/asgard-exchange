import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { Subscription } from 'rxjs';
import { ExplorerPathsService } from 'src/app/_services/explorer-paths.service';
import { TransactionStatusService, Tx, TxActions, TxStatus } from 'src/app/_services/transaction-status.service';
import { OverlaysService, MainViewsEnum } from 'src/app/_services/overlays.service';
import { Asset } from 'src/app/_classes/asset';
import { environment } from 'src/environments/environment';
import { User } from 'src/app/_classes/user';
import { UserService } from 'src/app/_services/user.service';
import { MidgardService } from 'src/app/_services/midgard.service';
import { TransactionDTO } from 'src/app/_classes/transaction';
import { Chain } from '@xchainjs/xchain-util';

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
  user: User;
  transactions: TransactionDTO;
  activeIndex: number;

  constructor(
    // public dialogRef: MatDialogRef<PendingTxsModalComponent>,
    private explorerPathsService: ExplorerPathsService,
    private txStatusService: TransactionStatusService,
    private overlaysService: OverlaysService,
    private userService: UserService,
    private midgardService: MidgardService
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
      this.txs = txs
    });

    const user$ = this.userService.user$.subscribe(
      async (user) => {
        this.user = user;
      }
    );

    this.subs = [pendingTxs$, user$];

  }

  
  ngOnInit(): void {
    this.getThorchainTxs();
  }

  getStatus(status: string): TxStatus {
    switch (status) {
      case "success":
        return TxStatus.COMPLETE
        break;
      case "refunded":
        return TxStatus.REFUNDED
        break;
      default:
        return TxStatus.PENDING
        break;
    }
  }

  getAction(action: string): TxActions {
    switch (action) {
      case "swap":
        return TxActions.SWAP;
        break;
      case "withdraw":
        return TxActions.WITHDRAW;
        break;
      case "addLiquidity":
        return TxActions.DEPOSIT;
        break;
      case "switch":
        return TxActions.UPGRADE_RUNE;
        break;
      case "refund":
        return TxActions.REFUND;
        break;
      default:
        TxActions.SWAP;
        break;
    }
  }

  activeitem(index: number) {
    this.activeIndex = index;
  }

  transactionToTx(transactions: TransactionDTO): Tx[] {
    let txs: Tx[] = [];

    transactions.actions.forEach(transaction => {
      let inboundAsset = new Asset(transaction.in[0].coins[0].asset);
      let outbound = undefined;
      let status = this.getStatus(transaction.status);
      let action = this.getAction(transaction.type);


      if (transaction.out.length > 0 && transaction.type == 'swap') {
        const outboundAsset = new Asset(transaction.out[0].coins[0].asset);

        outbound = {
          hash: transaction.out[0].txID,
          asset: outboundAsset
        }
      }

      // ignore upgarde txs because of midgard bug (temp)
      if (action == TxActions.UPGRADE_RUNE) {
        return
      }
      
      txs.push(
        {
          chain: inboundAsset.chain,
          hash: transaction.in[0].txID,
          ticker: inboundAsset.ticker,
          status,
          action,
          isThorchainTx: inboundAsset.chain === 'THOR' ? true : false,
          symbol: inboundAsset.symbol,
          outbound
        }
      )
    });

    return txs;
  }

  async getThorchainTxs() {
    if (!this.user && !this.user.clients && !this.user.clients.thorchain)
      return

    // this.transactions = await this.user.clients.thorchain.getTransactions({
    //   address: this.user.clients.thorchain.getAddress(),
    //   limit: 10,
    // })

    this.transactions = await this.midgardService.getAddrTransactions(this.user.clients.thorchain.getAddress()).toPromise();

    this.transactionToTx(this.transactions).forEach(
      (tx) => {
        if (this.txs.find(ptx => ptx.hash.toUpperCase() === tx.hash.toUpperCase())) {
          return
        }
        this.txStatusService.addHistoryTransaction(tx)
      }
    );

    // this.txs = this.txs.filter((thing, index) => {
    //   const _thing = JSON.stringify(thing);
    //   return index === this.txs.findIndex(obj => {
    //     return JSON.stringify(obj) === _thing;
    //   });
    // });

    console.log(this.transactions);
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

      if (tx.pollThornodeDirectly) {
        return this.getViewBlockPath(tx.hash);
      }  else if (tx.pollRpc) {
        /**
         * For THOR transfers
         */
        return this.getViewBlockPath(tx.hash);
      } else {
        return this.thorchainExplorerUrl + '/' + tx.hash;
      }

    } else if (tx.chain === 'ETH') {
      return `${this.ethereumExplorerUrl}/0x${tx.hash}`;
    } else {
      return this.explorerUrl(tx.chain) + '/' + tx.hash;
    }
  }

  explorerPathAlt(hash: string, chain: Chain, externalTx?: boolean): string {
    if (externalTx)
      chain = 'THOR';

    if (chain === 'THOR') {
      return this.thorchainExplorerUrl + '/' + hash;
    } else if (chain === 'ETH') {
      return `${this.ethereumExplorerUrl}/0x${hash}`;
    } else {
      return this.explorerUrl(chain) + '/' + hash;
    }
  }

  goToExternal(url: string) {
    console.log(url)
    window.open(url, '_blank');
  }
  
  getViewBlockPath(hash): string {
    let path = `https://viewblock.io/thorchain/tx/${hash}`;
    if (environment.network === 'testnet') {
      path += '?network=testnet';
    }
    return path;
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
