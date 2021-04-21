import { Component, Inject, Input, OnDestroy, OnInit, Output, EventEmitter } from '@angular/core';
import { Asset as xchainAsset, baseAmount, bn } from '@xchainjs/xchain-util';
import { ethers } from 'ethers';
import { Subscription, combineLatest } from 'rxjs';
import { Asset } from 'src/app/_classes/asset';
import { PoolAddressDTO } from 'src/app/_classes/pool-address';
import { User } from 'src/app/_classes/user';
import { CopyService } from 'src/app/_services/copy.service';
import { EthUtilsService } from 'src/app/_services/eth-utils.service';
import { MidgardService } from 'src/app/_services/midgard.service';
import { OverlaysService } from 'src/app/_services/overlays.service';
import { TransactionStatusService } from 'src/app/_services/transaction-status.service';
import { UserService } from 'src/app/_services/user.service';

export type ApproveEthContractModalParams = {
  contractAddress: string;
  asset: xchainAsset;
};

@Component({
  selector: 'app-approve-eth-contract-modal',
  templateUrl: './approve-eth-contract-modal.component.html',
  styleUrls: ['./approve-eth-contract-modal.component.scss']
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

  constructor(
    private userService: UserService,
    private txStatusService: TransactionStatusService,
    private ethUtilsService: EthUtilsService,
    private midgardService: MidgardService,
    private overlaysService: OverlaysService,
    private copySerivce: CopyService
  ) {
    this.loading = true;
    this.insufficientEthBalance = false;
    this.subs = [];
  }

  ngOnInit(): void {

    const user$ = this.userService.user$;
    const balances$ = this.userService.userBalances$;
    const inboundAddresses$ = this.midgardService.getInboundAddresses();

    const combined = combineLatest([user$, balances$, inboundAddresses$]);

    const sub = combined.subscribe(([user, balances, inboundAddresses]) => {
      this.user = user;
      this.ethBalance = this.userService.findBalance(balances, new Asset('ETH.ETH'));
      this.estimateApprovalFee(inboundAddresses);
    });


    this.subs.push(sub);
  }

  async estimateApprovalFee(addresses: PoolAddressDTO[]) {
    const ethInboundAddress = addresses.find( (address) => address.chain === 'ETH' );
    const { asset, contractAddress } = this.data;
    const assetAddress = asset.symbol.slice(asset.ticker.length + 1);
    const strip0x = assetAddress.substr(2);

    if (!ethInboundAddress) {
      console.error('no eth inbound address found');
      return;
    }

    if (!this.user) {
      console.error('no user found');
      return;
    }

    try {
      const fee = await this.user.clients.ethereum.estimateApprove({
        spender: contractAddress,
        sender: strip0x,
        amount: baseAmount(bn(2).pow(96).minus(1))
      });
      this.fee = ethers.utils.formatEther(fee.toString());
      this.insufficientEthBalance = (+this.fee) > this.ethBalance;
    } catch (error) {
      console.error('error estimating approve fee: ', error);
    }

    this.loading = false;
  }

  async approve() {

    this.loading = true;

    if (this.data.contractAddress && this.user && this.data.asset) {
      const asset = this.data.asset;
      const contractAddress = this.data.contractAddress;

      const assetAddress = asset.symbol.slice(asset.ticker.length + 1);
      const strip0x = assetAddress.substr(2);
      const approve = await this.user.clients.ethereum.approve({
        spender: contractAddress,
        sender: strip0x,
        amount: baseAmount(bn(2).pow(96).minus(1)),
        feeOptionKey: 'fast'
      });

      this.txStatusService.pollEthContractApproval(approve.hash);
      // this.dialogRef.close(approve.hash);
      this.approvedHash.emit(approve.hash);
      this.overlaysService.setCurrentCreatePoolView('Create');
    }

    this.loading = false;

  }

  closeDialog() {
    this.overlaysService.setCurrentCreatePoolView('Create');
    // this.dialogRef.close();
  }

  copyToClipboard() {
    let res = this.copySerivce.copyToClipboard(this.data.contractAddress);
    if (res)
      this.copied = true;
  }

  ngOnDestroy() {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }
  }

}
