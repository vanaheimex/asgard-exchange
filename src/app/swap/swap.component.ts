import { Component, OnInit, OnDestroy } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { Asset, getChainAsset } from "../_classes/asset";
import { UserService } from "../_services/user.service";
import { combineLatest, Subscription, timer } from "rxjs";
import {
  getDoubleSwapOutput,
  getSwapSlip,
  getDoubleSwapSlip,
  PoolData,
  getValueOfAssetInRune,
  getValueOfRuneInAsset,
  getSwapOutput,
} from "@thorchain/asgardex-util";
import BigNumber from "bignumber.js";
import {
  bn,
  baseAmount,
  BaseAmount,
  assetToBase,
  assetAmount,
  assetToString,
} from "@xchainjs/xchain-util";
import { PoolDetail } from "../_classes/pool-detail";
import { MidgardService, ThorchainQueue } from "../_services/midgard.service";
import { MatDialog } from "@angular/material/dialog";
import {
  ConfirmSwapModalComponent,
  SwapData,
} from "./confirm-swap-modal/confirm-swap-modal.component";
import { User } from "../_classes/user";
import { Balances } from "@xchainjs/xchain-client";
import { AssetAndBalance } from "../_classes/asset-and-balance";
import { PoolDTO } from "../_classes/pool";
import { SlippageToleranceService } from "../_services/slippage-tolerance.service";
import { PoolAddressDTO } from "../_classes/pool-address";
import { MainViewsEnum, OverlaysService } from "../_services/overlays.service";
import { ThorchainPricesService } from "../_services/thorchain-prices.service";
import { TransactionUtilsService } from "../_services/transaction-utils.service";
import { NetworkQueueService } from "../_services/network-queue.service";
import { environment } from "src/environments/environment";
import { CurrencyService } from "../_services/currency.service";
import { Currency } from "../_components/account-settings/currency-converter/currency-converter.component";
import {
  debounceTime,
  delay,
  retryWhen,
  switchMap,
  take,
} from 'rxjs/operators';
import { UpdateTargetAddressModalComponent } from './update-target-address-modal/update-target-address-modal.component';
import { SwapServiceService } from "../_services/swap-service.service";
import { AnalyticsService, assetString } from '../_services/analytics.service';

export enum SwapType {
  DOUBLE_SWAP = "double_swap",
  SINGLE_SWAP = "single_swap",
}

@Component({
  selector: "app-swap",
  templateUrl: "./swap.component.html",
  styleUrls: ["./swap.component.scss"],
})
export class SwapComponent implements OnInit, OnDestroy {
  /**
   * From
   */
  get sourceAssetUnit() {
    return this._sourceAssetUnit;
  }
  set sourceAssetUnit(val: number) {
    this._sourceAssetUnit = val;
    this._sourceAssetTokenValue = assetToBase(assetAmount(val));

    if (val) {
      this.updateSwapDetails();
    } else {
      this.targetAssetUnit = null;
      this.slip = 0;
    }
  }
  private _sourceAssetUnit: number;
  private _sourceAssetTokenValue: BaseAmount;

  //price of the selected asset
  sourceAssetPrice: number;

  get selectedSourceAsset() {
    return this._selectedSourceAsset;
  }
  set selectedSourceAsset(asset: Asset) {
    this.ethContractApprovalRequired = false;
    if (this.selectedSourceAsset) {
      this.targetAssetUnit = null;
      this.calculatingTargetAsset = true;
    }
    this._selectedSourceAsset = asset;

    if (asset) {
      this.router.navigate([
        "/",
        "swap",
        `${asset.chain}.${asset.symbol}`,
        this.selectedTargetAsset
          ? `${this.selectedTargetAsset.chain}.${this.selectedTargetAsset.symbol}`
          : "",
      ]);
    }

    if (this._selectedSourceAsset) {
      this.updateSwapDetails();
    }
    this.sourceBalance = this._selectedSourceAsset
      ? this.userService.findBalance(this.balances, asset)
      : 0;

    this.sourceBalance = this.userService.findBalance(this.balances, asset);
    if (
      this._selectedSourceAsset &&
      asset.chain === "ETH" &&
      asset.ticker !== "ETH"
    ) {
      this.checkContractApproved();
    }

    /**
     * If input value is more than balance of newly selected asset
     * set the input to the max
     */
    if (this.sourceBalance < this.sourceAssetUnit) {
      this.sourceAssetUnit = this.sourceBalance;
    }
  }
  private _selectedSourceAsset: Asset;
  selectedSourceBalance: number;
  sourcePoolDetail: PoolDetail;
  isMaxError: boolean;

