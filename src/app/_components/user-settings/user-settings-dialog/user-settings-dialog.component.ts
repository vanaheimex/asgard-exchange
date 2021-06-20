import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { Asset, assetToString, BaseAmount, baseToAsset, Chain } from '@xchainjs/xchain-util';
import { combineLatest, Subscription } from 'rxjs';
import { AssetAndBalance } from 'src/app/_classes/asset-and-balance';
import { PoolDTO } from 'src/app/_classes/pool';
import { User } from 'src/app/_classes/user';
import { MainViewsEnum, OverlaysService, UserViews } from 'src/app/_services/overlays.service';
import { MidgardService } from 'src/app/_services/midgard.service';
import { TransactionStatusService } from 'src/app/_services/transaction-status.service';
import { UserService } from 'src/app/_services/user.service';
import { CoinGeckoService } from 'src/app/_services/coin-gecko.service';
import { environment } from 'src/environments/environment';
import { CurrencyService } from 'src/app/_services/currency.service';
import { Currency } from '../../account-settings/currency-converter/currency-converter.component';
import { AnalyticsService } from 'src/app/_services/analytics.service';

export interface coinLists {
  [id: string]: {
    asset: Asset;
    amount: BaseAmount
  }
}
@Component({
  selector: "app-user-settings-dialog",
  templateUrl: "./user-settings-dialog.component.html",
  styleUrls: ["./user-settings-dialog.component.scss"],
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
  mode:
    | "ADDRESSES"
    | "ADDRESS"
    | "PENDING_TXS"
    | "ASSET"
    | "SEND"
    | "CONFIRM_SEND"
    | "UPGRADE_RUNE"
    | "CONFIRM_UPGRADE_RUNE"
    | "VIEW_PHRASE"
    | "DEPOSIT"
    | "CONFIRM_DEPOSIT"
    | "ADDRESS_ADD_TOKEN"
    | "PROCESSING"
    | "SUCCESS"
    | "CONFIRM_SEND"
    | "ERROR";
  selectedAddress: string;
  selectedChain: Chain;
  selectedAsset: AssetAndBalance;
  amountToSend: number;
  recipient: string;
  memo: string;
  path: Array<any>;
  message: string = "select";

  userView: UserViews;

  @Input() userSetting: boolean;
  pools: PoolDTO[];
  chainUsdValue: { [chain: string]: { value: number, tokens: string[] } } = {};
  isTestnet: boolean;
  currecny: Currency

  constructor(
    private userService: UserService,
    private txStatusService: TransactionStatusService,
    private overlaysService: OverlaysService,
    private midgardService: MidgardService,
    private transactionStatusService: TransactionStatusService,
    private cgService: CoinGeckoService,
    private currencyService: CurrencyService,
    private analytics: AnalyticsService
  ) {
    this.pools = [];
    this.pendingTxCount = 0;
    this.mode = 'ADDRESSES';
    this.isTestnet = environment.network === 'testnet' ? true : false;

    this.selectedAsset = null;
    this.selectedChain = null;

    const user$ = this.userService.user$.subscribe(async (user) => {
      if (user) {
        this.loading = true;

        this.user = user;

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
    });

    const txs$ = this.txStatusService.txs$.subscribe((_) => {
      this.pendingTxCount = this.txStatusService.getPendingTxCount();
    });

    const overlay$ = this.overlaysService.innerUserView.subscribe((val) => {
      this.userView = val.userView;
      this.selectedAddress = val.address;
      this.selectedChain = val.chain;
      this.selectedAsset = val.asset;

    });

    this.subs = [user$, txs$, overlay$];

    // this.path = this.getPath();
  }

  setMode(
    val: UserViews,
    address?: string,
    chain?: Chain,
    asset?: AssetAndBalance
  ) {
    this.overlaysService.setCurrentUserView({
      userView: val,
      address: address === undefined ? this.selectedAddress : address,
      chain: chain === undefined ? this.selectedChain : chain,
      asset: asset === undefined ? this.selectedAsset : asset,
    });
  }

  ngOnInit(): void {
    this.getPools();
    this.getBalances();

    this.currencyService.cur$.subscribe(
      (cur) => {
        this.currecny = cur;
      }
    )
  }

  getPools() {
    this.midgardService.getPools().subscribe( 
    (res) => {
      this.pools = res;
    });
  }

  async getBalances() {
    const list = await this.cgService.getCoinList().toPromise(); 

    // balance will be triggered multiple time even on one chain
    let ids: coinLists = {};
    const balances$ = this.userService.userBalances$;
    const pendingBalances$ = this.userService.pendingBalances$;

    const combined = combineLatest([balances$, pendingBalances$]);
    
    const sub = combined.subscribe(
      ([balances, pendingBalances]) => {
        if (!pendingBalances) {
          balances.forEach(
            (balance) => {
              let id = this.cgService.getCoinIdBySymbol(balance.asset.ticker, list);
              if (!ids[id]) {
                ids[id] = {
                  asset: balance.asset,
                  amount: balance.amount
                }
              }
            }
          )

          this.cgService.getCurrencyConversion(Object.keys(ids).join(',')).subscribe(
            (cnPrice) => {
              Object.keys(cnPrice).forEach(
                (ca) => {
                  let {asset, amount} = ids[ca];
                  if (this.chainUsdValue[asset.chain] && !this.chainUsdValue[asset.chain].tokens.includes(asset.ticker)) {
                    this.chainUsdValue[asset.chain].tokens = [...this.chainUsdValue[asset.chain].tokens, asset.ticker];
                    this.chainUsdValue[asset.chain].value += cnPrice[ca].usd * baseToAsset(amount).amount().toNumber();
                  }
                  else if(!this.chainUsdValue[asset.chain]) {
                    this.chainUsdValue[asset.chain] = {
                      value: cnPrice[ca].usd * baseToAsset(amount).amount().toNumber(),
                      tokens: [asset.ticker]
                    }
                  }
                }
              )
            }
          )
        }
      }
    );

    this.subs.push(sub);
  }

  breadcrumbNav(val: string) {
    if (val === 'swap') {
      this.analytics.event('wallet_select', 'breadcrumb_skip');
      this.overlaysService.setViews(MainViewsEnum.Swap, "Swap");
    }
  }

  selectAddress(address: string, chain: Chain) {
    this.selectedAddress = address;
    this.selectedChain = chain;
    this.analytics.event('wallet_select', 'option_selected_*WALLET*', undefined, chain);
    this.mode = "ADDRESS";
    this.setMode("Address", address, chain);
  }

  clearSelectedAddress() {
    this.selectedAddress = null;
    this.selectedChain = null;
    this.mode = "ADDRESSES";
    this.setMode("Addresses", null, null);
  }

  selectAsset(asset: AssetAndBalance) {
    this.selectedAsset = asset;
    this.mode = "ASSET";
    this.setMode("Asset", this.selectedAddress, this.selectedChain, asset);
  }

  changeMessage(val: string) {
    this.message = val;
  }

  confirmSend(p: { amount: number; recipientAddress: string; memo: string }) {
    this.amountToSend = p.amount;
    this.recipient = p.recipientAddress;
    this.memo = p.memo;
    this.mode = "CONFIRM_SEND";
    this.setMode("Confirm");
  }

  confirmUpgradeRune(p: { amount: number }) {
    this.amountToSend = p.amount;
    this.mode = "CONFIRM_UPGRADE_RUNE";
  }

  clearSelectedAsset() {
    this.selectedAsset = null;
    this.mode = "ADDRESS";
    this.setMode("Address", this.selectedAddress, this.selectedChain, null);
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
    this.analytics.event('wallet_select', 'button_close');
    this.overlaysService.setViews(MainViewsEnum.Swap, "Swap");
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
    if (nav === "wallet") this.clearSelectedAddress();
    else if (nav === "address") this.clearSelectedAsset();
    else if (nav === "asset") this.mode = "ASSET";
  }

  ngOnDestroy(): void {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }
  }
}
