import { Component, EventEmitter, Input, OnInit, Output } from "@angular/core";
import { assetToString, baseAmount, baseToAsset, Chain } from "@xchainjs/xchain-util";
import { AssetAndBalance } from "src/app/_classes/asset-and-balance";
import { CopyService } from "src/app/_services/copy.service";
import { ExplorerPathsService } from "src/app/_services/explorer-paths.service";
import BigNumber from "bignumber.js";
import { UserService } from "src/app/_services/user.service";
import { Balances } from "@xchainjs/xchain-client";
import { Subscription } from "rxjs";
import { environment } from "src/environments/environment";
import { AnalyticsService, assetString } from "src/app/_services/analytics.service";

@Component({
  selector: "app-transaction-success-modal",
  templateUrl: "./transaction-success-modal.component.html",
  styleUrls: ["./transaction-success-modal.component.scss"],
})
export class TransactionSuccessModalComponent {
  @Input() chain: Chain;
  @Input() hash: string;
  // @Input() tx: Tx;
  // @Input() label: string;
  @Input() externalTx: boolean = false; // not Thorchain
  @Output() closeDialog: EventEmitter<null>;

  //added by the new reskin
  @Input() modalType: 'SWAP' | 'DEPOSIT' | 'WITHDRAW' | 'SEND' | 'UPGRADE';
  @Input() asset: Array<AssetAndBalance>;
  @Input() label: Array<string>;
  @Input() amount: Array<number | BigNumber>;
  @Input() recipientAddress: string;
  @Input() percentage: number;
  @Input() isPlus: boolean = false;
  @Input() hasOutbound: boolean = false;
  @Input() hashOutbound: string = "";
  @Input() targetAddress?: string;

  binanceExplorerUrl: string;
  bitcoinExplorerUrl: string;
  ethereumExplorerUrl: string;
  thorchainExplorerUrl: string;
  litecoinExplorerUrl: string;
  bchExplorerUrl: string;
  balances: Balances;
  sourceBalance: number;
  targetBalance: number;
  subs: Subscription[];
  copied: boolean = false;
  copiedOutbound: boolean = false;

  constructor(
    private explorerPathsService: ExplorerPathsService,
    private copyService: CopyService,
    private userService: UserService,
    private analyticsService: AnalyticsService
  ) {
    this.closeDialog = new EventEmitter<null>();
    this.binanceExplorerUrl = `${this.explorerPathsService.binanceExplorerUrl}/tx`;
    this.bitcoinExplorerUrl = `${this.explorerPathsService.bitcoinExplorerUrl}/tx`;
    this.ethereumExplorerUrl = `${this.explorerPathsService.ethereumExplorerUrl}/tx`;
    this.thorchainExplorerUrl = `${this.explorerPathsService.thorchainExplorerUrl}/txs`;
    this.litecoinExplorerUrl = `${this.explorerPathsService.litecoinExplorerUrl}`;
    this.bchExplorerUrl = `${this.explorerPathsService.bchExplorerUrl}/tx`;
  }

  copyToClipboard(val?: string, copyOutbound?: boolean) {
    let result;
    if (val)
      result = this.copyService.copyToClipboard(
        this.asset[1].asset.chain === "ETH" ? "0x" + val : val
      );
    else
      result = this.copyService.copyToClipboard(
        this.chain === "ETH" ? "0x" + this.hash : this.hash
      );

    if (result) {
      if (copyOutbound) {
        this.copiedOutbound = true;
        setTimeout(() => {
          this.copiedOutbound = false;
        }, 3000);
        if (this.modalType === 'SWAP') {
          this.analyticsService.event('swap_success', `tag_outbound_txid_copy_*ASSET*`, undefined, assetString(this.asset[1].asset));
        }
      } else {
        this.copied = true;
        setTimeout(() => {
          this.copied = false;
        }, 3000);
        if (this.modalType === 'SWAP') {
          if (this.hasOutbound)
            this.analyticsService.event('swap_success', `tag_inbound_txid_copy_*POOL_ASSET*`, undefined, assetString(this.asset[0].asset));
          else
            this.analyticsService.event('swap_success', "tag_txid_copy_*FROM_ASSET*_*TO_ASSET*", undefined, assetString(this.asset[0].asset), assetString(this.asset[1].asset));
        }
        else if (this.modalType === 'DEPOSIT') {
          this.analyticsService.event('pool_deposit_symmetrical_success', 'tag_txid_copy_*POOL_ASSET*', undefined, assetString(this.asset[0].asset))
        } 
        else if (this.modalType === 'WITHDRAW') {
          this.analyticsService.event('pool_withdraw_symmetrical_success', 'tag_txid_copy_*POOL_ASSET*', undefined, assetString(this.asset[0].asset))
        }
        else if (this.modalType === 'UPGRADE') {
          this.analyticsService.event('upgrade_success', 'tag_txid_copy_*FROM_ASSET*', undefined, assetString(this.asset[0].asset))
        }
        else if (this.modalType === 'SEND') {
          this.analyticsService.event('wallet_asset_send_success', 'tag_txid_copy_*WALLET*_*ASSET*_*FROM_ADDRESS*_*TO_ADDRESS*', undefined, this.asset[0].asset.chain, assetString(this.asset[0].asset), this.userService.getAdrressChain(this.asset[0].asset.chain),this.recipientAddress)
        }
      }
    }
  }