  /**
   * To
   */
  get targetAssetUnit() {
    return this._targetAssetUnit;
  }
  set targetAssetUnit(val: BigNumber) {
    this._targetAssetUnit = val;
    this.targetAssetUnitDisplay = val
      ? Number(val.div(10 ** 8).toPrecision())
      : null;
  }
  private _targetAssetUnit: BigNumber;

  targetAssetUnitDisplay: number;
  targetAssetPrice: number;

  get selectedTargetAsset() {
    return this._selectedTargetAsset;
  }
  set selectedTargetAsset(asset: Asset) {
    this._selectedTargetAsset = asset;
    this.targetAssetUnit = null;
    this.calculatingTargetAsset = true;
    this.updateSwapDetails();
    this.targetBalance = this.userService.findBalance(this.balances, asset);

    if (asset) {
      this.router.navigate([
        "/",
        "swap",
        this.selectedSourceAsset
          ? `${this.selectedSourceAsset.chain}.${this.selectedSourceAsset.symbol}`
          : "no-asset",
        `${asset.chain}.${asset.symbol}`,
      ]);
    }

    try {
      this.targetClientAddress = this.userService.getChainClient(this.user, this._selectedTargetAsset?.chain)?.getAddress();
    } catch (error) {
      this.targetAddress = undefined;
    }

    this.setTargetAddress();
  }
  private _selectedTargetAsset: Asset;
  targetPoolDetail: PoolDetail;
  subs: Subscription[];

  slip: number;
  slippageTolerance: number;
  user: User;
  basePrice: number;

  balances: Balances;
  sourceBalance: number;
  targetBalance: number;

  errorMessage: string;
  calculatingTargetAsset: boolean;
  poolDetailTargetError: boolean;
  poolDetailSourceError: boolean;
  selectableMarkets: AssetAndBalance[];
  targetMarketShow: boolean;
  sourceMarketShow: boolean;
  swapData: SwapData;
  confirmShow: boolean;

  runePrice: number;

  inboundFees: { [key: string]: number } = {};

  outboundFees: { [key: string]: number } = {};
  targetAddress: string;

  /**
   * ETH specific
   */
  ethContractApprovalRequired: boolean;
  ethInboundAddress: PoolAddressDTO;
  availablePools: PoolDTO[];

  inboundAddresses: PoolAddressDTO[];
  ethPool: PoolDTO;
  inputNetworkFee: number;
  outputNetworkFee: number;
  queue: ThorchainQueue;

  appLocked: boolean;
  networkFeeInSource: number;
  currency: Currency;
  sourceChainBalance: number;

  haltedChains: string[];
  targetAddressData: any;
  targetClientAddress: string;

  constructor(
    private dialog: MatDialog,
    private userService: UserService,
    private midgardService: MidgardService,
    private slipLimitService: SlippageToleranceService,
    private thorchainPricesService: ThorchainPricesService,
    public overlaysService: OverlaysService,
    private txUtilsService: TransactionUtilsService,
    private networkQueueService: NetworkQueueService,
    private currencyService: CurrencyService,
    private router: Router,
    private route: ActivatedRoute,
    private swapService: SwapServiceService,
    private analytics: AnalyticsService
  ) {
    this.ethContractApprovalRequired = false;
    this.selectableMarkets = undefined;
    this.haltedChains = [];
    this.targetAddress = '';

    const balances$ = this.userService.userBalances$
      .pipe(debounceTime(500))
      .subscribe((balances) => {
        this.balances = balances;
        this.sourceBalance = this.userService.findBalance(
          this.balances,
          this.selectedSourceAsset
        );
        this.targetBalance = this.userService.findBalance(
          this.balances,
          this.selectedTargetAsset
        );

        if (
          this.selectedTargetAsset &&
          !this.isRune(this.selectedTargetAsset)
        ) {
          this.updateSwapDetails();
        }

        if (this.selectedSourceAsset) {
          this.setSourceChainBalance();

          if (!this.isRune(this.selectedSourceAsset)) {
            this.updateSwapDetails();
          }
        }
      });

    const user$ = this.userService.user$.subscribe(async (user) => {
      this.user = user;

      if (!user) {
        this.sourceAssetUnit = null;
        this.selectedTargetAsset = null;
        this.selectedSourceAsset = null;
        this.targetAssetUnit = null;
        this.sourceBalance = undefined;
        this.targetBalance = undefined;
        this.balances = undefined;
      }
      
      this.setTargetAddress();
    });

    const queue$ = this.networkQueueService.networkQueue$.subscribe(
      (queue) => (this.queue = queue)
    );

    const slippageTolerange$ =
      this.slipLimitService.slippageTolerance$.subscribe(
        (limit) => (this.slippageTolerance = limit)
      );

    const curs$ = this.currencyService.cur$.subscribe((cur) => {
      this.currency = cur;
    });

    let sourceAmount = this.swapService.getSourceAmount();
    let targetAmount = this.swapService.getTargetAmount();

    if (sourceAmount && targetAmount) {
      this.sourceAssetUnit = sourceAmount;
      this.targetAssetUnit = targetAmount;
      this.swapService.setSource(0);
      this.swapService.setTarget(new BigNumber(0));
    }

    this.subs = [balances$, user$, slippageTolerange$, queue$, curs$];

    this.appLocked = environment.appLocked;
  }

