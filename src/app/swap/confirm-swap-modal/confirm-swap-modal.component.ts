import {
  Component,
  OnInit,
  Inject,
  OnDestroy,
  Input,
  SimpleChanges,
  Output,
  EventEmitter,
} from "@angular/core";
import { MAT_DIALOG_DATA, MatDialogRef } from "@angular/material/dialog";
import { User } from "src/app/_classes/user";
import { MidgardService } from "src/app/_services/midgard.service";
import { UserService } from "src/app/_services/user.service";
import { TransactionConfirmationState } from "src/app/_const/transaction-confirmation-state";
import { PoolAddressDTO } from "src/app/_classes/pool-address";
import { Subscription } from "rxjs";
import {
  TransactionStatusService,
  TxActions,
  TxStatus,
} from "src/app/_services/transaction-status.service";
import { SlippageToleranceService } from "src/app/_services/slippage-tolerance.service";
import BigNumber from "bignumber.js";
import { EthUtilsService } from "src/app/_services/eth-utils.service";
import {
  baseAmount,
  assetToBase,
  assetAmount,
  Asset,
  assetToString,
} from "@xchainjs/xchain-util";
import {
  MainViewsEnum,
  OverlaysService,
} from "src/app/_services/overlays.service";
import { ExplorerPathsService } from "src/app/_services/explorer-paths.service";
import { CopyService } from "src/app/_services/copy.service";
import { AssetAndBalance } from "src/app/_classes/asset-and-balance";
import { Balances } from "@xchainjs/xchain-client";
import { Transaction } from "src/app/_classes/transaction";
import { CurrencyService } from "src/app/_services/currency.service";
import { Currency } from "src/app/_components/account-settings/currency-converter/currency-converter.component";
import { AnalyticsService, assetString } from 'src/app/_services/analytics.service';
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
  targetAddress: string;
}