  explorerPath(hash: string = this.hash, chain: Chain = this.chain): string {
    if (this.externalTx) chain = "THOR";

    if (chain === "THOR") {
      return this.thorchainExplorerUrl + "/" + hash;
    } else if (chain === "ETH") {
      return `${this.ethereumExplorerUrl}/0x${hash}`;
    } else {
      return this.explorerUrl(chain) + "/" + hash;
    }
  }

  viewBlockPath(hash: string): string {
    let path = `https://viewblock.io/thorchain/tx/${hash}`;
    if (environment.network === "testnet") {
      path += "?network=testnet";
    }
    return path;
  }

  explorerUrl(chain: string): string {
    switch (chain) {
      case "BTC":
        return this.bitcoinExplorerUrl;

      case "BNB":
        return this.binanceExplorerUrl;

      case "THOR":
        return this.thorchainExplorerUrl;

      case "ETH":
        return this.ethereumExplorerUrl;

      case "LTC":
        return this.litecoinExplorerUrl;

      case "BCH":
        return this.bchExplorerUrl;

      default:
        return "";
    }
  }

  ngOnInit(): void {
    if (this.amount[1] && !(this.amount[1] instanceof Number)) {
      this.amount[1] = Number(this.amount[1].toPrecision());
    }

    //get balance of the new
    this.asset.forEach((asset) => {
      this.userService.fetchBalance(asset.asset.chain);
    });

    const balances$ = this.userService.userBalances$.subscribe((balances) => {
      if (balances) {
        this.balances = balances;
        this.sourceBalance = this.userService.findBalance(
          this.balances,
          this.asset[0].asset
        );
        if (this.asset[1]) {
          this.targetBalance = this.userService.findBalance(
            this.balances,
            this.asset[1].asset
          );
        }
      }
    });

    if (this.modalType === 'SWAP' && this.hash) {
      this.analyticsService.event('swap_success', `tag_send_container_wallet_*ASSET*`, undefined, assetString(this.asset[0].asset))
    }

    this.subs = [balances$];
  }

  txEventClick(type: 'inbound' | 'outbound' | 'none_inbound' | 'none_outbound' | 'none' = 'none') {
    if (type === 'inbound') {
      this.analyticsService.event('swap_success', `tag_inbound_txid_explore_*ASSET*`, undefined, assetString(this.asset[0].asset));
    }
    else if (type === 'outbound') {
      this.analyticsService.event('swap_success', `tag_outbound_txid_explore_*ASSET*`, undefined, assetString(this.asset[1].asset));
    }
    else if (type === 'none_inbound') {
      this.analyticsService.event('swap_success', `tag_txid_explore_*FROM_ASSET*`, undefined, assetString(this.asset[0].asset));
    }
    else if (type === 'none_outbound') {
      this.analyticsService.event('swap_success', `tag_txid_explore_*TO_ASSET*`, undefined, assetString(this.asset[1].asset));
    }
    else if (type === 'none') {
      if (this.modalType === 'SEND') {
        this.analyticsService.event('wallet_asset_send_success', "tag_txid_explore_*WALLET*_*ASSET*_*FROM_ADDRESS*_*TO_ADDRESS*", undefined, this.asset[0].asset.chain, assetString(this.asset[0].asset), this.userService.getAdrressChain(this.asset[0].asset.chain), this.recipientAddress);
      }
      else if (this.modalType === 'DEPOSIT') {
        this.analyticsService.event('pool_deposit_symmetrical_success', 'tag_txid_explore_*POOL_ASSET*', undefined, assetString(this.asset[0].asset));
      }
      else if (this.modalType === 'WITHDRAW') {
        this.analyticsService.event('pool_withdraw_symmetrical_success', 'tag_txid_explore_*POOL_ASSET*', undefined, assetString(this.asset[0].asset));
      }
      else if (this.modalType === 'UPGRADE') {
        this.analyticsService.event('upgrade_success', 'tag_txid_explore_*FROM_ASSET*', undefined, assetString(this.asset[0].asset));
      }
    }
  }

  close() {
    if (this.modalType === 'SWAP') {
      this.analyticsService.event('swap_success', 'button_close');
    }
    else if (this.modalType === 'DEPOSIT') {
      this.analyticsService.event('pool_withdraw_symmetrical_success', 'button_close');
    }
    else if (this.modalType === 'SEND') {
      this.analyticsService.event('wallet_asset_send_success', 'button_close');
    }
    else if (this.modalType === 'WITHDRAW') {
      this.analyticsService.event('pool_withdraw_symmetrical_success', 'button_close');
    }
    else if (this.modalType === 'UPGRADE') {
      this.analyticsService.event('upgrade_success', 'button_close');
    }

    this.closeDialog.emit()
  }

  ngOnDestroy(): void {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }

    if (this.modalType === 'SWAP')
      this.analyticsService.eventEmitter('swap_success_close', 'swap_page', `${assetToString(this.asset[0].asset)}_${assetToString(this.asset[1].asset)}`);
  }
}
