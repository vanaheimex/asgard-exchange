import { Component, Output, EventEmitter, Input } from '@angular/core';
import { Chain } from '@xchainjs/xchain-util';
import { User } from 'src/app/_classes/user';
import { OverlaysService } from 'src/app/_services/overlays.service';
import { UserService } from 'src/app/_services/user.service';

@Component({
  selector: 'app-update-target-address-modal',
  templateUrl: './update-target-address-modal.component.html',
  styleUrls: ['./update-target-address-modal.component.scss'],
})
export class UpdateTargetAddressModalComponent {
  @Output() back: EventEmitter<string> = new EventEmitter<string>();
  @Input() data: any;
  targetAddress: string;
  user: User;
  chain: Chain;

  constructor(
    private userService: UserService,
    private oveService: OverlaysService
  ) {}

  ngOnInit() {
    this.user = this.data?.user ?? null;
    this.chain = this.data?.chain ?? null;
    this.targetAddress = this.data?.targetAddress ?? '';
  }

  updateAddress() {
    if (!this.user?.clients) {
      return;
    }

    const client = this.userService.getChainClient(this.user, this.chain);
    if (!client) {
      return;
    }

    if (!client.validateAddress(this.targetAddress)) {
      return;
    }

    this.close();
  }

  formDisabled(): boolean {
    if (!this.user?.clients) {
      return true;
    }

    const client = this.userService.getChainClient(this.user, this.chain);
    if (!client) {
      return true;
    }

    if (!client.validateAddress(this.targetAddress)) {
      return true;
    }

    return false;
  }

  updateAddressBtnText() {
    if (!this.user?.clients) {
      return 'No User found';
    }

    const client = this.userService.getChainClient(this.user, this.chain);
    if (!client) {
      return `No ${this.chain} Client Found`;
    }

    if (!client.validateAddress(this.targetAddress)) {
      return `Invalid ${this.chain} Address`;
    }

    return 'PREPARE';
  }

  close() {
    this.back.emit(this.targetAddress);
    this.oveService.setCurrentSwapView('Swap');
  }

  backEmit() {
    this.oveService.setCurrentSwapView('Swap');
  }
}