  ngOnInit(): void {
    this.getEthRouter();
    const inboundAddresses$ = this.midgardService.getInboundAddresses();
    const pools$ = this.midgardService.getPools();
    const params$ = this.route.paramMap;
    const combined = combineLatest([inboundAddresses$, pools$, params$]);
    const sub = timer(0, 30000)
      .pipe(
        // combined
        switchMap(() => combined),
        retryWhen((errors) => errors.pipe(delay(10000), take(10)))
      )
      .subscribe(([inboundAddresses, pools, params]) => {
        this.inboundAddresses = inboundAddresses;

        // check for halted chains
        this.setHaltedChains();

        // set ETH pool if available
        const ethPool = pools.find((pool) => pool.asset === "ETH.ETH");
        if (ethPool) {
          this.ethPool = ethPool;
        }

        this.setAvailablePools(pools);
        this.setSelectableMarkets();

        // update network fees
        this.setNetworkFees();

        // on init, set target asset
        const sourceAssetName = params.get("sourceAsset");
        const targetAssetName = params.get("targetAsset");

        if (
          sourceAssetName &&
          targetAssetName &&
          sourceAssetName == targetAssetName
        ) {
          this.router.navigate(["/", "swap", "THOR.RUNE", "BTC.BTC"]);
          return;
        } else if (
          this.selectableMarkets &&
          !this.selectedSourceAsset &&
          !this.selectedTargetAsset
        ) {
          if (sourceAssetName && sourceAssetName !== "no-asset") {
            this.setSelectedSourceAsset(
              new Asset(sourceAssetName),
              this.selectableMarkets
            );
          }

          if (targetAssetName && targetAssetName !== "no-asset") {
            this.setSelectedTargetAsset(
              new Asset(targetAssetName),
              this.selectableMarkets
            );
          }
        }    

      });

    this.subs.push(sub);
  }

  setSelectedSourceAsset(asset: Asset, selectableMarkets: AssetAndBalance[]) {
    // ensure match exists
    const match = selectableMarkets.find(
      (market) => assetToString(market.asset) === assetToString(asset)
    );

    if (match) {
      this.ethContractApprovalRequired = false;
      if (this.selectedSourceAsset) {
        this.targetAssetUnit = null;
        this.calculatingTargetAsset = true;
      }
      this._selectedSourceAsset = asset;
      this.updateSwapDetails();
      this.sourceBalance = this.userService.findBalance(this.balances, asset);
      if (asset.chain === 'ETH' && asset.ticker !== 'ETH') {
        this.checkContractApproved();
      }

      /**
       * If input value is more than balance of newly selected asset
       * set the input to the max
       */
      if (this.sourceBalance < this.sourceAssetUnit) {
        this.sourceAssetUnit = this.sourceBalance;
      }

      this.setSourceChainBalance();
    }
  }

  setSelectedTargetAsset(asset: Asset, selectableMarkets: AssetAndBalance[]) {
    // ensure match exists
    const match = selectableMarkets.find(
      (market) => assetToString(market.asset) === assetToString(asset)
    );
    if (match) {
      this._selectedTargetAsset = asset;
      this.targetAssetUnit = null;
      this.calculatingTargetAsset = true;
      this.updateSwapDetails();
      this.targetBalance = this.userService.findBalance(this.balances, asset);
      this.setTargetAddress();
    }
  }

  setTargetAddress() {
    if (
      this.selectedTargetAsset != null &&
      ((this.user != null &&
        this.user?.type &&
        this.user?.type === 'keystore') ||
        this.user?.type === 'XDEFI')
    ) {
      this.targetAddress = this.userService.getTokenAddress(
        this.user,
        this.selectedTargetAsset.chain
      );
    }
  }

  setSourceChainBalance() {
    if (this.selectedSourceAsset && this.balances) {
      const sourceChainAsset = getChainAsset(this.selectedSourceAsset?.chain);
      const sourceChainBalance = this.userService.findBalance(
        this.balances,
        sourceChainAsset
      );
      this.sourceChainBalance = sourceChainBalance ?? 0;
    } else {
      this.sourceChainBalance = 0;
    }
  }