@Component({
  selector: "app-confirm-swap-modal",
  templateUrl: "./confirm-swap-modal.component.html",
  styleUrls: ["./confirm-swap-modal.component.scss"],
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
  isDoubleSwap: boolean = false;

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
    private currencyService: CurrencyService,
    private analytics: AnalyticsService
  ) {
    this.txState = TransactionConfirmationState.PENDING_CONFIRMATION;
    this.insufficientChainBalance = false;

    const user$ = this.userService.user$.subscribe((user) => {
      if (!user) {
        this.closeDialog();
      }
    });

    const slippageTolerange$ =
      this.slipLimitService.slippageTolerance$.subscribe(
        (limit) => (this.slippageTolerance = limit)
      );

    const balances$ = this.userService.userBalances$.subscribe(
      (balances) => (this.balances = balances)
    );

    const curs$ = this.currencyService.cur$.subscribe((cur) => {
      this.currency = cur;
    });

    this.subs = [user$, slippageTolerange$, balances$, curs$];

    //Adding explorer URL here
    this.binanceExplorerUrl = `${this.explorerPathsService.binanceExplorerUrl}/tx`;
    this.bitcoinExplorerUrl = `${this.explorerPathsService.bitcoinExplorerUrl}/tx`;
    this.ethereumExplorerUrl = `${this.explorerPathsService.ethereumExplorerUrl}/tx`;
    this.thorchainExplorerUrl = `${this.explorerPathsService.thorchainExplorerUrl}/txs`;
  }

  ngOnInit() {
    this.estimateTime();

    this.isDoubleSwap =
      this.isRune(this.swapData.targetAsset.asset)
        ? false
        : true;
  }

  isRune(asset: Asset): boolean {
    return asset && asset.ticker === "RUNE"; // covers BNB and native
  }

  navCaller(val) {
    if (val == "sucSwap") this.closeDialog(true);
  }

  goToSettings() {
    this.overlaysService.setSettingViews(MainViewsEnum.AccountSetting, "SLIP");
  }

  async estimateTime() {
    if (
      this.swapData.sourceAsset.asset.chain === "ETH" &&
      this.swapData.sourceAsset.asset.symbol !== "ETH"
    ) {
      this.estimatedMinutes = await this.ethUtilsService.estimateERC20Time(
        assetToString(this.swapData.sourceAsset.asset),
        this.swapData.inputValue
      );
    } else {
      this.estimatedMinutes = this.txStatusService.estimateTime(
        this.swapData.sourceAsset.asset.chain,
        this.swapData.inputValue
      );
    }
  }

  closeDialog(transactionSucess?: boolean) {
    this.overlaysService.setCurrentSwapView("Swap");

    if (transactionSucess === false) {
      this.analytics.event('swap_confirm', "button_swap_cancel_*FROM_ASSET*_*TO_ASSET*_usd_*numerical_usd_value*", this.swapData.inputValue * this.swapData.sourceAsset.assetPriceUSD, assetString(this.swapData.sourceAsset.asset), assetString(this.swapData.targetAsset.asset), (this.swapData.inputValue * this.swapData.sourceAsset.assetPriceUSD).toString());
      if (this.userService.getAdrressChain(this.swapData.targetAsset.asset.chain) !== this.swapData.targetAddress)
        this.analytics.event('swap_confirm', "button_swap_cancel_*FROM_ASSET*_*TO_ASSET*_target_address", undefined, assetString(this.swapData.sourceAsset.asset), assetString(this.swapData.targetAsset.asset));
      this.analytics.event('swap_confirm', "button_swap_cancel_*FROM_ASSET*_*TO_ASSET*_slip_%_*numerical_%_value*", this.swapData.slip * 100, assetString(this.swapData.sourceAsset.asset), assetString(this.swapData.targetAsset.asset), (this.swapData.slip * 100).toString());
      
      let feeAmountUSD = this.swapData.sourceAsset.assetPriceUSD * this.swapData.networkFeeInSource
      this.analytics.event('swap_confirm', `button_swap_cancel_*FROM_ASSET*_*TO_ASSET*_fee_usd_*numerical_usd_value*`, feeAmountUSD, assetString(this.swapData.sourceAsset.asset), assetString(this.swapData.targetAsset.asset), (feeAmountUSD).toString());
  
    }

    if (transactionSucess) this.closeTransaction.emit();
  }

  copyToClipboard(val: string) {
    this.copyService.copyToClipboard(val);
  }

  gotoWallet() {
    this.overlaysService.setCurrentView(MainViewsEnum.UserSetting);
  }

  noticeHandler(index: number) {
    if (index === 0) window.open("", "_blank");
  }

  submitTransaction() {
    this.txState = TransactionConfirmationState.SUBMITTING;
    this.analytics.event('swap_confirm', "button_swap_confirm_*FROM_ASSET*_*TO_ASSET*_usd_*numerical_usd_value*", this.swapData.inputValue * this.swapData.sourceAsset.assetPriceUSD, assetString(this.swapData.sourceAsset.asset), assetString(this.swapData.targetAsset.asset), (this.swapData.inputValue * this.swapData.sourceAsset.assetPriceUSD).toString());
    if (this.userService.getAdrressChain(this.swapData.targetAsset.asset.chain) !== this.swapData.targetAddress)
      this.analytics.event('swap_confirm', "button_swap_confirm_*FROM_ASSET*_*TO_ASSET*_target_address", undefined, assetString(this.swapData.sourceAsset.asset), assetString(this.swapData.targetAsset.asset));
    this.analytics.event('swap_confirm', "button_swap_confirm_*FROM_ASSET*_*TO_ASSET*_slip_%_*numerical_%_value*", this.swapData.slip * 100, assetString(this.swapData.sourceAsset.asset), assetString(this.swapData.targetAsset.asset), (this.swapData.slip * 100).toString());
    
    let feeAmountUSD = this.swapData.sourceAsset.assetPriceUSD * this.swapData.networkFeeInSource
    this.analytics.event('swap_confirm', `button_swap_confirm_*FROM_ASSET*_*TO_ASSET*_fee_usd_*numerical_usd_value*`, feeAmountUSD, assetString(this.swapData.sourceAsset.asset), assetString(this.swapData.targetAsset.asset), (feeAmountUSD).toString());

    // Source asset is not RUNE
    if (
      this.swapData.sourceAsset.asset.chain === "BNB" ||
      this.swapData.sourceAsset.asset.chain === "BTC" ||
      this.swapData.sourceAsset.asset.chain === "ETH" ||
      this.swapData.sourceAsset.asset.chain === "LTC" ||
      this.swapData.sourceAsset.asset.chain === "BCH"
    ) {
      this.midgardService.getInboundAddresses().subscribe(async (res) => {
        const currentPools = res;

        if (currentPools && currentPools.length > 0) {
          const matchingPool = currentPools.find(
            (pool) => pool.chain === this.swapData.sourceAsset.asset.chain
          );

          if (matchingPool) {
            if (
              this.swapData.user.type === "keystore" ||
              this.swapData.user.type === "ledger" ||
              this.swapData.user.type === "XDEFI"
            ) {
              this.keystoreTransfer(matchingPool);
            } else {
              console.log("no error type matches");
            }
          } else {
            console.log("no matching pool found");
          }
        } else {
          console.log("no current pools found...");
        }
      });
    } else {
      // RUNE is source asset
      this.keystoreTransfer();
    }
  }

  validateTargetAddress(): boolean {
    const client = this.userService.getChainClient(
      this.swapData.user,
      this.swapData.targetAsset.asset.chain
    );
    if (!client) {
      return false;
    }

    return client.validateAddress(this.swapData.targetAddress);
  }

  async keystoreTransfer(matchingPool?: PoolAddressDTO) {
    const amountNumber = this.swapData.inputValue;
    const binanceClient = this.swapData.user.clients.binance;
    const bitcoinClient = this.swapData.user.clients.bitcoin;
    const thorClient = this.swapData.user.clients.thorchain;
    const ethClient = this.swapData.user.clients.ethereum;
    const litecoinClient = this.swapData.user.clients.litecoin;

    const floor = this.slipLimitService.getSlipLimitFromAmount(
      this.swapData.outputValue
    );

    const memo = this.getSwapMemo(
      this.swapData.targetAsset.asset.chain,
      this.swapData.targetAsset.asset.symbol,
      this.swapData.targetAddress,
      Math.floor(floor.toNumber())
    );

    if (!memo || memo === "") {
      this.error = "Error creating tx memo";
      this.txState = TransactionConfirmationState.ERROR;
      return;
    }

    if (!this.validateTargetAddress()) {
      this.error = `Invalid ${this.swapData.targetAsset.asset.chain} Address`;
      this.txState = TransactionConfirmationState.ERROR;
      return;
    }

    if (this.swapData.sourceAsset.asset.chain === 'THOR') {
      try {
        const hash = await thorClient.deposit({
          amount: assetToBase(assetAmount(amountNumber)),
          memo,
        });

        const sourceAsset = this.swapData.sourceAsset.asset;

        this.hash = hash;
        this.txStatusService.addTransaction({
          chain: "THOR",
          hash: this.hash,
          ticker: sourceAsset.ticker,
          status: TxStatus.PENDING,
          action: TxActions.SWAP,
          isThorchainTx: true,
          symbol: sourceAsset.symbol,
          outbound: {
            asset: this.swapData.targetAsset.asset,
            hash: undefined,
          },
        });
        this.getOutboundHash(hash);
        this.txState = TransactionConfirmationState.SUCCESS;
      } catch (error) {
        console.error("error making transfer: ", error);
        console.error(error.stack);
        this.error = error;
        this.txState = TransactionConfirmationState.ERROR;
      }
    } else if (this.swapData.sourceAsset.asset.chain === "BNB") {
      try {
        const hash = await binanceClient.transfer({
          asset: this.swapData.sourceAsset.asset,
          amount: assetToBase(assetAmount(amountNumber)),
          recipient: matchingPool.address,
          memo,
        });

        const sourceAsset = this.swapData.sourceAsset.asset;

        this.hash = hash;
        this.pushTxStatus(hash, sourceAsset);
        this.txState = TransactionConfirmationState.SUCCESS;
      } catch (error) {
        console.error("error making transfer: ", error);
        this.error = error;
        this.txState = TransactionConfirmationState.ERROR;
      }
    } else if (this.swapData.sourceAsset.asset.chain === "BTC") {
      try {
        // TODO -> consolidate this with BTC, BCH, LTC
        const balanceAmount = this.userService.findRawBalance(
          this.balances,
          this.swapData.sourceAsset.asset
        );
        const toBase = assetToBase(assetAmount(amountNumber));
        const feeToBase = assetToBase(
          assetAmount(this.swapData.networkFeeInSource)
        );
        const amount = balanceAmount
          // subtract fee
          .minus(feeToBase.amount())
          // subtract amount
          .minus(toBase.amount())
          .isGreaterThan(0)
          ? toBase.amount() // send full amount, fee can be deducted from remaining balance
          : toBase.amount().minus(feeToBase.amount()); // after deductions, not enough to process, subtract fee from amount

        if (amount.isLessThan(0)) {
          this.error = "Insufficient funds. Try sending a smaller amount";
          this.txState = TransactionConfirmationState.ERROR;
          return;
        }
        // TODO -> consolidate this with BTC, BCH, LTC

        if (memo.length > 80) {
          this.error =
            "Memo exceeds 80. Report to https://github.com/asgardex/asgard-exchange/issues.";
          this.txState = TransactionConfirmationState.ERROR;
          return;
        }

        const sourceAsset = this.swapData.sourceAsset.asset;

        const hash = await bitcoinClient.transfer({
          amount: baseAmount(amount),
          recipient: matchingPool.address,
          memo,
          feeRate: +matchingPool.gas_rate,
        });

        this.hash = hash;
        this.pushTxStatus(hash, sourceAsset);
        this.txState = TransactionConfirmationState.SUCCESS;
      } catch (error) {
        console.error("error making transfer: ", error);
        this.error = error;
        this.txState = TransactionConfirmationState.ERROR;
      }
    } else if (this.swapData.sourceAsset.asset.chain === "ETH") {
      try {
        const sourceAsset = this.swapData.sourceAsset.asset;
        const targetAsset = this.swapData.targetAsset.asset;

        const decimal = await this.ethUtilsService.getAssetDecimal(
          this.swapData.sourceAsset.asset,
          ethClient
        );
        let amount = assetToBase(
          assetAmount(this.swapData.inputValue, decimal)
        ).amount();
        const balanceAmount = this.userService.findRawBalance(
          this.balances,
          this.swapData.sourceAsset.asset
        );

        if (amount.isGreaterThan(balanceAmount)) {
          amount = balanceAmount;
        }

        const hash = await this.ethUtilsService.callDeposit({
          inboundAddress: matchingPool,
          asset: sourceAsset,
          memo: memo,
          amount,
          ethClient,
        });

        this.hash = hash.substr(2);
        this.pushTxStatus(hash, this.swapData.sourceAsset.asset);
        this.txState = TransactionConfirmationState.SUCCESS;
      } catch (error) {
        console.error("error making transfer: ", error);
        console.error(error.stack);
        this.error =
          "ETH swap failed. Please try again using a smaller amount.";
        this.txState = TransactionConfirmationState.ERROR;
      }
    } else if (this.swapData.sourceAsset.asset.chain === "LTC") {
      try {
        // TODO -> consolidate this with BTC, BCH, LTC
        const balanceAmount = this.userService.findRawBalance(
          this.balances,
          this.swapData.sourceAsset.asset
        );
        const toBase = assetToBase(assetAmount(amountNumber));
        const feeToBase = assetToBase(
          assetAmount(this.swapData.networkFeeInSource)
        );
        const amount = balanceAmount
          // subtract fee
          .minus(feeToBase.amount())
          // subtract amount
          .minus(toBase.amount())
          .isGreaterThan(0)
          ? toBase.amount() // send full amount, fee can be deducted from remaining balance
          : toBase.amount().minus(feeToBase.amount()); // after deductions, not enough to process, subtract fee from amount

        if (amount.isLessThan(0)) {
          this.error = "Insufficient funds. Try sending a smaller amount";
          this.txState = TransactionConfirmationState.ERROR;
          return;
        }
        // TODO -> consolidate this with BTC, BCH, LTC

        const sourceAsset = this.swapData.sourceAsset.asset;
        if (memo.length > 80) {
          this.error =
            "Memo exceeds 80. Report to https://github.com/asgardex/asgard-exchange/issues.";
          this.txState = TransactionConfirmationState.ERROR;
          return;
        }

        const hash = await litecoinClient.transfer({
          amount: baseAmount(amount),
          recipient: matchingPool.address,
          memo,
          feeRate: +matchingPool.gas_rate,
        });

        this.hash = hash;
        this.pushTxStatus(hash, sourceAsset);
        this.txState = TransactionConfirmationState.SUCCESS;
      } catch (error) {
        console.error("error making transfer: ", error);
        this.error = error;
        this.txState = TransactionConfirmationState.ERROR;
      }
    } else if (this.swapData.sourceAsset.asset.chain === "BCH") {
      try {
        const bchClient = this.swapData.user.clients.bitcoinCash;

        // TODO -> consolidate this with BTC, BCH, LTC
        const balanceAmount = this.userService.findRawBalance(
          this.balances,
          this.swapData.sourceAsset.asset
        );
        const toBase = assetToBase(assetAmount(amountNumber));
        const feeToBase = assetToBase(
          assetAmount(this.swapData.networkFeeInSource)
        );
        const amount = balanceAmount
          // subtract fee
          .minus(feeToBase.amount())
          // subtract amount
          .minus(toBase.amount())
          .isGreaterThan(0)
          ? toBase.amount() // send full amount, fee can be deducted from remaining balance
          : toBase.amount().minus(feeToBase.amount()); // after deductions, not enough to process, subtract fee from amount

        if (amount.isLessThan(0)) {
          this.error = "Insufficient funds. Try sending a smaller amount";
          this.txState = TransactionConfirmationState.ERROR;
          return;
        }
        // end TODO

        const sourceAsset = this.swapData.sourceAsset.asset;

        const hash = await bchClient.transfer({
          amount: baseAmount(amount),
          recipient: matchingPool.address,
          memo,
          feeRate: +matchingPool.gas_rate,
        });

        this.hash = hash;
        this.pushTxStatus(hash, sourceAsset);
        this.txState = TransactionConfirmationState.SUCCESS;
      } catch (error) {
        console.error("error making transfer: ", error);
        this.error = error;
        this.txState = TransactionConfirmationState.ERROR;
      }
    }

  }

  getOutboundHash(hash) {
    const outbound$ = this.txStatusService
      .getOutboundHash(hash)
      .subscribe((res: Transaction) => {
        this.outboundHash = res.out[0]?.txID;
        console.log(res.out[0]?.coins[0]?.amount)
        if (assetAmount(res.out[0]?.coins[0]?.amount).amount().div(10 ** 8).toNumber() > 0)
          this.swapData.outputValue = assetAmount(res.out[0]?.coins[0]?.amount).amount().div(10 ** 8);

        if (!this.outboundHash && res.status == "success") {
          this.outboundHash = "success";
        }
      });

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
        hash: undefined,
      },
    });

    //get outbound hash for the view
    this.getOutboundHash(hash);
  }

  breadcrumbNav(val: string, type: 'processing' | 'success' | 'pending' = 'pending') {
    let label;
    switch (type) {
      case 'success':
        label = 'swap_success'
        break;
      case 'processing':
        label = 'swap_processing'
        break;
      default:
        label = 'swap_confirm'
        break;
    }

    if (val === 'skip') {
      this.analytics.event(label, 'breadcrumb_skip');
      this.overlaysService.setViews(MainViewsEnum.Swap, 'Swap');
    }
    else if (val === 'swap') {
      this.analytics.event(label, 'breadcrumb_swap');
      this.overlaysService.setViews(MainViewsEnum.Swap, 'Swap');
    }
  }

  getSwapMemo(
    chain: string,
    symbol: string,
    addr: string,
    sliplimit: number
  ): string {
    const tag =
      this.swapData.user &&
      this.swapData.user.type &&
      this.swapData.user.type === "XDEFI"
        ? "333"
        : "444";

    /** shorten ERC20 tokens */
    if (chain === "ETH" && symbol !== "ETH") {
      const ticker = symbol.split("-")[0];
      const trimmedAddress = symbol.substring(symbol.length - 3);
      symbol = `${ticker}-${trimmedAddress.toUpperCase()}`;
    }

    if (sliplimit && sliplimit.toString().length > 3) {
      const taggedSlip =
        sliplimit.toString().slice(0, sliplimit.toString().length - 3) + tag;
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
