import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { Chain } from '@xchainjs/xchain-util';
import { Subscription } from 'rxjs';
import { AssetAndBalance } from 'src/app/_classes/asset-and-balance';
import { PoolDTO } from 'src/app/_classes/pool';
import { User } from 'src/app/_classes/user';
import { MainViewsEnum, OverlaysService, UserViews } from 'src/app/_services/overlays.service';
import { MidgardService } from 'src/app/_services/midgard.service';
import { TransactionStatusService } from 'src/app/_services/transaction-status.service';
import { UserService } from 'src/app/_services/user.service';

@Component({
  selector: 'app-user-settings-dialog',
  templateUrl: './user-settings-dialog.component.html',
  styleUrls: ['./user-settings-dialog.component.scss']
})
export class UserSettingsDialogComponent implements OnInit, OnDestroy {

  user: User;
  subs: Subscription[];
  binanceAddress: string;
  bitcoinAddress: string;
  thorAddress: string;
  ethereumAddress: string;
  litecoinAddress: string;
  bchAddress: string;
  loading: boolean;
  pendingTxCount: number;
  mode: 'ADDRESSES' | 'ADDRESS' | 'PENDING_TXS'
    | 'ASSET' | 'SEND' | 'CONFIRM_SEND' | 'UPGRADE_RUNE'
    | 'CONFIRM_UPGRADE_RUNE' | 'VIEW_PHRASE' | 'DEPOSIT' | 'CONFIRM_DEPOSIT'
    | 'ADDRESS_ADD_TOKEN' | 'PROCESSING' | 'SUCCESS' | 'CONFIRM_SEND' | 'ERROR';
  selectedAddress: string;
  selectedChain: Chain;
  selectedAsset: AssetAndBalance;
  amountToSend: number;
  recipient: string;
  path: Array<any>;
  message: string = "select";

  userView: UserViews;

  @Input() userSetting: boolean;
  pools: PoolDTO[];

  constructor(
    private userService: UserService,
    private txStatusService: TransactionStatusService,
    private overlaysService: OverlaysService,
    private midgardService: MidgardService,
    private transactionStatusService: TransactionStatusService
  ) {
    this.pools = [];
    this.pendingTxCount = 0;
    this.mode = 'ADDRESSES';

    this.selectedAsset = null;
    this.selectedChain = null;

    const user$ = this.userService.user$.subscribe(
      async (user) => {

        if (user) {

          this.loading = true;

          this.user = user;

          if (this.user.clients) {
            this.binanceAddress = await this.user.clients.binance.getAddress();
            this.bitcoinAddress = await this.user.clients.bitcoin.getAddress();
            this.thorAddress = await this.user.clients.thorchain.getAddress();
            this.ethereumAddress = await this.user.clients.ethereum.getAddress();
            this.litecoinAddress = await this.user.clients.litecoin.getAddress();
            this.bchAddress = await this.user.clients.bitcoinCash.getAddress();
          }

          this.loading = false;

        } else {
          this.pendingTxCount = 0;
        }

      }
    );

    const txs$ = this.txStatusService.txs$.subscribe( (_) => {
      this.pendingTxCount = this.txStatusService.getPendingTxCount();
    });

    const overlay$ = this.overlaysService.innerUserView.subscribe(val => {
      this.userView = val.userView;
      this.selectedAddress = val.address;
      this.selectedChain = val.chain;
      this.selectedAsset = val.asset;

      console.log('user tree is :', val);
    })

    this.subs = [user$, txs$, overlay$];

    // this.path = this.getPath();
  }

  setMode(val: UserViews, address?: string, chain?: Chain, asset?: AssetAndBalance) {
    this.overlaysService.setCurrentUserView({
        userView: val,
        address: address === undefined ? this.selectedAddress : address,
        chain: chain === undefined ? this.selectedChain : chain,
        asset: asset === undefined ? this.selectedAsset : asset
      });
  }

  ngOnInit(): void {
    this.getPools();
  }

  getPools() {
    this.midgardService.getPools().subscribe( (res) => this.pools = res );
  }

  selectAddress(address: string, chain: Chain) {
    this.selectedAddress = address;
    this.selectedChain = chain;
    this.mode = 'ADDRESS';
    this.setMode('Address', address, chain);
  }

  clearSelectedAddress() {
    this.selectedAddress = null;
    this.selectedChain = null;
    this.mode = 'ADDRESSES';
    this.setMode('Addresses', null, null);
  }

  selectAsset(asset: AssetAndBalance) {
    this.selectedAsset = asset;
    this.mode = 'ASSET';
    this.setMode('Asset', this.selectedAddress, this.selectedChain, asset);
  }

  changeMessage(val: string) {
    console.log(val)
    this.message = val;
    console.log(this.message)
  }

  confirmSend(p: {amount: number, recipientAddress: string}) {
    this.amountToSend = p.amount;
    this.recipient = p.recipientAddress;
    this.mode = 'CONFIRM_SEND';
    this.setMode('Confirm');
  }

  confirmUpgradeRune(p: {amount: number}) {
    this.amountToSend = p.amount;
    this.mode = 'CONFIRM_UPGRADE_RUNE';
    console.log(this.mode);
  }

  clearSelectedAsset() {
    this.selectedAsset = null;
    this.mode = 'ADDRESS';
    this.setMode('Address', this.selectedAddress, this.selectedChain, null)
  }

  transactionSuccessful() {
    // this.mode = 'SUCCESS';
    // this.amountToSend = null;
    // this.recipient = null;
    // this.selectedAsset = null;
    // this.selectedAddress = null;
  }

  disconnect() {
    localStorage.clear();
    this.userService.setUser(null);
    this.transactionStatusService.clearPendingTransactions();
    // this.dialogRef.close();
  }

  close() {
    this.overlaysService.setViews(MainViewsEnum.Swap, 'Swap')
  }

  // getPath() {
  //   let path : Array<any> = [{name: 'asgardex', swapView: 'Swap', mainView: 'Swap'}];

  //   // Might be in switch cases
  //   if (this.mode === 'ADDRESSES')
  //     path.push({name: 'wallet', disable: true})
  //   else if (this.mode === 'ADDRESS')
  //     path.push({name: 'wallet', call: 'wallet'}, {name: this.selectedChain, disable: true})
  //   else if (this.mode === 'ASSET')
  //     path.push({name: 'wallet', call: 'wallet'}, {name: this.selectedChain, call: 'address'}, {name: `${this.selectedChain}.${this.selectedAsset.asset.ticker}` , disable: true})
  //   else if (this.mode === 'SEND')
  //     path.push({name: 'wallet', call: 'wallet'}, {name: this.selectedChain, call: 'address'}, {name: `${this.selectedChain}.${this.selectedAsset.asset.ticker}`, call: 'asset'}, {name: 'send', disable: true})
  //   else if(this.mode === 'CONFIRM_SEND' || this.mode === 'SUCCESS' || this.mode === 'PROCESSING' || this.mode === 'ERROR')
  //     path.push({name: 'wallet', call: 'wallet'}, {name: this.selectedChain, call: 'address'}, {name: `${this.selectedChain}.${this.selectedAsset.asset.ticker}`, call: 'asset'}, {name: 'send', disable: true})
  //   return path
  // }

  navCaller(nav) {
    if (nav === 'wallet')
      this.clearSelectedAddress();
    else if (nav === 'address')
      this.clearSelectedAsset()
    else if (nav === 'asset')
      this.mode = 'ASSET'
  }

  ngOnDestroy(): void {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }
  }

}
