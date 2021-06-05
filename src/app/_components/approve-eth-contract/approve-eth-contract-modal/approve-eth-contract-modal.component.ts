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
import { CopyService } from "src/app/_services/copy.service";
import { EthUtilsService } from "src/app/_services/eth-utils.service";
import { ExplorerPathsService } from "src/app/_services/explorer-paths.service";
import { MidgardService } from "src/app/_services/midgard.service";
import { OverlaysService } from "src/app/_services/overlays.service";
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

  //the new reskin data importing
  copied: boolean = false;
  @Input() data: ApproveEthContractModalParams;
  @Output() approvedHash = new EventEmitter<string>();
  @Output() close = new EventEmitter<null>();

  //breadcurmb path
  path: Path[];
  @Input() mode: "deposit" | "swap" | "create pool" = "swap";

  constructor(
    private userService: UserService,
    private txStatusService: TransactionStatusService,
    private midgardService: MidgardService,
    private copySerivce: CopyService,
    private explorerPathsService: ExplorerPathsService
  ) {
    this.loading = true;
    this.insufficientEthBalance = false;
    this.subs = [];
  }

  ngOnInit(): void {
    const user$ = this.userService.user$;
    const balances$ = this.userService.userBalances$;

    this.path = [{ name: "vanaheimex", swapView: "Swap", mainView: "Swap" }];
    if (this.mode == "swap") {
      this.path.push(
        { name: "Swap", disable: false, call: "back" },
        { name: "Contract", disable: true }
      );
    } else if (this.mode == "create pool") {
      this.path.push(
        { name: "Pools", disable: false, call: "back" },
        { name: "Create", disable: true },
        { name: "Contract", disable: true }
      );
    } else if (this.mode == "deposit") {
      this.path.push(
        { name: "Deposit", disable: false, call: "back" },
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

      this.loading = false;
    });

    this.subs.push(sub);
  }

  back(val): void {
    if (val == "back") this.closeDialog();
  }

  async approve() {
    this.loading = true;

    if (this.data.contractAddress && this.user && this.data.asset) {
      const asset = this.data.asset;
      const contractAddress = this.data.contractAddress;

      const assetAddress = asset.symbol.slice(asset.ticker.length + 1);
      const strip0x = assetAddress.substr(2);
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
      this.closeDialog();
    }

    this.loading = false;
  }

  closeDialog() {
    this.close.emit();
  }

  explorerPath(): string {
    return `${this.explorerPathsService.ethereumExplorerUrl}/address/${this.data.contractAddress}`;
  }

  copyToClipboard() {
    let res = this.copySerivce.copyToClipboard(this.data.contractAddress);
    if (res) this.copied = true;
  }

  ngOnDestroy() {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }
  }
}
