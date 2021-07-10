import {
  Component,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
  EventEmitter,
} from '@angular/core';
import { Subject, Subscription } from 'rxjs';
import { User } from '../../_classes/user';
import { TransactionConfirmationState } from '../../_const/transaction-confirmation-state';
import { UserService } from '../../_services/user.service';
import {
  assetAmount,
  assetToBase,
  assetToString,
  bn,
} from '@xchainjs/xchain-util';
import {
  TransactionStatusService,
  TxActions,
  TxStatus,
} from 'src/app/_services/transaction-status.service';
import { Router } from '@angular/router';
import { OverlaysService } from 'src/app/_services/overlays.service';
import {
  AnalyticsService,
  assetString,
} from 'src/app/_services/analytics.service';
import { EthUtilsService } from 'src/app/_services/eth-utils.service';
import { Asset } from 'src/app/_classes/asset';
import { PoolTypeOption } from 'src/app/_const/pool-type-options';
import { TransactionUtilsService } from 'src/app/_services/transaction-utils.service';
import { MidgardService } from 'src/app/_services/midgard.service';
import { MetamaskService } from 'src/app/_services/metamask.service';
import { ethers } from 'ethers';
import { retry } from 'rxjs/operators';
import { Transaction } from 'src/app/_classes/transaction';

// TODO: this is the same as ConfirmStakeData in confirm stake modal
export interface ConfirmWithdrawData {
  asset: Asset;
  rune: Asset;
  runeBasePrice: number;
  assetBasePrice: number;
  assetAmount: number;
  runeAmount: number;
  user: User;
  unstakePercent: number;
  assetPrice: number;
  runePrice: number;
  runeFee: number;
  networkFee: number;
  withdrawType: PoolTypeOption;
}

@Component({
  selector: 'app-confirm-withdraw-modal',
  templateUrl: './confirm-withdraw-modal.component.html',
  styleUrls: ['./confirm-withdraw-modal.component.scss'],
})
export class ConfirmWithdrawModalComponent implements OnInit, OnDestroy {
  txState: TransactionConfirmationState;
  hash: string;
  subs: Subscription[];
  killPolling: Subject<void> = new Subject();
  error: string;
  estimatedMinutes: number;
  rune = new Asset('THOR.RUNE');

  //new reskin data injection
  @Input() data: ConfirmWithdrawData;
  @Output() closeEvent: EventEmitter<boolean>;

  message: string = 'confirm';
  metaMaskProvider?: ethers.providers.Web3Provider;
  hashSuccess: boolean;
  outboundHash: string;

  constructor(
    private txStatusService: TransactionStatusService,
    private txUtilsService: TransactionUtilsService,
    private userService: UserService,
    private router: Router,
    private overlaysService: OverlaysService,
    private ethUtilsService: EthUtilsService,
    private midgardService: MidgardService,
    private analytics: AnalyticsService,
    private metaMaskService: MetamaskService
  ) {
    this.hashSuccess = false;
    this.closeEvent = new EventEmitter<boolean>();
    this.txState = TransactionConfirmationState.PENDING_CONFIRMATION;
    const user$ = this.userService.user$.subscribe((user) => {
      if (!user) {
        this.closeDialog();
      }
    });

    const metaMaskProvider$ = this.metaMaskService.provider$.subscribe(
      (provider) => (this.metaMaskProvider = provider)
    );

    this.subs = [user$, metaMaskProvider$];
  }

  ngOnInit(): void {
    this.estimateTime();
  }

  async estimateTime() {
    if (this.data.asset.chain === 'ETH' && this.data.asset.symbol !== 'ETH') {
      this.estimatedMinutes = await this.ethUtilsService.estimateERC20Time(
        assetToString(this.data.asset),
        this.data.assetAmount
      );
    } else {
      this.estimatedMinutes = this.txStatusService.estimateTime(
        this.data.asset.chain,
        this.data.assetAmount
      );
    }
  }

  async submitTransaction(): Promise<void> {
    this.txState = TransactionConfirmationState.SUBMITTING;

    let withdrawAmountUSD =
      this.data.runeAmount * this.data.runePrice +
      this.data.assetAmount * this.data.assetPrice;
    this.analytics.event(
      'pool_withdraw_symmetrical_confirm',
      'button_withdraw_confirm_*POOL_ASSET*_usd_*numerical_usd_value*',
      withdrawAmountUSD,
      assetString(this.data.asset),
      withdrawAmountUSD.toString()
    );

    let withdrawFeeAmountUSD =
      this.data.runeFee * this.data.runePrice +
      this.data.assetAmount * this.data.networkFee;
    this.analytics.event(
      'pool_withdraw_symmetrical_confirm',
      'button_withdraw_confirm_*POOL_ASSET*_fee_usd_*numerical_usd_value*',
      withdrawFeeAmountUSD,
      assetString(this.data.asset),
      withdrawFeeAmountUSD.toString()
    );

    const memo = `WITHDRAW:${this.data.asset.chain}.${this.data.asset.symbol}:${
      this.data.unstakePercent * 100
    }`;
    const user = this.data.user;

    if (
      user?.type === 'XDEFI' ||
      user?.type === 'keystore' ||
      user?.type === 'walletconnect'
    ) {
      if (this.data.withdrawType === 'ASYM_ASSET') {
        this.keystoreAssetWithdraw(memo);
      } else {
        this.runeWithdraw(memo);
      }
    } else if (user?.type === 'metamask') {
      this.metaMaskAssetWithdraw(memo);
    }
  }