  launchEditTargetAddressModal() {
    if (!this.selectedTargetAsset || !this.user) {
      return;
    }

    this.targetAddressData = {
      chain: this.selectedTargetAsset.chain,
      targetAddress: this.targetAddress,
      user: this.user,
    }

    this.analytics.event('swap_prepare', 'select_receive_container_target_address');
    this.overlaysService.setCurrentSwapView('Update-target');

    // const dialogRef = this.dialog.open(UpdateTargetAddressModalComponent, {
    //   minWidth: '260px',
    //   maxWidth: '420px',
    //   width: '50vw',
    //   data: {
    //     chain: this.selectedTargetAsset.chain,
    //     targetAddress: this.targetAddress,
    //     user: this.user,
    //   },
    // });

    // dialogRef.afterClosed().subscribe((newAddress: string) => {
    // });
  }

  editTargetAddressClose(newAddress: string) {
    if (newAddress && newAddress.length > 0) {
      this.targetAddress = newAddress;
    }
  }

  breadcrumbNav(val: string) {
    if (val === 'skip') {
      if (!this.user)
        this.analytics.event('swap_disconnected', 'breadcrumb_skip');
      else if (this.user)
        this.analytics.event('swap_prepare', 'breadcrumb_skip');
      this.overlaysService.setViews(MainViewsEnum.Swap, 'Swap');
    }
  }

  switchNav(val: string) {
    if (val === "left") {
      this.router.navigate([
        "/",
        "swap"
      ]);
    }
    else if (val === "right") {
      if (!this.user)
        this.analytics.event('swap_disconnected', 'switch_pool');
      else if (this.user) {
        this.analytics.event('swap_prepare', 'switch_pool');
      }
      this.router.navigate([
        "/",
        "pool"
      ]);
    }
  }

  marketModal(val: 'source' | 'target') {
    if (val === 'source') {
      if (this.user)
        this.analytics.event('swap_prepare', 'select_send_container_asset');
      this.overlaysService.setCurrentSwapView('SourceAsset');
    }
    else if (val === 'target') {
      if (this.user)
        this.analytics.event('swap_prepare', 'select_receive_container_asset');
      this.overlaysService.setCurrentSwapView('TargetAsset');
    }
  }

  marketNav(val: string) {
    if (val === 'skip') {
      if (this.user)
        this.analytics.event('swap_asset_search', 'breadcrumb_skip');
      this.overlaysService.setCurrentSwapView('Swap');
    }
    else if (val === 'swap') {
      if (this.user)
        this.analytics.event('swap_asset_search', 'breadcrumb_swap');
      this.overlaysService.setCurrentSwapView('Swap');
    }
  }

  setNetworkFees() {
    if (!this.availablePools || !this.inboundAddresses) {
      return;
    }

    for (const pool of this.availablePools) {
      const asset = new Asset(pool.asset);

      const assetOutboundFee = this.txUtilsService.calculateNetworkFee(
        asset,
        this.inboundAddresses,
        "OUTBOUND",
        pool
      );

      const assetInboundFee = this.txUtilsService.calculateNetworkFee(
        asset,
        this.inboundAddresses,
        "INBOUND",
        pool
      );

      this.outboundFees[pool.asset] = assetOutboundFee;
      this.inboundFees[pool.asset] = assetInboundFee;
    }

    // set THOR.RUNE network fees
    this.outboundFees["THOR.RUNE"] = this.txUtilsService.calculateNetworkFee(
      new Asset("THOR.RUNE"),
      this.inboundAddresses,
      "OUTBOUND"
    );

    this.inboundFees["THOR.RUNE"] = this.txUtilsService.calculateNetworkFee(
      new Asset("THOR.RUNE"),
      this.inboundAddresses,
      "INBOUND"
    );
  }

  goToSettings() {
    
    if (this.slip)
      this.analytics.event('swap_prepare', 'select_slip_tolerance_slip_visible')
    else
      this.analytics.event('swap_prepare', 'select_slip_tolerance')

    this.overlaysService.setSettingViews(
      MainViewsEnum.AccountSetting,
      "SLIP",
      true
    );

    this.swapService.setSource(this.sourceAssetUnit);
    this.swapService.setTarget(this.targetAssetUnit);
  }

  transactionSuccess() {
    this.targetAssetUnit = null;
    this.sourceAssetUnit = null;
  }

  isRune(asset: Asset): boolean {
    return asset && asset.ticker === "RUNE"; // covers BNB and native
  }

  isNativeRune(asset: Asset): boolean {
    return assetToString(asset) === "THOR.RUNE";
  }

  getEthRouter() {
    this.midgardService.getInboundAddresses().subscribe((addresses) => {
      const ethInbound = addresses.find((inbound) => inbound.chain === "ETH");
      if (ethInbound) {
        this.ethInboundAddress = ethInbound;
      }
    });
  }

