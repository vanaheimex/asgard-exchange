import { Component, OnInit, Inject, OnDestroy, Input, SimpleChanges, Output, EventEmitter } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { User } from 'src/app/_classes/user';
import { MidgardService } from 'src/app/_services/midgard.service';
import { UserService } from 'src/app/_services/user.service';
import { TransactionConfirmationState } from 'src/app/_const/transaction-confirmation-state';
import { PoolAddressDTO } from 'src/app/_classes/pool-address';
import { Subscription } from 'rxjs';
import { TransactionStatusService, TxActions, TxStatus } from 'src/app/_services/transaction-status.service';
import { SlippageToleranceService } from 'src/app/_services/slippage-tolerance.service';
import BigNumber from 'bignumber.js';
import { EthUtilsService } from 'src/app/_services/eth-utils.service';
import {
  baseAmount,
  assetToBase,
  assetAmount,
  Asset,
  assetToString,
} from '@xchainjs/xchain-util';
import { MainViewsEnum, OverlaysService } from 'src/app/_services/overlays.service';
import { ExplorerPathsService } from 'src/app/_services/explorer-paths.service';
import { CopyService } from 'src/app/_services/copy.service';
import { AssetAndBalance } from 'src/app/_classes/asset-and-balance';
import { Balances } from '@xchainjs/xchain-client';
import { Transaction } from 'src/app/_classes/transaction';
import { CurrencyService } from 'src/app/_services/currency.service';
import { Currency } from 'src/app/_components/account-settings/currency-converter/currency-converter.component';


export interface SwapData {
  sourceAsset: AssetAndBalance;
  targetAsset: AssetAndBalance;
  basePrice: number;
  inputValue: number;
  outputValue: BigNumber;
  user: User;
  slip: number;
  balance: number;
  runePrice: number;
  networkFeeInSource: number;
}

@Component({
  selector: 'app-confirm-swap-modal',
  templateUrl: './confirm-swap-modal.component.html',
  styleUrls: ['./confirm-swap-modal.component.scss']
})
export class ConfirmSwapModalComponent implements OnInit, OnDestroy {

  confirmationPending: boolean;
  transactionSubmitted: boolean;
  txState: TransactionConfirmationState;
  hash: string;
  subs: Subscription[];
  error: string;
  ethNetworkFee: number;
  insufficientChainBalance: boolean;
  slippageTolerance: number;
  txType: TransactionConfirmationState;

  @Input() swapData: SwapData;

  @Input() overlay: boolean;
  @Output() overlayChange = new EventEmitter<boolean>();
  @Output() closeTransaction = new EventEmitter<null>();

  binanceExplorerUrl: string;
  bitcoinExplorerUrl: string;
  ethereumExplorerUrl: string;
  thorchainExplorerUrl: string;
  estimatedMinutes: number;
  balances: Balances;
  outboundHash: string;
  currency: Currency;

  constructor(
    // @Inject(MAT_DIALOG_DATA) public swapData: SwapData,
    // public dialogRef: MatDialogRef<ConfirmSwapModalComponent>,
    private midgardService: MidgardService,
    private txStatusService: TransactionStatusService,
    private userService: UserService,
    private slipLimitService: SlippageToleranceService,
    private ethUtilsService: EthUtilsService,
    public overlaysService: OverlaysService,
    private explorerPathsService: ExplorerPathsService,
    private copyService: CopyService,
    private currencyService: CurrencyService
  ) {
    this.txState = TransactionConfirmationState.PENDING_CONFIRMATION;
    this.insufficientChainBalance = false;

    const user$ = this.userService.user$.subscribe(
      (user) => {
        if (!user) {
          this.closeDialog();
        }
      }
    );

    const slippageTolerange$ = this.slipLimitService.slippageTolerance$.subscribe(
      (limit) => this.slippageTolerance = limit
    );

    const balances$ = this.userService.userBalances$.subscribe(
      (balances) => this.balances = balances
    );

    const curs$ = this.currencyService.cur$.subscribe(
      (cur) => {
        this.currency = cur;
      }
    )

    this.subs = [user$, slippageTolerange$, balances$, curs$];

    //Adding explorer URL here
    this.binanceExplorerUrl = `${this.explorerPathsService.binanceExplorerUrl}/tx`;
    this.bitcoinExplorerUrl = `${this.explorerPathsService.bitcoinExplorerUrl}/tx`;
    this.ethereumExplorerUrl = `${this.explorerPathsService.ethereumExplorerUrl}/tx`;
    this.thorchainExplorerUrl = `${this.explorerPathsService.thorchainExplorerUrl}/txs`;

  }

