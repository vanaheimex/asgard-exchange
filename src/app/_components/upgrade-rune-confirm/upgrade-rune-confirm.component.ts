import {
  Component,
  EventEmitter,
  Input,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { Balances } from '@xchainjs/xchain-client';
import { assetAmount, assetToBase } from '@xchainjs/xchain-util';
import { Subscription } from 'rxjs';
import { Asset, getChainAsset } from 'src/app/_classes/asset';
import { AssetAndBalance } from 'src/app/_classes/asset-and-balance';
import { PoolAddressDTO } from 'src/app/_classes/pool-address';
import { User } from 'src/app/_classes/user';
import { TransactionConfirmationState } from 'src/app/_const/transaction-confirmation-state';
import {
  AnalyticsService,
  assetString,
} from 'src/app/_services/analytics.service';
import { CopyService } from 'src/app/_services/copy.service';
import { CurrencyService } from 'src/app/_services/currency.service';
import { EthUtilsService } from 'src/app/_services/eth-utils.service';
import { ExplorerPathsService } from 'src/app/_services/explorer-paths.service';
import { MidgardService } from 'src/app/_services/midgard.service';
import {
  MainViewsEnum,
  OverlaysService,
} from 'src/app/_services/overlays.service';
import {
  TransactionStatusService,
  TxActions,
  TxStatus,
} from 'src/app/_services/transaction-status.service';
import { TransactionUtilsService } from 'src/app/_services/transaction-utils.service';
import { UserService } from 'src/app/_services/user.service';
import { Currency } from '../account-settings/currency-converter/currency-converter.component';

@Component({
  selector: 'app-upgrade-rune-confirm',
  templateUrl: './upgrade-rune-confirm.component.html',
  styleUrls: ['./upgrade-rune-confirm.component.scss'],
})
export class UpgradeRuneConfirmComponent implements OnInit, OnDestroy {
  @Input() asset: AssetAndBalance;
  @Input() nativeRune: AssetAndBalance;
  @Input() amount: number;
  @Output() back: EventEmitter<null>;
  @Output() transactionSuccessful: EventEmitter<string>;
  @Output() upgradeRune: EventEmitter<null>;

  txState: TransactionConfirmationState;
  binanceExplorerUrl: string;
  ethereumExplorerUrl: string;
  user: User;
  subs: Subscription[];
  hash: string;
  runeBalance: number;
  insufficientChainBalance: boolean;
  balances: Balances;
  networkFee: number;

  message: string;
  isError: boolean = false;
  loading: boolean = false;
  currency: Currency;

  constructor(
    private midgardService: MidgardService,
    private userService: UserService,
    private txStatusService: TransactionStatusService,
    private ethUtilsService: EthUtilsService,
    private copyService: CopyService,
    private explorerPathsService: ExplorerPathsService,
    private oveylaysService: OverlaysService,
    private txUtilsService: TransactionUtilsService,
    private curService: CurrencyService,
    private analytics: AnalyticsService,
    private overlaysService: OverlaysService
  ) {
    this.insufficientChainBalance = false;
    this.back = new EventEmitter<null>();
    this.transactionSuccessful = new EventEmitter<string>();
    this.upgradeRune = new EventEmitter<null>();
    this.txState = TransactionConfirmationState.PENDING_CONFIRMATION;

    const user$ = this.userService.user$.subscribe(
      (user) => (this.user = user)
    );

    const balances$ = this.userService.userBalances$.subscribe((balances) => {
      this.balances = balances;
      const runeBalance = this.userService.findBalance(
        balances,
        new Asset('THOR.RUNE')
      );
      if (runeBalance) {
        this.runeBalance = runeBalance;
      }
    });

    this.binanceExplorerUrl = `${this.explorerPathsService.binanceExplorerUrl}/tx`;
    this.ethereumExplorerUrl = `${this.explorerPathsService.ethereumExplorerUrl}/tx`;

    const cur$ = this.curService.cur$.subscribe((cur) => {
      this.currency = cur;
    });

    this.subs = [user$, balances$, cur$];
  }

  getChainAssetCaller(asset: Asset) {
    return getChainAsset(asset.chain);
  }

  copyToClipboard(): void {
    this.copyService.copyToClipboard(this.hash);
  }

  async ngOnInit(): Promise<void> {
    this.message = 'Confirm';
    this.loading = true;
    await this.estimateFees();
    this.checkSufficientFunds();
  }

  async estimateFees() {
    if (this.asset && this.asset.asset) {
      const asset =
        this.asset.asset.chain === 'BNB'
          ? new Asset('BNB.BNB')
          : new Asset('ETH.ETH');
      const inboundAddresses = await this.midgardService
        .getInboundAddresses()
        .toPromise();
      this.networkFee = this.txUtilsService.calculateNetworkFee(
        asset,
        inboundAddresses,
        'INBOUND'
      );
    }
  }

  checkSufficientFunds() {
    if (this.asset && this.asset.asset) {
      const balance =
        this.asset.asset.chain === 'BNB'
          ? this.userService.findBalance(this.balances, new Asset('BNB.BNB'))
          : this.userService.findBalance(this.balances, new Asset('ETH.ETH'));

      this.insufficientChainBalance = balance < this.networkFee;
      if (this.insufficientChainBalance) {
        const chainAsset = getChainAsset(this.asset.asset.chain);
        this.message = `Insufficient ${chainAsset.chain}.${chainAsset.ticker} for Fees`;
        this.isError = true;
      }

      this.loading = false;
    }
  }

  submitTransaction() {
    this.txState = TransactionConfirmationState.SUBMITTING;

    let upgradeAmountUSD = this.amount * this.asset.assetPriceUSD;
    this.analytics.event(
      'upgrade_confirm',
      'button_upgrade_confirm_*FROM_ASSET*_THOR.RUNE_usd_*numerical_usd_value*',
      upgradeAmountUSD,
      assetString(this.asset.asset),
      upgradeAmountUSD.toString()
    );
    let upgradeFeeAmountUSD = this.networkFee * this.asset.assetPriceUSD;
    this.analytics.event(
      'upgrade_confirm',
      'button_upgrade_confirm_*FROM_ASSET*_THOR.RUNE_fee_usd_*numerical_usd_value*',
      upgradeFeeAmountUSD,
      assetString(this.asset.asset),
      upgradeFeeAmountUSD.toString()
    );

    this.midgardService.getInboundAddresses().subscribe(async (res) => {
      const currentPools = res;

      if (currentPools && currentPools.length > 0) {
        const matchingPool = currentPools.find(
          (pool) => pool.chain === this.asset.asset.chain
        );

        if (matchingPool) {
          if (this.user.type === 'keystore') {
            this.keystoreTransfer(matchingPool);
          } else if (this.user.type === 'XDEFI') {
            this.keystoreTransfer(matchingPool);
          } else {
            this.message = 'no matching user type';
          }
        }
      }
    });
  }

  cancelButton() {
    let upgradeAmountUSD = this.amount * this.asset.assetPriceUSD;
    this.analytics.event(
      'upgrade_confirm',
      'button_upgrade_cancel_*FROM_ASSET*_THOR.RUNE_usd_*numerical_usd_value*',
      upgradeAmountUSD,
      assetString(this.asset.asset),
      upgradeAmountUSD.toString()
    );
    let upgradeFeeAmountUSD = this.networkFee * this.asset.assetPriceUSD;
    this.analytics.event(
      'upgrade_confirm',
      'button_upgrade_cancel_*FROM_ASSET*_THOR.RUNE_fee_usd_*numerical_usd_value*',
      upgradeFeeAmountUSD,
      assetString(this.asset.asset),
      upgradeFeeAmountUSD.toString()
    );
    this.back.emit();
  }

  async keystoreTransfer(matchingPool: PoolAddressDTO) {
    try {
      const asset = this.asset.asset;
      const amountNumber = this.amount;
      const thorchainClient = this.user.clients.thorchain;
      const runeAddress = await thorchainClient.getAddress();
      const memo = this.getRuneUpgradeMemo(runeAddress);
      const inboundAddresses = await this.midgardService
        .getInboundAddresses()
        .toPromise();

      if (
        thorchainClient &&
        runeAddress &&
        this.user &&
        this.user.clients &&
        amountNumber > 0
      ) {
        if (asset.chain === 'BNB') {
          const client = this.user.clients.binance;

          const hash = await client.transfer({
            asset: this.asset.asset,
            amount: assetToBase(assetAmount(amountNumber)),
            recipient: matchingPool.address,
            memo,
          });

          this.hash = hash;
          this.txStatusService.addTransaction({
            chain: asset.chain,
            hash: this.hash,
            ticker: asset.ticker,
            symbol: asset.symbol,
            status: TxStatus.PENDING,
            action: TxActions.UPGRADE_RUNE,
            isThorchainTx: false,
          });

          // this because of fetchBalances might gives a bug
          this.userService.pollNativeRuneBalance(this.runeBalance ?? 0);

          // this.transactionSuccessful.next(hash);
          this.txState = TransactionConfirmationState.SUCCESS;
        } else if (asset.chain === 'ETH') {
          const client = this.user.clients.ethereum;
          const decimal = await this.ethUtilsService.getAssetDecimal(
            this.asset.asset,
            client
          );
          let amount = assetToBase(assetAmount(this.amount, decimal)).amount();
          const balanceAmount = assetToBase(
            assetAmount(this.asset.balance.amount(), decimal)
          ).amount();

          const balanceFormatted = this.userService.findBalance(
            this.balances,
            this.asset.asset
          );

          const max = this.userService.maximumSpendableBalance(
            this.asset.asset,
            balanceFormatted,
            inboundAddresses
          );

          if (this.amount >= max) {
            amount = balanceAmount;
          }

          if (amount.isGreaterThan(balanceAmount)) {
            amount = balanceAmount;
          }
          const hash = await this.ethUtilsService.callDeposit({
            asset: this.asset.asset,
            inboundAddress: matchingPool,
            memo,
            amount,
            ethClient: client,
          });

          this.hash = hash.substr(2);

          this.txStatusService.addTransaction({
            chain: asset.chain,
            hash,
            ticker: asset.ticker,
            symbol: asset.symbol,
            status: TxStatus.PENDING,
            action: TxActions.UPGRADE_RUNE,
            isThorchainTx: false,
          });

          this.userService.pollNativeRuneBalance(this.runeBalance ?? 0);

          // this.transactionSuccessful.next(hash);
          this.txState = TransactionConfirmationState.SUCCESS;
        }
      } else {
        this.txState = TransactionConfirmationState.ERROR;
      }
    } catch (error) {
      console.error('error making transfer: ', error);
      this.message = error.message || error;
      this.txState = TransactionConfirmationState.ERROR;
    }
  }

  getRuneUpgradeMemo(thorAddress: string): string {
    return `SWITCH:${thorAddress}`;
  }

  breadcrumbNav(val: string, type: 'processing' | 'success' | 'pending') {
    let label;
    switch (type) {
      case 'success':
        label = 'upgrade_success';
        break;
      case 'processing':
        label = 'upgrade_processing';
        break;
      default:
        label = 'upgrade_confirm';
        break;
    }

    if (val === 'swap') {
      this.analytics.event(label, 'breadcrumb_skip');
      this.overlaysService.setViews(MainViewsEnum.Swap, 'Swap');
    } else if (val === 'back') {
      this.analytics.event(label, 'breadcrumb_upgrade');
      this.upgradeRune.emit();
    }
  }

  close(): void {
    this.oveylaysService.setViews(MainViewsEnum.Swap, 'Swap');
  }

  ngOnDestroy() {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }
  }
}