  setHaltedChains() {
    this.haltedChains = this.inboundAddresses
      .filter((inboundAddress) => inboundAddress.halted)
      .map((inboundAddress) => inboundAddress.chain);
  }

  setAvailablePools(pools: PoolDTO[]) {
    this.availablePools = pools
      .filter((pool) => pool.status === "available")
      .filter(
        (pool) => !this.haltedChains.includes(new Asset(pool.asset).chain)
      );
  }

  setSelectableMarkets() {
    if (!this.availablePools) {
      this.selectableMarkets = [];
    } else {
      this.selectableMarkets = this.availablePools
        .sort((a, b) => a.asset.localeCompare(b.asset))
        .map((pool) => ({
          asset: new Asset(pool.asset),
          assetPriceUSD: +pool.assetPriceUSD,
        }))
        // filter out until we can add support
        .filter(
          (pool) =>
            pool.asset.chain === "BNB" ||
            pool.asset.chain === "THOR" ||
            pool.asset.chain === "BTC" ||
            pool.asset.chain === "ETH" ||
            pool.asset.chain === "LTC" ||
            pool.asset.chain === 'BCH'
        );

      // Keeping RUNE at top by default
      this.selectableMarkets.unshift({
        asset: new Asset("THOR.RUNE"),
        assetPriceUSD: this.thorchainPricesService.estimateRunePrice(
          this.availablePools
        ),
      });
      
    }
  }

  async checkContractApproved() {
    if (this.ethInboundAddress && this.user) {
      const assetAddress = this.selectedSourceAsset.symbol.slice(
        this.selectedSourceAsset.ticker.length + 1
      );
      const strip0x = assetAddress.substr(2);
      const isApproved = await this.user.clients.ethereum.isApproved(
        this.ethInboundAddress.router,
        strip0x,
        baseAmount(1)
      );
      this.ethContractApprovalRequired = !isApproved;
    }
  }

  contractApproved() {
    this.ethContractApprovalRequired = false;
  }

  formInvalid(): boolean {
    return (
      !this.sourceAssetUnit ||
      !this.selectedSourceAsset ||
      !this.selectedTargetAsset ||
      !this.targetAssetUnit ||
      !this.inboundAddresses ||
      !this.targetAddress ||
      this.haltedChains.includes(this.selectedSourceAsset.chain) ||
      this.haltedChains.includes(this.selectedTargetAsset?.chain) ||
      this.sourceAssetUnit >
        this.userService.maximumSpendableBalance(
          this.selectedSourceAsset,
          this.sourceBalance,
          this.inboundAddresses
        ) ||
      this.sourceAssetUnit <=
        this.userService.minimumSpendable(this.selectedSourceAsset) ||
      this.targetAssetUnitDisplay <=
        this.userService.minimumSpendable(this.selectedTargetAsset) ||
      !this.user ||
      !this.balances ||
      this.ethContractApprovalRequired ||
      (this.queue && this.queue.outbound >= 12) ||
      this.slip * 100 > this.slippageTolerance ||
      // check target asset amount is greater than outbound network fee * 3
      this.targetAssetUnitDisplay <
        this.outboundFees[assetToString(this.selectedTargetAsset)] ||
      // if RUNE, ensure 3 RUNE remain in wallet
      (this.selectedSourceAsset.chain === "THOR" &&
        this.sourceBalance - this.sourceAssetUnit < 0.2) ||
      // check sufficient underlying chain balance to cover fees
      this.sourceChainBalance <
        1.5 *
          this.inboundFees[
            assetToString(getChainAsset(this.selectedSourceAsset.chain))
          ]
    );
  }

  // getMessage() {
  //   let message = '';
  //   if(this.isError() != '')
  //     message = this.isError();
  //   else if(this.user && this.balances) {
  //     message = 'prepare';
  //     if (!this.formInvalid())
  //       message = 'ready';
  //   }
  //   else if(this.user && !this.balances)
  //     message = "LOADING BALANCE"
  //   else if(!message)
  //     message = 'connect wallet';
  //   return message
  // }

  isError(): boolean {
    if (
      this.mainButtonText() == "Select" ||
      this.mainButtonText() == "Connect wallet" ||
      this.mainButtonText() == "Enter an amount" ||
      this.mainButtonText() == "Ready" ||
      this.mainButtonText() == "LOADING BALANCE" ||
      this.mainButtonText() == "Maintenance Enabled"
    ) {
      return false;
    }

    return true;
  }

