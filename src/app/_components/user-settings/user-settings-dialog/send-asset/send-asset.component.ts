import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { address } from 'bitcoinjs-lib';
import { Subscription } from 'rxjs';
import { AssetAndBalance } from 'src/app/_classes/asset-and-balance';
import { User } from 'src/app/_classes/user';
import { OverlaysService } from 'src/app/_services/overlays.service';
import { UserService } from 'src/app/_services/user.service';

@Component({
  selector: 'app-send-asset',
  templateUrl: './send-asset.component.html',
  styleUrls: ['./send-asset.component.scss']
})
export class SendAssetComponent implements OnInit, OnDestroy {

  @Output() back: EventEmitter<null>;
  @Output() confirmSend: EventEmitter<{amount: number, recipientAddress: string}>;
  @Input() asset: AssetAndBalance;

  message: string;

  get amount() {
    return this._amount;
  }
  set amount(val: number) {
    this._amount = val;
    if (!val)
      this._amount = 0;
    this.checkSpendable();
  }
  private _amount: number;
  _recipientAddress: string;
  balance: number;
  amountSpendable: boolean;
  user: User;
  subs: Subscription[];
  explorerPath: string;
  address: string;

  get recipientAddress() {
    return this._recipientAddress;
  }
  set recipientAddress(val: string) {
    if (val !== this._recipientAddress) {
      this._recipientAddress = val;
    }
  }

  constructor(private userService: UserService, private overlaysService: OverlaysService) {
    this.recipientAddress = '';
    this.back = new EventEmitter<null>();
    this.confirmSend = new EventEmitter<{amount: number, recipientAddress: string}>();
    this.amountSpendable = false;
    this.message = 'prepare';
  }

  ngOnInit(): void {

    if (this.asset) {

      const balances$ = this.userService.userBalances$.subscribe(
        (balances) => {
          this.balance = this.userService.findBalance(balances, this.asset.asset);
        }
      );

      const user$ = this.userService.user$.subscribe(
        (user) => {
          this.user = user;
        }
      );

      this.subs = [balances$, user$];
      const client = this.userService.getChainClient(this.user, this.asset.asset.chain);
      console.log(client.getAddress())
    }

  }

  nextDisabled(): boolean {

    if (!this.user) {
      return true;
    }

    if (!this.asset) {
      return true;
    }

    const client = this.userService.getChainClient(this.user, this.asset.asset.chain);
    if (!client) {
      return true;
    }

    return !this.amountSpendable
      || !client.validateAddress(this.recipientAddress)
      || this.amount <= 0;
  }

  mainButtonText(): string {

    if (!this.user) {
      return 'Connect Wallet';
    }

    if (!this.asset) {
      return 'Prepare';
    }

    const client = this.userService.getChainClient(this.user, this.asset.asset.chain);
    if (!client) {
      return `No ${this.asset.asset.chain} Client Found`;
    }

    if (this.amount <= 0 || (this.recipientAddress && this.recipientAddress.length <= 10) ) {
      return 'Prepare';
    }

    if (!client.validateAddress(this.recipientAddress) &&  client.getAddress() === this.recipientAddress) {
      return `Invalid ${this.asset.asset.chain} Address`;
    }

    if (!this.amountSpendable) {
      return 'Amount not spendable';
    }

    return 'Ready';

  }

  isError(): boolean {

    if (!this.user) {
      return false;
    }

    if (!this.asset) {
      return false;
    }

    const client = this.userService.getChainClient(this.user, this.asset.asset.chain);
    if (!client) {
      return true;
    }

    if (this.amount <= 0 || (this.recipientAddress && this.recipientAddress.length <= 10)) {
      return false;
    }

    if (!client.validateAddress(this.recipientAddress) &&  client.getAddress() !== this.recipientAddress) {
      return true;
    }

    if (!this.amountSpendable) {
      return true;
    }

    return false;

  }

  checkSpendable(): void {
    const maximumSpendableBalance = this.userService.maximumSpendableBalance(this.asset.asset, this.balance);
    this.amountSpendable = (this.amount <= maximumSpendableBalance);
    console.log('amount', this.amount)
    console.log('max spend', maximumSpendableBalance)
    this.message = this.amount > 0 && this.amountSpendable && this.recipientAddress.length > 12 ? 'ready' : 'prepare';
  }

  async navCaller(nav) {
    this.address = await this.userService.getAdrressChain(this.asset.asset.chain);

    if (nav === 'wallet')
      this.overlaysService.setCurrentUserView({userView: 'Addresses', address: null, chain: null, asset: null});
    else if (nav === 'chain')
      this.overlaysService.setCurrentUserView({userView: 'Address', address: this.address, chain: this.asset.asset.chain, asset: null})
    else if (nav === 'asset')
      this.overlaysService.setCurrentUserView({userView: 'Address', address: this.address, chain: this.asset.asset.chain, asset: this.asset})
  }

  ngOnDestroy() {
    for (const sub of this.subs) {
      sub.unsubscribe();
    }
  }

}