  async runeWithdraw(memo: string) {
    // withdraw RUNE
    try {
      const txCost = assetToBase(assetAmount(0.00000001));

      const thorClient = this.data.user.clients.thorchain;
      if (!thorClient) {
        console.error('no thor client found!');
        return;
      }

      const assetObj = {
        chain: this.data.rune.chain,
        symbol: this.data.rune.symbol,
        ticker: this.data.rune.ticker,
      };

      const hash = await thorClient.deposit({
        asset: assetObj,
        amount: txCost,
        memo,
      });

      this.txSuccess(hash);
    } catch (error) {
      console.error('error making RUNE withdraw: ', error);
      this.error = error;
      this.message = error;
      this.txState = TransactionConfirmationState.ERROR;
    }
  }

  async metaMaskAssetWithdraw(memo: string) {
    const asset = this.data.asset;
    const inboundAddresses = await this.midgardService
      .getInboundAddresses()
      .toPromise();
    if (!inboundAddresses) {
      console.error('no inbound addresses found');
      this.error = 'No Inbound Addresses Found. Please try again later.';
      this.txState = TransactionConfirmationState.ERROR;
      return;
    }

    const matchingInboundAddress = inboundAddresses.find(
      (inbound) => inbound.chain === asset.chain
    );
    if (!matchingInboundAddress) {
      console.error('no matching inbound addresses found');
      this.error = 'No Matching Inbound Address Found. Please try again later.';
      this.txState = TransactionConfirmationState.ERROR;
      return;
    }

    if (!this.metaMaskProvider) {
      this.error = 'No MetaMask Provider found.';
      this.txState = TransactionConfirmationState.ERROR;
      return;
    }

    try {
      const hash = await this.metaMaskService.callDeposit({
        ethInboundAddress: matchingInboundAddress,
        asset: new Asset('ETH.ETH'),
        input: 0.00000001,
        memo,
        userAddress: this.data.user.wallet,
        signer: this.metaMaskProvider.getSigner(),
      });

      if (hash.length > 0) {
        this.txSuccess(this.ethUtilsService.strip0x(hash));
      } else {
        console.error('hash empty');
        this.error = 'Error withdrawing, hash is empty. Please try again later';
        this.txState = TransactionConfirmationState.ERROR;
      }
    } catch (error) {
      console.error(error);
      this.error = 'Error withdrawing. Please try again later';
      this.txState = TransactionConfirmationState.ERROR;
    }
  }

  async keystoreAssetWithdraw(memo: string) {
    try {
      const asset = this.data.asset;

      const inboundAddresses = await this.midgardService
        .getInboundAddresses()
        .toPromise();
      if (!inboundAddresses) {
        console.error('no inbound addresses found');
        this.error = 'No Inbound Addresses Found. Please try again later.';
        this.txState = TransactionConfirmationState.ERROR;
        return;
      }

      const matchingInboundAddress = inboundAddresses.find(
        (inbound) => inbound.chain === asset.chain
      );
      if (!matchingInboundAddress) {
        console.error('no matching inbound addresses found');
        this.error =
          'No Matching Inbound Address Found. Please try again later.';
        this.txState = TransactionConfirmationState.ERROR;
        return;
      }

      const minAmount = this.txUtilsService.getMinAmountByChain(asset.chain);
      let hash = '';
      switch (asset.chain) {
        case 'ETH':
          const ethClient = this.data.user.clients.ethereum;
          if (!ethClient) {
            console.error('no ETH client found for withdraw');
            this.error = 'No Eth Client Found. Please try again later.';
            this.txState = TransactionConfirmationState.ERROR;
            return;
          }
          const ethHash = await this.ethUtilsService.callDeposit({
            inboundAddress: matchingInboundAddress,
            ethClient,
            asset: new Asset('ETH.ETH'),
            amount: minAmount.amount(),
            memo,
          });

          hash = this.ethUtilsService.strip0x(ethHash);

          break;

        case 'BTC':
        case 'BCH':
        case 'LTC':
        case 'BNB':
          const client = this.userService.getChainClient(
            this.data.user,
            asset.chain
          );
          if (!client) {
            console.error('no client found for withdraw');
            this.error = 'No Client Found. Please try again later.';
            this.txState = TransactionConfirmationState.ERROR;
            return;
          }

          hash = await client.transfer({
            asset: {
              chain: asset.chain,
              symbol: asset.symbol,
              ticker: asset.ticker,
            },
            amount: minAmount,
            recipient: matchingInboundAddress.address,
            memo,
            feeRate: +matchingInboundAddress.gas_rate,
          });
          break;
      }

      if (hash.length > 0) {
        this.txSuccess(hash);
      } else {
        console.error('hash empty');
        this.error = 'Error withdrawing, hash is empty. Please try again later';
        this.txState = TransactionConfirmationState.ERROR;
      }
    } catch (error) {
      console.error(error);
      this.error = 'Error withdrawing. Please try again later';
      this.txState = TransactionConfirmationState.ERROR;
    }
  }

