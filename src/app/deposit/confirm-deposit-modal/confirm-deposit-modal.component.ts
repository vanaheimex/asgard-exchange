import { Component, OnInit, Inject, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { assetAmount, assetToBase, assetToString, baseAmount } from '@xchainjs/xchain-util';
import { Subscription } from 'rxjs';
import { PoolAddressDTO } from 'src/app/_classes/pool-address';
import { User } from 'src/app/_classes/user';
import { TransactionConfirmationState } from 'src/app/_const/transaction-confirmation-state';
import { MidgardService } from 'src/app/_services/midgard.service';
import { UserService } from 'src/app/_services/user.service';
import { TransactionStatusService, TxActions, TxStatus } from 'src/app/_services/transaction-status.service';
import { Client as BinanceClient } from '@xchainjs/xchain-binance';
import { Client as BitcoinClient } from '@xchainjs/xchain-bitcoin';
import { Client as EthereumClient, ETH_DECIMAL } from '@xchainjs/xchain-ethereum/lib';
import { Client as LitecoinClient } from '@xchainjs/xchain-litecoin';
import { Client as BchClient } from '@xchainjs/xchain-bitcoincash';
import { EthUtilsService } from 'src/app/_services/eth-utils.service';
import { OverlaysService } from 'src/app/_services/overlays.service';
import { Router } from '@angular/router';
import { Balances } from '@xchainjs/xchain-client';
import { AssetAndBalance } from 'src/app/_classes/asset-and-balance';

// assets should be added for asset-input as designed.
export interface ConfirmDepositData {
  asset: AssetAndBalance;
  rune: AssetAndBalance;
  assetAmount: number;
  runeAmount: number;
  user: User;
  runeBasePrice: number;
  assetBasePrice: number;
  runeBalance: number;
  assetBalance: number;
  runePrice: number;
  assetPrice: number;
  estimatedFee: number;
}

@Component({
  selector: 'app-confirm-deposit-modal',
  templateUrl: './confirm-deposit-modal.component.html',
  styleUrls: ['./confirm-deposit-modal.component.scss']
})
export class ConfirmDepositModalComponent implements OnInit, OnDestroy {

  txState: TransactionConfirmationState | 'RETRY_RUNE_DEPOSIT';
  hash: string;
  subs: Subscription[];
  error: string;
  ethNetworkFee: number;
  insufficientChainBalance: boolean;
  loading: boolean;
  estimatedMinutes: number;
  balances: Balances;

  //foe this interface it should be imported from despoit page
  @Input() data: ConfirmDepositData;
  @Output() close: EventEmitter<boolean> = new EventEmitter<boolean>();

  constructor(
    private txStatusService: TransactionStatusService,
    private midgardService: MidgardService,
    private ethUtilsService: EthUtilsService,
    private userService: UserService,
    private overlaysService: OverlaysService,
    private router: Router
  ) {
    this.loading = true;
    this.txState = TransactionConfirmationState.PENDING_CONFIRMATION;
    const user$ = this.userService.user$.subscribe(
      (user) => {
        if (!user) {
          this.closeDialog();
        }
      }
    );

    const balances$ = this.userService.userBalances$.subscribe(
      (balances) => this.balances = balances
    );

    this.subs = [user$, balances$];
  }

  ngOnInit(): void {

    this.estimateTime();

    if (this.data.asset.asset.chain === 'ETH') {
      this.estimateEthGasPrice();
    } else {
      this.loading = false;
    }

  }

  async estimateTime() {
    if (this.data.asset.asset.chain === 'ETH' && this.data.asset.asset.symbol !== 'ETH') {
      this.estimatedMinutes = await this.ethUtilsService.estimateERC20Time(assetToString(this.data.asset.asset), this.data.assetAmount);
    } else {
      this.estimatedMinutes = this.txStatusService.estimateTime(this.data.asset.asset.chain, this.data.assetAmount);
    }
  }

  submitTransaction(): void {
    this.txState = TransactionConfirmationState.SUBMITTING;

    this.midgardService.getInboundAddresses().subscribe(
      async (res) => {

        if (res && res.length > 0) {
          this.deposit(res);
        }

      }
    );
  }


  async deposit(pools: PoolAddressDTO[]) {

    const clients = this.data.user.clients;
    const asset = this.data.asset.asset;
    const thorClient = clients.thorchain;
    const thorchainAddress = await thorClient.getAddress();
    let hash = '';

    // get token address
    const address = await this.userService.getTokenAddress(this.data.user, this.data.asset.asset.chain);
    if (!address || address === '') {
      console.error('no address found');
      return;
    }

    // find recipient pool
    const recipientPool = pools.find( (pool) => pool.chain === this.data.asset.asset.chain );
    if (!recipientPool) {
      console.error('no recipient pool found');
      return;
    }

    // Deposit token
    try {

      // deposit using xchain
      switch (this.data.asset.asset.chain) {
        case 'BNB':
          const bnbClient = this.data.user.clients.binance;
          hash = await this.binanceDeposit(bnbClient, thorchainAddress, recipientPool);
          break;

        case 'BTC':
          const btcClient = this.data.user.clients.bitcoin;
          hash = await this.bitcoinDeposit(btcClient, thorchainAddress, recipientPool);
          break;

        case 'LTC':
          const ltcClient = this.data.user.clients.litecoin;
          hash = await this.litecoinDeposit(ltcClient, thorchainAddress, recipientPool);
          break;

        case 'BCH':
          const bchClient = this.data.user.clients.bitcoinCash;
          hash = await this.bchDeposit(bchClient, thorchainAddress, recipientPool);
          break;

        case 'ETH':
          const ethClient = this.data.user.clients.ethereum;
          hash = await this.ethereumDeposit(ethClient, thorchainAddress, recipientPool);
          break;

        default:
          console.error(`${this.data.asset.asset.chain} does not match`);
          return;
      }

      if (hash === '') {
        console.error('no hash set');
        return;
      }

    } catch (error) {
      console.error('error making token transfer: ', error);
      this.txState = TransactionConfirmationState.ERROR;
      this.error = error;
      return;
    }

    // deposit RUNE
    try {
      const runeMemo = `+:${asset.chain}.${asset.symbol}:${address}`;

      const runeHash = await thorClient.deposit({
        amount: assetToBase(assetAmount(this.data.runeAmount)),
        memo: runeMemo,
      });

      this.runeDepositSuccess(runeHash);

    } catch (error) {
      console.error('error making RUNE transfer: ', error);
      this.txState = 'RETRY_RUNE_DEPOSIT';
      this.error = error;
    }

  }

  runeDepositSuccess(runeHash: string) {
    this.hash = runeHash;
    this.txStatusService.addTransaction({
      chain: 'THOR',
      hash: runeHash,
      ticker: `${this.data.asset.asset.ticker}-RUNE`,
      status: TxStatus.PENDING,
      action: TxActions.DEPOSIT,
      symbol: this.data.asset.asset.symbol,
      isThorchainTx: true
    });
    this.txState = TransactionConfirmationState.SUCCESS;
  }

  async ethereumDeposit(client: EthereumClient, thorchainAddress: string, recipientPool: PoolAddressDTO) {
    try {
      const asset = this.data.asset.asset;
      const targetTokenMemo = `+:${asset.chain}.${asset.symbol}:${thorchainAddress}`;

      const decimal = await this.ethUtilsService.getAssetDecimal(this.data.asset.asset, client);
      let amount = assetToBase(assetAmount(this.data.assetAmount, decimal)).amount();

      const balanceAmount = this.userService.findRawBalance(this.balances, this.data.asset.asset);
      // const balanceAmount = assetToBase(assetAmount(this.data.asset.balance.amount(), decimal)).amount();

      if (amount.isGreaterThan(balanceAmount)) {
        amount = balanceAmount;
      }


      const hash = await this.ethUtilsService.callDeposit({
        inboundAddress: recipientPool,
        asset,
        memo: targetTokenMemo,
        amount,
        ethClient: client
      });

      return hash;
    } catch (error) {
      throw(error);
    }
  }

  async binanceDeposit(client: BinanceClient, thorchainAddress: string, recipientPool: PoolAddressDTO): Promise<string> {
    // deposit token
    try {

      const asset = this.data.asset.asset;
      const targetTokenMemo = `+:${asset.chain}.${asset.symbol}:${thorchainAddress}`;
      const hash = await client.transfer({
        asset: {
          chain: asset.chain,
          symbol: asset.symbol,
          ticker: asset.ticker
        },
        amount: assetToBase(assetAmount(this.data.assetAmount)),
        recipient: recipientPool.address,
        memo: targetTokenMemo,
      });

      return hash;
    } catch (error) {
      throw(error);
    }
  }

  async bitcoinDeposit(client: BitcoinClient, thorchainAddress: string, recipientPool: PoolAddressDTO): Promise<string> {
    // deposit token
    try {
      const asset = this.data.asset.asset;
      const targetTokenMemo = `+:${asset.chain}.${asset.symbol}:${thorchainAddress}`;

      // TODO -> consolidate this with BTC, BCH, LTC
      const balanceAmount = this.userService.findRawBalance(this.balances, this.data.asset.asset);
      const toBase = assetToBase(assetAmount(this.data.assetAmount));
      const feeToBase = assetToBase(assetAmount(this.data.estimatedFee));
      const amount = (balanceAmount
        // subtract fee
        .minus(feeToBase.amount())
        // subtract amount
        .minus(toBase.amount())
        .isGreaterThan(0))
          ? toBase.amount() // send full amount, fee can be deducted from remaining balance
          : toBase.amount().minus(feeToBase.amount()); // after deductions, not enough to process, subtract fee from amount

      if (amount.isLessThan(0)) {
        this.error = 'Insufficient funds. Try sending a smaller amount';
        this.txState = TransactionConfirmationState.ERROR;
        return;
      }
      // TODO -> consolidate this with BTC, BCH, LTC

      const hash = await client.transfer({
        asset: {
          chain: this.data.asset.asset.chain,
          symbol: this.data.asset.asset.symbol,
          ticker: this.data.asset.asset.ticker
        },
        amount: baseAmount(amount),
        recipient: recipientPool.address,
        memo: targetTokenMemo,
        feeRate: +recipientPool.gas_rate
      });

      return hash;
    } catch (error) {
      throw(error);
    }
  }

  async bchDeposit(client: BchClient, thorchainAddress: string, recipientPool: PoolAddressDTO): Promise<string> {
    // deposit token
    try {
      const asset = this.data.asset.asset;
      const targetTokenMemo = `+:${asset.chain}.${asset.symbol}:${thorchainAddress}`;

      // TODO -> consolidate this with BTC, BCH, LTC
      const balanceAmount = this.userService.findRawBalance(this.balances, this.data.asset.asset);
      const toBase = assetToBase(assetAmount(this.data.assetAmount));
      const feeToBase = assetToBase(assetAmount(this.data.estimatedFee));
      const amount = (balanceAmount
        // subtract fee
        .minus(feeToBase.amount())
        // subtract amount
        .minus(toBase.amount())
        .isGreaterThan(0))
          ? toBase.amount() // send full amount, fee can be deducted from remaining balance
          : toBase.amount().minus(feeToBase.amount()); // after deductions, not enough to process, subtract fee from amount

      if (amount.isLessThan(0)) {
        this.error = 'Insufficient funds. Try sending a smaller amount';
        this.txState = TransactionConfirmationState.ERROR;
        return;
      }
      // TODO -> consolidate this with BTC, BCH, LTC

      const hash = await client.transfer({
        asset: {
          chain: this.data.asset.asset.chain,
          symbol: this.data.asset.asset.symbol,
          ticker: this.data.asset.asset.ticker
        },
        amount: baseAmount(amount),
        recipient: recipientPool.address,
        memo: targetTokenMemo,
        feeRate: +recipientPool.gas_rate
      });

      return hash;
    } catch (error) {
      throw(error);
    }
  }

  async litecoinDeposit(client: LitecoinClient, thorchainAddress: string, recipientPool: PoolAddressDTO): Promise<string> {
    // deposit token
    try {
      const asset = this.data.asset.asset;
      const targetTokenMemo = `+:${asset.chain}.${asset.symbol}:${thorchainAddress}`;

      // TODO -> consolidate this with BTC, BCH, LTC
      const balanceAmount = this.userService.findRawBalance(this.balances, this.data.asset.asset);
      const toBase = assetToBase(assetAmount(this.data.assetAmount));
      const feeToBase = assetToBase(assetAmount(this.data.estimatedFee));
      const amount = (balanceAmount
        // subtract fee
        .minus(feeToBase.amount())
        // subtract amount
        .minus(toBase.amount())
        .isGreaterThan(0))
          ? toBase.amount() // send full amount, fee can be deducted from remaining balance
          : toBase.amount().minus(feeToBase.amount()); // after deductions, not enough to process, subtract fee from amount

      if (amount.isLessThan(0)) {
        this.error = 'Insufficient funds. Try sending a smaller amount';
        this.txState = TransactionConfirmationState.ERROR;
        return;
      }
      // TODO -> consolidate this with BTC, BCH, LTC

      const hash = await client.transfer({
        asset: {
          chain: this.data.asset.asset.chain,
          symbol: this.data.asset.asset.symbol,
          ticker: this.data.asset.asset.ticker
        },
        amount: baseAmount(amount),
        recipient: recipientPool.address,
        memo: targetTokenMemo,
        feeRate: +recipientPool.gas_rate
      });

      return hash;
    } catch (error) {
      throw(error);
    }
  }

  async estimateEthGasPrice() {

    const user = this.data.user;
    const sourceAsset = this.data.asset.asset;

    if (user && user.clients && user.clients.ethereum && user.clients.thorchain) {
      const ethClient = user.clients.ethereum;
      const thorClient = user.clients.thorchain;
      const thorchainAddress = await thorClient.getAddress();
      const ethBalances = await ethClient.getBalance();
      const ethBalance = ethBalances[0];

      // get inbound addresses
      this.midgardService.getInboundAddresses().subscribe(
        async (addresses) => {

          const ethInbound = addresses.find( (inbound) => inbound.chain === 'ETH' );
          const decimal = await this.ethUtilsService.getAssetDecimal(this.data.asset.asset, ethClient);
          let amount = assetToBase(assetAmount(this.data.assetAmount, decimal)).amount();
          const balanceAmount = this.userService.findRawBalance(this.balances, this.data.asset.asset);

          if (amount.isGreaterThan(balanceAmount)) {
            amount = balanceAmount;
          }

          const estimatedFeeWei = await this.ethUtilsService.estimateFee({
            sourceAsset,
            ethClient,
            ethInbound,
            inputAmount: amount,
            memo: `+:${sourceAsset.chain}.${sourceAsset.symbol}:${thorchainAddress}`
          });

          this.ethNetworkFee = estimatedFeeWei.dividedBy(10 ** ETH_DECIMAL).toNumber();

          this.insufficientChainBalance = estimatedFeeWei.isGreaterThan(ethBalance.amount.amount());

          this.loading = false;

        }
      );

    }

  }

  goToNav(nav: string) {
    if (nav === 'pool') {
      this.router.navigate(['/', 'pool']);
    }
    else if (nav === 'swap') {
      this.router.navigate(['/', 'swap']);
    }
    else if (nav === 'deposit') {
      this.router.navigate(['/', 'deposit', `${this.data.asset.asset.chain}.${this.data.asset.asset.symbol}`])
    }
    else if (nav === 'deposit-back') {
      this.overlaysService.setCurrentDepositView('Deposit');
    }
  }

  getMessage(): string {
    if (this.error) {
      return this.error
    }
    else {
      return 'confirm'
    }
  }

  closeDialog(transactionSucess?: boolean) {
    this.close.emit(transactionSucess);
  }

  closeToPool() {
    this.router.navigate(['/', 'pool']);
  }

  ngOnDestroy() {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }
  }


}