  mainButtonText(): string {
    /** App Lock situation */
    if (this.appLocked) {
      return "Maintenance Enabled";
    }

    /** User Not connected */
    if (!this.user || !this.balances) {
      return "Connect wallet";
    }

    /** Loading balance from the user */
    if (this.user && !this.balances) {
      return "LOADING BALANCE";
    }

    /** THORChain is backed up */
    if (this.queue && this.queue.outbound >= 12) {
      return "THORChain TX QUEUE FILLED";
    }

    /** No target asset selected */
    if (!this.selectedTargetAsset || !this.selectedSourceAsset) {
      return "Select";
    }

    if (this.selectedSourceAsset && this.haltedChains.includes(this.selectedSourceAsset.chain)) {
      return `${this.selectedSourceAsset.chain} Halted`;
    }

    if (this.selectedTargetAsset && this.haltedChains.includes(this.selectedTargetAsset.chain)) {
      return `${this.selectedTargetAsset.chain} Halted`;
    }

    if (
      this.selectedSourceAsset.chain === "THOR" &&
      this.sourceBalance - this.sourceAssetUnit < 0.2
    ) {
      return "Min 0.2 RUNE in Wallet Required";
    }

    if (this.isMaxError) {
      return "Input Amount Less Than Fees";
    }

    /** No source amount set */
    if (!this.sourceAssetUnit) {
      return "Enter an amount";
    }

    /** Output Amount is less than network fees */
    if (
      this.targetAssetUnitDisplay <
      this.outboundFees[assetToString(this.selectedTargetAsset)]
    ) {
      return "Output Amount Less Than Fees";
    }

    if (!this.inboundAddresses) {
      return "Loading";
    }

    /** Source amount is higher than user spendable amount */
    if (
      this.sourceAssetUnit >
      this.userService.maximumSpendableBalance(
        this.selectedSourceAsset,
        this.sourceBalance,
        this.inboundAddresses
      )
    ) {
      return `Insufficient ${this.selectedSourceAsset.chain}.${this.selectedSourceAsset.ticker} balance`;
    }

    /** Input Amount is less than network fees */
    if (
      this.sourceChainBalance <
      1.05 *
        this.inboundFees[
          assetToString(getChainAsset(this.selectedSourceAsset.chain))
        ]
    ) {
      const chainAsset = getChainAsset(this.selectedSourceAsset.chain);
      return `Insufficient ${chainAsset.chain}.${chainAsset.ticker} for Fees`;
    }

    /** Amount is too low, considered "dusting" */
    if (
      this.sourceAssetUnit <=
        this.userService.minimumSpendable(this.selectedSourceAsset) ||
      this.targetAssetUnitDisplay <=
        this.userService.minimumSpendable(this.selectedTargetAsset)
    ) {
      return "Amount too low";
    }

    /** Exceeds slip tolerance set in user settings */
    if (this.slip * 100 > this.slippageTolerance) {
      return "Slip Limit Exceeded";
    }

    /** Good to go */
    if (
      this.user &&
      this.sourceAssetUnit &&
      this.sourceAssetUnit <= this.sourceBalance &&
      this.selectedTargetAsset
    ) {
      return "Ready";
    } else {
      console.warn("error creating main button text");
    }
  }

  swapTextButton() {
    /** CHECK that there is non wallet address that the user wants to send */
    if (this.selectedTargetAsset && this.user) {
      if (this.targetClientAddress && this.targetAddress !== this.targetClientAddress) {
        return `SWAP + RECEIVE AT ${this.targetAddress.substring(0, 6)}...${this.targetAddress.substring(this.targetAddress.length -6, this.targetAddress.length)}`
      }
    }

    return 'SWAP'
  }

  connectWallet() {
    /** Add analytics to the wallet connect */
    this.analytics.event('swap_disconnected', 'button_connect_wallet')
    this.overlaysService.setCurrentSwapView('Connect')
  }

  getBalance() {
    return (
      this.selectedSourceAsset &&
      this.sourceBalance &&
      this.sourceAssetUnit >
        this.userService.maximumSpendableBalance(
          this.selectedSourceAsset,
          this.sourceBalance,
          this.inboundAddresses
        )
    );
  }