  breadcrumbNav(nav: string, mode: 'pending' | 'processing' | 'success') {
    if (nav === 'pool') {
      this.router.navigate(['/', 'pool']);
      if (mode === 'pending') {
        this.analytics.event(
          'pool_withdraw_symmetrical_confirm',
          'breadcrumb_pools'
        );
      } else if (mode === 'processing') {
        this.analytics.event(
          'pool_withdraw_symmetrical_processing',
          'breadcrumb_pools'
        );
      } else if (mode === 'success') {
        this.analytics.event(
          'pool_withdraw_symmetrical_success',
          'breadcrumb_pools'
        );
      }
    } else if (nav === 'swap') {
      this.router.navigate(['/', 'swap']);
      if (mode === 'pending') {
        this.analytics.event(
          'pool_withdraw_symmetrical_confirm',
          'breadcrumb_skip'
        );
      } else if (mode === 'processing') {
        this.analytics.event(
          'pool_withdraw_symmetrical_processing',
          'breadcrumb_skip'
        );
      } else if (mode === 'success') {
        this.analytics.event(
          'pool_withdraw_symmetrical_success',
          'breadcrumb_skip'
        );
      }
    }
  }

  txSuccess(hash: string) {
    this.txState = TransactionConfirmationState.SUCCESS;
    this.hash = hash;
    this.txStatusService.addTransaction({
      chain: 'THOR',
      hash: this.hash,
      ticker: `${this.data.asset.ticker}-RUNE`,
      symbol: this.data.asset.symbol,
      status: TxStatus.PENDING,
      action: TxActions.WITHDRAW,
      isThorchainTx: true,
    });

    this.hashIsSuccessful(hash);
  }

  hashIsSuccessful(hash: string) {
    this.txStatusService
      .getOutboundHash(hash)
      .pipe(retry(2))
      .subscribe((res: Transaction) => {
        if (res.type === 'withdraw' && res.status === 'success') {
          this.hashSuccess = true;
          this.data.runeAmount = bn(
            res.out
              .find((outTx) =>
                outTx.coins.find(
                  (c) => c.asset === `${this.rune.chain}.${this.rune.ticker}`
                )
              )
              ?.coins.find(
                (c) => c.asset === `${this.rune.chain}.${this.rune.ticker}`
              ).amount
          )
            .div(10 ** 8)
            .toNumber();

          this.data.assetAmount = bn(
            res.out
              .find((outTx) =>
                outTx.coins.find(
                  (c) =>
                    c.asset ===
                    `${this.data.asset.chain}.${this.data.asset.ticker}`
                )
              )
              ?.coins.find(
                (c) =>
                  c.asset ===
                  `${this.data.asset.chain}.${this.data.asset.ticker}`
              ).amount
          )
            .div(10 ** 8)
            .toNumber();

          this.outboundHash =
            res.out.find((outTx) =>
              outTx.coins.find(
                (c) =>
                  c.asset ===
                  `${this.data.asset.chain}.${this.data.asset.ticker}`
              )
            )?.txID || '';
        }
      });
  }

  closeDialog(transactionSucess?: boolean) {
    let withdrawAmountUSD =
      this.data.runeAmount * this.data.runePrice +
      this.data.assetAmount * this.data.assetPrice;
    this.analytics.event(
      'pool_withdraw_symmetrical_confirm',
      'button_withdraw_cancel_*POOL_ASSET*_usd_*numerical_usd_value*',
      withdrawAmountUSD,
      assetString(this.data.asset),
      withdrawAmountUSD.toString()
    );

    let withdrawFeeAmountUSD =
      this.data.runeFee * this.data.runePrice +
      this.data.assetAmount * this.data.networkFee;
    this.analytics.event(
      'pool_withdraw_symmetrical_confirm',
      'button_withdraw_cancel_*POOL_ASSET*_fee_usd_*numerical_usd_value*',
      withdrawFeeAmountUSD,
      assetString(this.data.asset),
      withdrawFeeAmountUSD.toString()
    );

    this.closeEvent.emit(transactionSucess);
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
