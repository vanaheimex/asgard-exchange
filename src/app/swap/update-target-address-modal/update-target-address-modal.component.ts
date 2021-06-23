import { Component, Output, EventEmitter, Input } from '@angular/core';
import { Chain } from '@xchainjs/xchain-util';
import { User } from 'src/app/_classes/user';
import { AnalyticsService } from 'src/app/_services/analytics.service';
import {
  MainViewsEnum,
  OverlaysService,
} from 'src/app/_services/overlays.service';
import { MockClientService } from 'src/app/_services/mock-client.service';
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
  thorAddress: string = undefined;

  constructor(
    private userService: UserService,
    private oveService: OverlaysService,
    private analytics: AnalyticsService,
    private mockClientService: MockClientService
  ) {}

  ngOnInit() {
    this.user = this.data?.user ?? null;
    this.chain = this.data?.chain ?? null;
    this.targetAddress = this.data?.targetAddress ?? '';

    //For events
    this.thorAddress =
      this.userService.getTokenAddress(this.user, 'THOR') ?? undefined;
  }

  breadcurmbNav(val: string) {
    if (val === 'skip') {
      this.analytics.event(
        'swap_receive_container_target_address_select',
        'breadcrumb_skip'
      );
      this.oveService.setViews(MainViewsEnum.Swap, 'Swap');
    } else if (val === 'swap') {
      this.analytics.event(
        'swap_receive_container_target_address_select',
        'breadcrumb_swap'
      );
      this.oveService.setViews(MainViewsEnum.Swap, 'Swap');
    }
  }

  updateAddress() {
    if (
      !this.mockClientService
        .getMockClientByChain(this.chain)
        .validateAddress(this.targetAddress)
    ) {
      return;
    }

    if (this.targetAddress !== this.data.targetAddress)
      this.analytics.event(
        'swap_receive_container_target_address_select',
        'button_target_address_save_changed'
      );
    else
      this.analytics.event(
        'swap_receive_container_target_address_select',
        'button_target_address_save'
      );

    this.close();
  }

  formDisabled(): boolean {
    if (!this.user) {
      return true;
    }

    if (
      !this.mockClientService
        .getMockClientByChain(this.chain)
        .validateAddress(this.targetAddress)
    ) {
      return true;
    }

    return false;
  }

  updateAddressBtnText() {
    if (!this.user?.clients) {
      return { text: 'No User found', isError: true };
    }

    const client = this.userService.getChainClient(this.user, this.chain);
    if (!client) {
      return { text: `No ${this.chain} Client Found`, isError: false };
    }

    if (!client.validateAddress(this.targetAddress)) {
      return { text: `Invalid ${this.chain} Address`, isError: true };
    }

    if (!this.user) {
      return 'No User found';
    }

    if (
      !this.mockClientService
        .getMockClientByChain(this.chain)
        .validateAddress(this.targetAddress)
    ) {
      return `Invalid ${this.chain} Address`;
    }

    return { text: 'PREPARE', isError: false };
  }

  close() {
    /** because this is only a component in swap page so the analytics are static */
    this.back.emit(this.targetAddress);
    this.oveService.setCurrentSwapView('Swap');
  }

  backEmit() {
    this.analytics.event(
      'swap_receive_container_target_address_select',
      'button_target_address_cancel'
    );
    this.oveService.setCurrentSwapView('Swap');
  }
}
