import { Component, OnInit, Output, EventEmitter } from "@angular/core";
import { Subscription } from "rxjs";
import { AnalyticsService } from "src/app/_services/analytics.service";
import { MainViewsEnum, OverlaysService } from "src/app/_services/overlays.service";
import { UserService } from "src/app/_services/user.service";
import { XDEFIService } from "src/app/_services/xdefi.service";
import { environment } from "src/environments/environment";

@Component({
  selector: "app-xdefi-connect",
  templateUrl: "./xdefi-connect.component.html",
  styleUrls: ["./xdefi-connect.component.scss"],
})
export class XDEFIConnectComponent implements OnInit {
  xdefi;
  xdefiConnecting: boolean;
  xdefiError: boolean;
  listProviders: typeof XDEFIService.listProvider;
  isValidNetwork: boolean;
  @Output() back: EventEmitter<null>;
  @Output() closeModal: EventEmitter<null>;
  isTestnet: boolean;
  subs: Subscription[];
  loading: boolean = false;
  message: string;

  constructor(
    private userService: UserService,
    private xdefiService: XDEFIService,
    private overlaysService: OverlaysService,
    private analytics: AnalyticsService
  ) {
    this.back = new EventEmitter<null>();
    this.closeModal = new EventEmitter<null>();
    this.isTestnet = environment.network === "testnet";
  }

  ngOnInit(): void {
    this.listProviders = this.xdefiService.listEnabledXDFIProviders();
    const validNetwork$ = this.xdefiService.validNetwork$.subscribe(
      (res) => {
        this.isValidNetwork = res;
      }
    );

    this.subs = [validNetwork$]
  }

  breadcrumbNav(val: string) {
    if (val === 'swap') {
      this.analytics.event('connect_connect_wallet', 'breadcrumb_skip');
      this.overlaysService.setViews(MainViewsEnum.Swap, "Swap");
    }
    else if (val === 'connect') {
      this.analytics.event('connect_connect_wallet', 'breadcrumb_connect');
      this.back.emit();
    }
  }

  getBreadcrumbText() {
    if (this.xdefiError) {
      return { text: "An xdefi error occureded", isError: true };
    }

    if (!this.isValidNetwork) {
      return { text: `SET TO ${this.isTestnet ? 'TESTNET' : 'MAINNET'} IN XDEFI`, isError: true };
    }

    if (this.listProviders?.every((p) => !p.enabled)) {
      return { text: "All dApps are disabled !", isError: true }
    }

    if (this.listProviders?.some((p) => !p.enabled)) {
      return { text: "Some dApps are disabled !", isError: false }
    }

    if (this.xdefiConnecting) {
      return { text: "Connecting", isError: false };
    }

    return { text: "Are these enabled in xdefi?", isError: false };
  }

  clearKeystore() {
    this.back.emit();
  }

  async initUnlock() {
    this.loading = true;
    if (this.xdefiConnecting) {
      return;
    }
    setTimeout(() => {
      this.xdefiConnect();
      this.loading = false;
    }, 100);
  }

  async xdefiConnect() {
    this.xdefiError = false;
    this.xdefiConnecting = true;
    try {
      this.analytics.event('connect_connect_wallet', 'button_connect');
      const user = await this.xdefiService.connectXDEFI();
      console.log("xdefiConnect::got user", user);
      this.userService.setUser(user);
      localStorage.setItem("XDEFI_CONNECTED", "true");
      this.loading = false;
      this.closeModal.emit();
    } catch (error) {
      this.xdefiError = true;
      this.loading = false;
      console.error(error.message);
    }
  }

  providersAllDisabled() {
    return this.listProviders?.every((p) => !p.enabled)
  }

  backNav() {
    this.analytics.event('connect_connect_wallet', 'button_cancel');
    this.back.emit();
  }

  ngOnDestroy() {
    this.subs.forEach(
      (sub) => {
        sub.unsubscribe();
      }
    )
  }
}