  ngOnInit() {
    this.estimateTime();
  }

  ngOnChanges(changes: SimpleChanges) {
    if(changes['swapData']) {
      console.log(this.swapData);
    }
  }

  navCaller(val) {
    if (val == 'sucSwap')
      this.closeDialog(true);
  }

  goToSettings() {
    this.overlaysService.setSettingViews(MainViewsEnum.AccountSetting, 'SLIP');
  }

  async estimateTime() {
    if (this.swapData.sourceAsset.asset.chain === 'ETH' && this.swapData.sourceAsset.asset.symbol !== 'ETH') {
      this.estimatedMinutes = await this.ethUtilsService.estimateERC20Time(
        assetToString(this.swapData.sourceAsset.asset),
        this.swapData.inputValue
      );
    } else {
      this.estimatedMinutes = this.txStatusService.estimateTime(this.swapData.sourceAsset.asset.chain, this.swapData.inputValue);
    }
  }

  closeDialog(transactionSucess?: boolean) {
    // this.overlayChange.emit(!this.overlay);
    // this.dialogRef.close(transactionSucess);
    this.overlaysService.setCurrentSwapView('Swap');

    if (transactionSucess)
      this.closeTransaction.emit();
  }

  copyToClipboard(val: string) {
    this.copyService.copyToClipboard(val);
  }

  gotoWallet() {
    this.overlaysService.setCurrentView(MainViewsEnum.UserSetting)
  }

  noticeHandler(index: number) {
    if(index === 0)
      window.open("", "_blank");
  }

  submitTransaction() {

    this.txState = TransactionConfirmationState.SUBMITTING;

    // Source asset is not RUNE
    if (this.swapData.sourceAsset.asset.chain === 'BNB'
      || this.swapData.sourceAsset.asset.chain === 'BTC'
      || this.swapData.sourceAsset.asset.chain === 'ETH'
      || this.swapData.sourceAsset.asset.chain === 'LTC'
      || this.swapData.sourceAsset.asset.chain === 'BCH') {

      this.midgardService.getInboundAddresses().subscribe(
        async (res) => {

          const currentPools = res;

          if (currentPools && currentPools.length > 0) {

            const matchingPool = currentPools.find( (pool) => pool.chain === this.swapData.sourceAsset.asset.chain );

            if (matchingPool) {

              if (
                this.swapData.user.type === 'keystore' ||
                this.swapData.user.type === 'ledger' ||
                this.swapData.user.type === 'XDEFI'
              ) {
                this.keystoreTransfer(matchingPool);
              } else {
                console.log('no error type matches');
              }

            } else {
              console.log('no matching pool found');
            }

          } else {
            console.log('no current pools found...');
          }

        }
      );

    } else { // RUNE is source asset
      this.keystoreTransfer();
    }

  }

