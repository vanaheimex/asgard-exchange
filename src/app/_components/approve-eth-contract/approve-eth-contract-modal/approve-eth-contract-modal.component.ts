import {
  Component,
  Inject,
  Input,
  OnDestroy,
  OnInit,
  Output,
  EventEmitter,
} from "@angular/core";
import { Asset as xchainAsset, baseAmount, bn } from "@xchainjs/xchain-util";
import { ethers } from "ethers";
import { Subscription, combineLatest } from "rxjs";
import { Asset } from "src/app/_classes/asset";
import { PoolAddressDTO } from "src/app/_classes/pool-address";
import { User } from "src/app/_classes/user";
import { AnalyticsService } from "src/app/_services/analytics.service";
import { CopyService } from "src/app/_services/copy.service";
import { EthUtilsService } from "src/app/_services/eth-utils.service";
import { ExplorerPathsService } from "src/app/_services/explorer-paths.service";
import { MidgardService } from "src/app/_services/midgard.service";
import { MainViewsEnum, OverlaysService } from "src/app/_services/overlays.service";
import { TransactionStatusService } from "src/app/_services/transaction-status.service";
import { UserService } from "src/app/_services/user.service";
import { Path } from "../../breadcrumb/breadcrumb.component";

export type ApproveEthContractModalParams = {
  contractAddress: string;
  asset: xchainAsset;
};

@Component({
  selector: "app-approve-eth-contract-modal",
  templateUrl: "./approve-eth-contract-modal.component.html",
  styleUrls: ["./approve-eth-contract-modal.component.scss"],
})
export class ApproveEthContractModalComponent implements OnInit, OnDestroy {
  user: User;
  subs: Subscription[];
  loading: boolean;
  fee: string;
  ethBalance: number;
  insufficientEthBalance: boolean;
  message: {text: string, isError: boolean};

  //the new reskin data importing
  copied: boolean = false;
  @Input() data: ApproveEthContractModalParams;
  @Output() approvedHash = new EventEmitter<string>();
  @Output() close = new EventEmitter<null>();

  @Input() eventCategory: string = "contract_approve";

  //breadcurmb path
  path: Path[];
  @Input() mode: "deposit" | "swap" | "create pool" = "swap";

  constructor(
    private userService: UserService,
    private txStatusService: TransactionStatusService,
    private midgardService: MidgardService,
    private copySerivce: CopyService,
    private explorerPathsService: ExplorerPathsService,
    private overlaysService: OverlaysService,
    private analytics: AnalyticsService
  ) {
    this.loading = true;
    this.insufficientEthBalance = false;
    this.subs = [];
  }

  ngOnInit(): void {
    const user$ = this.userService.user$;
    const balances$ = this.userService.userBalances$;

    this.path = [{ name: 'skip', call: 'skip' }];
    if (this.mode == "swap") {
      this.path.push(
        { name: "Swap", disable: false, call: "main" },
        { name: "Contract", disable: true }
      );
    } else if (this.mode == "create pool") {
      this.path.push(
        { name: "Pools", disable: false, call: "main" },
        { name: "Create", disable: false, call: "back" },
        { name: "Contract", disable: true }
      );
    } else if (this.mode == "deposit") {
      this.path.push(
        { name: "Deposit", disable: false, call: "main" },
        { name: "Contract", disable: true }
      );
    }

    const combined = combineLatest([user$, balances$]);

    const sub = combined.subscribe(([user, balances]) => {
      this.user = user;
      this.ethBalance = this.userService.findBalance(
        balances,
        new Asset("ETH.ETH")
      );
      this.insufficientEthBalance ? this.ethBalance == 0 : false;
      if (this.insufficientEthBalance)
        this.message = {text: 'Insufficient ETH.ETH balance', isError: true}
      else
        this.message = {text: "Approve", isError: false}
      this.loading = false;
    });

    this.subs.push(sub);
  }

  back(val): void {
    if (val == 'skip') {
      this.analytics.event(this.eventCategory, 'breadcrumb_skip');
      this.overlaysService.setViews(MainViewsEnum.Swap, "Swap");
    }
    else if (val == 'main') {
      this.analytics.event(this.eventCategory, 'breadcrumb_main_page');
      this.overlaysService.setViews(MainViewsEnum.Swap, "Swap");
    }
    else if (val == "back") {
      this.analytics.event(this.eventCategory, 'breadcrumb_create');
      this.closeDialog();
    }
  }

  async approve() {
    this.loading = true;

    if (this.data.contractAddress && this.user && this.data.asset) {
      const asset = this.data.asset;
      const contractAddress = this.data.contractAddress;

      const assetAddress = asset.symbol.slice(asset.ticker.length + 1);
      const strip0x = assetAddress.substr(2);
      try {
        const approve = await this.user.clients.ethereum.approve({
          walletIndex: 0,
          spender: contractAddress,
          sender: strip0x,
          amount: baseAmount(bn(2).pow(96).minus(1)),
          feeOptionKey: "fast",
        });

        this.txStatusService.pollEthContractApproval(approve.hash);
        // this.dialogRef.close(approve.hash);
        this.approvedHash.emit(approve.hash);
        this.analytics.event(this.eventCategory, 'button_approve_*ASSET*_*CONTRACT_ADDRESS*', undefined, `${this.data.asset.chain}.${this.data.asset.ticker}`, this.data.contractAddress)
        this.closeDialog();
      }
      catch(error) {
        this.message.text = error.message;
        this.message.isError = true;
      }
    }

    this.loading = false;
  }

  closeDialog() {
    this.analytics.event('pool_create_approve_contract', 'button_cancel');
    this.close.emit();
  }

  explorerPath(): string {
    return `${this.explorerPathsService.ethereumExplorerUrl}/address/${this.data.contractAddress}`;
  }

  exploreEvent() { 
    this.analytics.event(this.eventCategory, 'tag_txid_explore_*ASSET*_*CONTRACT_ADDRESS*', undefined, this.data.contractAddress);
  }

  copyToClipboard() {
    this.analytics.event(this.eventCategory, 'tag_txid_copy_*ASSET*_*CONTRACT_ADDRESS*', undefined, this.data.contractAddress);
    let res = this.copySerivce.copyToClipboard(this.data.contractAddress);
    if (res) this.copied = true;
  }

  ngOnDestroy() {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }
  }
}
