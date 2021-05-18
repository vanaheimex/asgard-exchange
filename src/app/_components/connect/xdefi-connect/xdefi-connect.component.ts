import { Component, OnInit, Output, EventEmitter } from "@angular/core";
import { Subscription } from "rxjs";
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
    private xdefiService: XDEFIService
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

  getBreadcrumbText() {
    if (this.xdefiError) {
      return { text: "An xdefi error occureded", isError: true };
    }

    if (!this.isValidNetwork) {
      return { text: `SET TO ${this.isTestnet ? 'TESTNET' : 'MAINNET'} IN XDEFI`, isError: true };
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

  backClicked() {
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