  openConfirmationDialog() {
    const output = this.targetAssetUnit.div(10 ** 8);

    let sourceAsset = this.selectableMarkets.find(
      (asset) =>
        `${asset.asset.chain}.${asset.asset.ticker}` ===
        `${this.selectedSourceAsset.chain}.${this.selectedSourceAsset.ticker}`
    );
    let targetAsset = this.selectableMarkets.find(
      (asset) =>
        `${asset.asset.chain}.${asset.asset.ticker}` ===
        `${this.selectedTargetAsset.chain}.${this.selectedTargetAsset.ticker}`
    );

    this.swapData = {
      sourceAsset: sourceAsset,
      targetAsset: targetAsset,
      basePrice: this.basePrice,
      inputValue: this.sourceAssetUnit,
      outputValue: output,
      user: this.user,
      slip: this.slip,
      balance: this.sourceBalance,
      runePrice: this.runePrice,
      networkFeeInSource: this.networkFeeInSource,
      targetAddress: this.targetAddress
    };

    /** This is button analytics */
    this.analytics.event('swap_prepare', `button_swap_*FROM_ASSET*_*TO_ASSET*_usd_*numerical_usd_value*`, this.sourceAssetUnit * this.sourceAssetPrice, assetString(this.selectedSourceAsset), assetString(this.selectedTargetAsset), (this.sourceAssetUnit * this.sourceAssetPrice).toString());
    
    if (this.userService.getTokenAddress(this.user, this.selectedTargetAsset.chain) !== this.targetAddress)
      this.analytics.event('swap_prepare', `button_swap_*FROM_ASSET*_*TO_ASSET*_target_address`, undefined, assetString(this.selectedSourceAsset), assetString(this.selectedTargetAsset));
    
    this.analytics.event('swap_prepare', `button_swap_*FROM_ASSET*_*TO_ASSET*_slip_%_*numerical_%_value*`, this.slip * 100, assetString(this.selectedSourceAsset), assetString(this.selectedTargetAsset), (this.slip * 100).toString());
    
    this.overlaysService.setCurrentSwapView('Confirm');
  }

  updateSwapDetails() {
    if (this.selectedSourceAsset && this.selectedTargetAsset) {
      this.calculateTargetUnits();
    } else {
      this.calculatingTargetAsset = false;
    }

    // Getting the source asset price from selected pools
    if (this.selectableMarkets && this._selectedSourceAsset) {
      this.sourceAssetPrice = this.selectableMarkets.find(
        (pool) =>
          `${pool.asset.chain}.${pool.asset.ticker}` ===
          `${this._selectedSourceAsset.chain}.${this._selectedSourceAsset.ticker}`
      ).assetPriceUSD;
    }

    // Getting the source asset price from selected pools
    if (this.selectableMarkets && this.balances && this._selectedTargetAsset) {
      this.targetAssetPrice = this.selectableMarkets.find(
        (pool) =>
          `${pool.asset.chain}.${pool.asset.ticker}` ===
          `${this._selectedTargetAsset.chain}.${this._selectedTargetAsset.ticker}`
      ).assetPriceUSD;
    }

    if (this.selectableMarkets && this.balances && this._selectedSourceAsset) {
      this.runePrice = this.selectableMarkets.find(
        (asset) => `${asset.asset.chain}.${asset.asset.ticker}` === `THOR.RUNE`
      ).assetPriceUSD;
    }
  }

  async calculateTargetUnits() {
    if (
      this._sourceAssetTokenValue &&
      this.availablePools &&
      this.availablePools.length > 0
    ) {
      const swapType =
        this.isRune(this.selectedSourceAsset) ||
        this.isRune(this.selectedTargetAsset)
          ? SwapType.SINGLE_SWAP
          : SwapType.DOUBLE_SWAP;

      if (swapType === SwapType.SINGLE_SWAP) {
        this.calculateSingleSwap();
      } else if (
        swapType === SwapType.DOUBLE_SWAP &&
        this.availablePools.find(
          (pool) => pool.asset === assetToString(this.selectedTargetAsset)
        ) &&
        this.availablePools.find(
          (pool) => pool.asset === assetToString(this.selectedSourceAsset)
        )
      ) {
        this.calculateDoubleSwap();
      }
    } else {
      this.calculatingTargetAsset = false;
    }
  }

  setMaxError(val) {
    this.isMaxError = val;

    setTimeout(
      () => {
        this.isMaxError = false;
      }
    , 2000)
  }

  reverseTransaction() {
    if (this.selectedSourceAsset && this.selectedTargetAsset) {
      const source = this.selectedSourceAsset;
      const target = this.selectedTargetAsset;
      const targetInput = this.targetAssetUnit;
      const targetBalance = this.targetBalance;

      this.selectedTargetAsset = source;
      this.selectedSourceAsset = target;

      if (targetBalance && targetInput) {
        const max = this.userService.maximumSpendableBalance(
          target,
          targetBalance,
          this.inboundAddresses
        );

        this.sourceAssetUnit =
          targetBalance < targetInput.div(10 ** 8).toNumber() // if target balance is less than target input
            ? max // use balance
            : targetInput.div(10 ** 8).toNumber(); // otherwise use input value
      } else {
        this.sourceAssetUnit = targetInput
          ? targetInput.div(10 ** 8).toNumber()
          : 0;
      }

      this.analytics.event('swap_prepare', 'switch_arrow_send_receive_containers');
    }
  }