  async keystoreTransfer(matchingPool?: PoolAddressDTO) {

    const amountNumber = this.swapData.inputValue;
    const binanceClient = this.swapData.user.clients.binance;
    const bitcoinClient = this.swapData.user.clients.bitcoin;
    const thorClient = this.swapData.user.clients.thorchain;
    const ethClient = this.swapData.user.clients.ethereum;
    const litecoinClient = this.swapData.user.clients.litecoin;

    const targetAddress = this.userService.getTokenAddress(this.swapData.user, this.swapData.targetAsset.asset.chain);

    const floor = this.slipLimitService.getSlipLimitFromAmount(this.swapData.outputValue);

    const memo = this.getSwapMemo(
      this.swapData.targetAsset.asset.chain,
      this.swapData.targetAsset.asset.symbol,
      targetAddress,
      Math.floor(floor.toNumber())
    );

    if (!memo || memo === '') {
      this.error = 'Error creating tx memo';
      this.txState = TransactionConfirmationState.ERROR;
      return;
    }

    if (this.swapData.sourceAsset.asset.chain === 'THOR') {

      try {
        const hash = await thorClient.deposit({
          amount: assetToBase(assetAmount(amountNumber)),
          memo
        });

        const sourceAsset = this.swapData.sourceAsset.asset;

        this.hash = hash;
        this.txStatusService.addTransaction({
          chain: 'THOR',
          hash: this.hash,
          ticker: sourceAsset.ticker,
          status: TxStatus.PENDING,
          action: TxActions.SWAP,
          isThorchainTx: true,
          symbol: sourceAsset.symbol,
          outbound: {
            asset: this.swapData.targetAsset.asset,
            hash: undefined
          }
        });
        this.txState = TransactionConfirmationState.SUCCESS;
      } catch (error) {
        console.error('error making transfer: ', error);
        console.error(error.stack);
        this.error = error;
        this.txState = TransactionConfirmationState.ERROR;
      }

    } else if (this.swapData.sourceAsset.asset.chain === 'BNB') {

      try {
        const hash = await binanceClient.transfer({
          asset: this.swapData.sourceAsset.asset,
          amount: assetToBase(assetAmount(amountNumber)),
          recipient: matchingPool.address,
          memo
        });

        const sourceAsset = this.swapData.sourceAsset.asset;

        this.hash = hash;
        this.pushTxStatus(hash, sourceAsset);
        this.txState = TransactionConfirmationState.SUCCESS;
      } catch (error) {
        console.error('error making transfer: ', error);
        this.error = error;
        this.txState = TransactionConfirmationState.ERROR;
      }

    } else if (this.swapData.sourceAsset.asset.chain === 'BTC') {

      try {

        // TODO -> consolidate this with BTC, BCH, LTC
        const balanceAmount = this.userService.findRawBalance(this.balances, this.swapData.sourceAsset.asset);
        const toBase = assetToBase(assetAmount(amountNumber));
        const feeToBase = assetToBase(assetAmount(this.swapData.networkFeeInSource));
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


        const sourceAsset = this.swapData.sourceAsset.asset;


        const hash = await bitcoinClient.transfer({
          amount: baseAmount(amount),
          recipient: matchingPool.address,
          memo,
          feeRate: +matchingPool.gas_rate
        });

        this.hash = hash;
        this.pushTxStatus(hash, sourceAsset);
        this.txState = TransactionConfirmationState.SUCCESS;
      } catch (error) {
        console.error('error making transfer: ', error);
        this.error = error;
        this.txState = TransactionConfirmationState.ERROR;
      }

    } else if (this.swapData.sourceAsset.asset.chain === 'ETH') {

      try {

        const sourceAsset = this.swapData.sourceAsset.asset;
        const targetAsset = this.swapData.targetAsset.asset;

        // temporarily drops slip limit until mainnet
        const ethMemo = `=:${targetAsset.chain}.${targetAsset.symbol}:${targetAddress}`;

        const decimal = await this.ethUtilsService.getAssetDecimal(this.swapData.sourceAsset.asset, ethClient);
        let amount = assetToBase(assetAmount(this.swapData.inputValue, decimal)).amount();
        const balanceAmount = this.userService.findRawBalance(this.balances, this.swapData.sourceAsset.asset);

        if (amount.isGreaterThan(balanceAmount)) {
          amount = balanceAmount;
        }

        const hash = await this.ethUtilsService.callDeposit({
          inboundAddress: matchingPool,
          asset: sourceAsset,
          memo: ethMemo,
          amount,
          ethClient
        });

        this.hash = hash.substr(2);
        this.pushTxStatus(hash, this.swapData.sourceAsset.asset);
        this.txState = TransactionConfirmationState.SUCCESS;
      } catch (error) {
        console.error('error making transfer: ', error);
        console.error(error.stack);
        this.error = 'ETH swap failed. Please try again using a smaller amount.';
        this.txState = TransactionConfirmationState.ERROR;
      }

    } else if (this.swapData.sourceAsset.asset.chain === 'LTC') {

      try {

        // TODO -> consolidate this with BTC, BCH, LTC
        const balanceAmount = this.userService.findRawBalance(this.balances, this.swapData.sourceAsset.asset);
        const toBase = assetToBase(assetAmount(amountNumber));
        const feeToBase = assetToBase(assetAmount(this.swapData.networkFeeInSource));
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

        const sourceAsset = this.swapData.sourceAsset.asset;

        const hash = await litecoinClient.transfer({
          amount: baseAmount(amount),
          recipient: matchingPool.address,
          memo,
          feeRate: +matchingPool.gas_rate
        });

        this.hash = hash;
        this.pushTxStatus(hash, sourceAsset);
        this.txState = TransactionConfirmationState.SUCCESS;
      } catch (error) {
        console.error('error making transfer: ', error);
        this.error = error;
        this.txState = TransactionConfirmationState.ERROR;
      }

    } else if (this.swapData.sourceAsset.asset.chain === 'BCH') {

      try {
        const bchClient = this.swapData.user.clients.bitcoinCash;

        // TODO -> consolidate this with BTC, BCH, LTC
        const balanceAmount = this.userService.findRawBalance(this.balances, this.swapData.sourceAsset.asset);
        const toBase = assetToBase(assetAmount(amountNumber));
        const feeToBase = assetToBase(assetAmount(this.swapData.networkFeeInSource));
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
        // end TODO

        const sourceAsset = this.swapData.sourceAsset.asset;

        const hash = await bchClient.transfer({
          amount: baseAmount(amount),
          recipient: matchingPool.address,
          memo,
          feeRate: +matchingPool.gas_rate
        });

        this.hash = hash;
        this.pushTxStatus(hash, sourceAsset);
        this.txState = TransactionConfirmationState.SUCCESS;
      } catch (error) {
        console.error('error making transfer: ', error);
        this.error = error;
        this.txState = TransactionConfirmationState.ERROR;
      }

    }

    const outbound$ = this.txStatusService.getOutboundHash(this.hash).subscribe(
      (res: Transaction) => {
        this.outboundHash = res.out[0]?.txID;

        if (!this.outboundHash && res.status == 'success') {
          this.outboundHash = 'success';
        }

        console.log(res);
      }
    );

    this.subs.push(outbound$);
  }

  pushTxStatus(hash: string, asset: Asset) {
    this.txStatusService.addTransaction({
      chain: asset.chain,
      ticker: asset.ticker,
      status: TxStatus.PENDING,
      action: TxActions.SWAP,
      isThorchainTx: true,
      symbol: asset.symbol,
      hash,
      outbound: {
        asset: this.swapData.targetAsset.asset,
        hash: undefined
      }
    });
  }

  getSwapMemo(chain: string, symbol: string, addr: string, sliplimit: number): string {

    const tag = (this.swapData.user && this.swapData.user.type && this.swapData.user.type === 'XDEFI')
      ? '333'
      : '444';

    if (sliplimit && sliplimit.toString().length > 3) {
      const taggedSlip = sliplimit.toString().slice(0, sliplimit.toString().length - 3) + tag;
      return `=:${chain}.${symbol}:${addr}:${taggedSlip}`;
    } else {
      return `=:${chain}.${symbol}:${addr}:${sliplimit}`;
    }
  }

  ngOnDestroy(): void {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }
  }

}
