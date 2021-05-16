import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { baseAmount, baseToAsset, Chain } from '@xchainjs/xchain-util';
import { AssetAndBalance } from 'src/app/_classes/asset-and-balance';
import { CopyService } from 'src/app/_services/copy.service';
import { ExplorerPathsService } from 'src/app/_services/explorer-paths.service';
import BigNumber from 'bignumber.js';
import { UserService } from 'src/app/_services/user.service';
import { Balances } from '@xchainjs/xchain-client';
import { Subscription } from 'rxjs';
import { environment } from 'src/environments/environment';


@Component({
  selector: 'app-transaction-success-modal',
  templateUrl: './transaction-success-modal.component.html',
  styleUrls: ['./transaction-success-modal.component.scss'],
})
export class TransactionSuccessModalComponent {
  @Input() chain: Chain;
  @Input() hash: string;
  // @Input() tx: Tx;
  // @Input() label: string;
  @Input() externalTx: boolean = false; // not Thorchain
  @Output() closeDialog: EventEmitter<null>;

  //added by the new reskin
  @Input() isSending: boolean = false;
  @Input() isWithdraw: boolean = false;
  @Input() asset: Array<AssetAndBalance>;
  @Input() label: Array<string>;
  @Input() amount: Array<number | BigNumber>;
  @Input() recipientAddress: string;
  @Input() percentage: number;
  @Input() isPlus: boolean = false;
  @Input() hasOutbound: boolean = false;
  @Input() hashOutbound: string = '';

  binanceExplorerUrl: string;
  bitcoinExplorerUrl: string;
  ethereumExplorerUrl: string;
  thorchainExplorerUrl: string;
  litecoinExplorerUrl: string;
  bchExplorerUrl: string;
  balances: Balances;
  sourceBalance: number;
  targetBalance: number;
  subs: Subscription[];
  copied: boolean = false;
  copiedOutbound: boolean = false;


  constructor(private explorerPathsService: ExplorerPathsService, private copyService: CopyService, private userService: UserService) {

    this.closeDialog = new EventEmitter<null>();
    this.binanceExplorerUrl = `${this.explorerPathsService.binanceExplorerUrl}/tx`;
    this.bitcoinExplorerUrl = `${this.explorerPathsService.bitcoinExplorerUrl}/tx`;
    this.ethereumExplorerUrl = `${this.explorerPathsService.ethereumExplorerUrl}/tx`;
    this.thorchainExplorerUrl = `${this.explorerPathsService.thorchainExplorerUrl}/txs`;
    this.litecoinExplorerUrl = `${this.explorerPathsService.litecoinExplorerUrl}`;
    this.bchExplorerUrl = `${this.explorerPathsService.bchExplorerUrl}/tx`;

  }

  copyToClipboard(val?: string, copyOutbound?: boolean) {
    let result
    if (val)
      result = this.copyService.copyToClipboard(this.asset[1].asset.chain === 'ETH' ? '0x' + val : val);
    else
      result = this.copyService.copyToClipboard(this.chain === 'ETH' ? '0x' + this.hash : this.hash);

    if (result) {
      if(copyOutbound) {
        this.copiedOutbound = true;
        setTimeout(
          () => {
            this.copiedOutbound = false;
          }
        , 3000)
      }
      else {
        this.copied = true;
        setTimeout(
          () => {
            this.copied = false;
          }
        , 3000)
      }
    }
  }

  explorerPath(hash: string = this.hash, chain: Chain = this.chain): string {
    if (this.externalTx)
      chain = 'THOR';

    if (chain === 'THOR') {
      return this.thorchainExplorerUrl + '/' + hash;
    } else if (chain === 'ETH') {
      return `${this.ethereumExplorerUrl}/0x${hash}`;
    } else {
      return this.explorerUrl(chain) + '/' + hash;
    }
  }

  viewBlockPath(hash: string): string {
    let path = `https://viewblock.io/thorchain/tx/${hash}`;
    if (environment.network === 'testnet') {
      path += '?network=testnet';
    }
    return path;
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

  ngOnInit(): void {
    if (this.amount[1] && !(this.amount[1] instanceof Number)) {
      this.amount[1] = Number(this.amount[1].toPrecision());
    }

    //get balance of the new
    this.asset.forEach((asset) => {
      this.userService.fetchBalance(asset.asset.chain)
    })

    const balances$ = this.userService.userBalances$.subscribe(
      (balances) => {
        if (balances) {
          this.balances = balances;
          this.sourceBalance = this.userService.findBalance(this.balances, this.asset[0].asset);
          if (this.asset[1]) {
            this.targetBalance = this.userService.findBalance(this.balances, this.asset[1].asset);
          }
        }
      }
    );

    this.subs = [balances$]
  }

  ngOnDestroy(): void {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }
  }

}