  /**
   * When RUNE is one of the assets being exchanged
   * For example RUNE <==> DAI
   */
  calculateSingleSwap() {
    const toRune = this.isRune(this.selectedTargetAsset) ? true : false;

    const poolDetail = toRune
      ? this.availablePools.find(
          (pool) => pool.asset === assetToString(this.selectedSourceAsset)
        )
      : this.availablePools.find(
          (pool) => pool.asset === assetToString(this.selectedTargetAsset)
        );

    if (poolDetail) {
      const pool: PoolData = {
        assetBalance: baseAmount(poolDetail.assetDepth),
        runeBalance: baseAmount(poolDetail.runeDepth),
      };

      /**
       * TO SHOW BASE PRICE
       */

      const valueOfRuneInAsset = getValueOfRuneInAsset(
        assetToBase(assetAmount(1)),
        pool
      );
      const valueOfAssetInRune = getValueOfAssetInRune(
        assetToBase(assetAmount(1)),
        pool
      );

      const basePrice = toRune ? valueOfRuneInAsset : valueOfAssetInRune;
      this.basePrice = basePrice
        .amount()
        .div(10 ** 8)
        .toNumber();

      /**
       * Slip percentage using original input
       */
      const slip = getSwapSlip(this._sourceAssetTokenValue, pool, toRune);
      this.slip = slip.toNumber();

      const inboundFee =
        this.inboundFees[assetToString(this.selectedSourceAsset)];
      const outboundFee =
        this.outboundFees[assetToString(this.selectedTargetAsset)];
      const outboundFeeInSourceVal = this.basePrice * outboundFee;

      this.networkFeeInSource = inboundFee + outboundFeeInSourceVal;

      /**
       * Total output amount in target units minus RUNE Fee
       */
      const swapOutput = getSwapOutput(
        baseAmount(
          this._sourceAssetTokenValue
            .amount()
            .minus(assetToBase(assetAmount(inboundFee)).amount())
        ),
        pool,
        toRune
      );

      // sub
      const totalAmount = baseAmount(
        swapOutput
          .amount()
          .minus(assetToBase(assetAmount(outboundFee)).amount())
      );

      if (this.sourceAssetUnit) {
        this.targetAssetUnit = totalAmount.amount().isLessThan(0)
          ? bn(0)
          : totalAmount.amount();
      } else {
        this.targetAssetUnit = this.sourceAssetUnit
          ? totalAmount.amount().isLessThan(0)
            ? bn(0)
            : totalAmount.amount()
          : null;
      }
    }

    this.calculatingTargetAsset = false;
  }

  /**
   * Asset <==> Asset
   * RUNE is not being directly exchanged
   * For example DAI <==> BUSD
   */
  calculateDoubleSwap() {
    const sourcePool = this.availablePools.find(
      (pool) => pool.asset === assetToString(this.selectedSourceAsset)
    );
    const targetPool = this.availablePools.find(
      (pool) => pool.asset === assetToString(this.selectedTargetAsset)
    );

    if (sourcePool && targetPool) {
      const pool1: PoolData = {
        assetBalance: baseAmount(sourcePool.assetDepth),
        runeBalance: baseAmount(sourcePool.runeDepth),
      };
      const pool2: PoolData = {
        assetBalance: baseAmount(targetPool.assetDepth),
        runeBalance: baseAmount(targetPool.runeDepth),
      };

      this.inputNetworkFee = this.txUtilsService.calculateNetworkFee(
        this.selectedSourceAsset,
        this.inboundAddresses,
        "INBOUND",
        sourcePool
      );
      this.outputNetworkFee = this.txUtilsService.calculateNetworkFee(
        this.selectedTargetAsset,
        this.inboundAddresses,
        "OUTBOUND",
        targetPool
      );

      const basePrice = getDoubleSwapOutput(
        assetToBase(assetAmount(1)),
        pool2,
        pool1
      );
      this.basePrice = basePrice
        .amount()
        .div(10 ** 8)
        .toNumber();

      const outboundFeeInSourceVal = this.basePrice * this.outputNetworkFee;
      this.networkFeeInSource = this.inputNetworkFee + outboundFeeInSourceVal;

      const slip = getDoubleSwapSlip(this._sourceAssetTokenValue, pool1, pool2);
      this.slip = slip.toNumber();

      const total = getDoubleSwapOutput(
        baseAmount(
          this._sourceAssetTokenValue
            .amount()
            .minus(assetToBase(assetAmount(this.inputNetworkFee)).amount())
        ),
        pool1,
        pool2
      )
        .amount()
        .minus(assetToBase(assetAmount(this.outputNetworkFee)).amount());

      if (this.sourceAssetUnit) {
        this.targetAssetUnit = total.isLessThan(0) ? bn(0) : total;
      } else {
        this.targetAssetUnit = null;
      }
    }

    this.calculatingTargetAsset = false;
  }

  ngOnDestroy() {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }
  }
}
