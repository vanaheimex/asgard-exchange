import { Component, OnDestroy, OnInit } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { Subject, timer, of, Subscription } from "rxjs";
import { catchError, switchMap, takeUntil } from "rxjs/operators";
import { LastBlock } from "src/app/_classes/last-block";
import { LastBlockService } from "src/app/_services/last-block.service";
import { MidgardService, MimirResponse } from "src/app/_services/midgard.service";
import { OverlaysService, MainViewsEnum } from "./_services/overlays.service";
import { UserService } from "./_services/user.service";
import { Chain } from "@xchainjs/xchain-util";
import { AssetAndBalance } from "./_classes/asset-and-balance";
import { Asset } from "./_classes/asset";
import { ReconnectXDEFIDialogComponent } from "./_components/reconnect-xdefi-dialog/reconnect-xdefi-dialog.component";
import { environment } from "src/environments/environment";
import { links } from "src/app/_const/links";
import { Router } from "@angular/router";
import { NetworkSummary } from "./_classes/network";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.scss"],
})
export class AppComponent implements OnInit, OnDestroy {
  killPolling: Subject<void> = new Subject();
  subs: Subscription[];
  isTestnet: boolean;
  showSwap: boolean;
  _showUserSetting: boolean;
  _showReconnect: boolean;
  keystore: any;

  currentView: MainViewsEnum;
  currentViewType = MainViewsEnum;

  chainBalanceErrors: Chain[];
  nonNativeRuneAssets: AssetAndBalance[];
  appLocked: boolean;
  mainnetUrl: string;

  constructor(
    private midgardService: MidgardService,
    private lastBlockService: LastBlockService,
    private overlaysService: OverlaysService,
    private router: Router,
    private userService: UserService
  ) {
    this.isTestnet = environment.network === "testnet";
    this.mainnetUrl = this.isTestnet ? links.mainnetUrl : links.testnetUrl;
    this.overlaysService.setViews(MainViewsEnum.Swap, "Swap");
    const overlay$ = this.overlaysService.currentView.subscribe((val) => {
      this.currentView = val;
    });

    this.appLocked = environment.appLocked ?? false;

    const chainBalanceErrors$ = this.userService.chainBalanceErrors$.subscribe(
      (chains) => (this.chainBalanceErrors = chains)
    );

    this.nonNativeRuneAssets = [];

    const balances$ = this.userService.userBalances$.subscribe((balances) => {
      if (balances) {
        const nonNativeRuneAssets = balances
          // get ETH.RUNE and BNB.RUNE
          .filter((balance) => {
            return (
              (balance.asset.chain === "BNB" &&
                balance.asset.ticker === "RUNE") ||
              (balance.asset.chain === "ETH" && balance.asset.ticker === "RUNE")
            );
          })
          // filter out 0 amounts
          .filter((balance) => balance.amount.amount().isGreaterThan(0))
          // create Asset
          .map((balance) => ({
            asset: new Asset(`${balance.asset.chain}.${balance.asset.symbol}`),
          }));

        this.nonNativeRuneAssets = this.userService.sortMarketsByUserBalance(
          balances,
          nonNativeRuneAssets
        );
      } else {
        this.nonNativeRuneAssets = [];
      }
    });

    this.subs = [chainBalanceErrors$, balances$];
  }

  async ngOnInit(): Promise<void> {
    this.pollLastBlock();
    this.pollCap();

    const keystoreString = localStorage.getItem("keystore");
    const XDEFIConnected = localStorage.getItem("XDEFI_CONNECTED");

    const keystore = JSON.parse(keystoreString);
    if (keystore) {
      this.keystore = keystore;
      this.openReconnectDialog();
    } else if (XDEFIConnected) {
      this.openReconnectXDEFIDialog();
    }

    if (this.isTestnet) {
      document.documentElement.style.setProperty(
        "--primary-default",
        "#F3BA2F"
      );
      document.documentElement.style.setProperty(
        "--primary-graident-bottom-left",
        "#F3BA2F"
      );
      document.documentElement.style.setProperty(
        "--primary-graident-top-right",
        "#F3BA2F"
      );
    }

    if (this.appLocked) {
      this.router.navigate(["/", "swap"]);
      this.overlaysService.setViews(MainViewsEnum.Swap, "Swap");
    }

    document.addEventListener("mousedown", (e) => {
      if (
        document.querySelector(".expandable") &&
        (e.target as HTMLTextAreaElement).compareDocumentPosition(
          document.querySelector(".expandable")
        ) !== 10
      ) {
        this.overlaysService.setMenu(false);
      }
    });
  }

  openReconnectDialog(keystore?) {
    //TODO: this needs to be shown every time keystroke has been find
    // this.showReconnect = true;
    // this.overlaysService.setCurrentView('Reconnect')
    this.overlaysService.setCurrentView(MainViewsEnum.Reconnect);
    // this.dialog.open(
    //   ReconnectDialogComponent,
    //   {
    //     maxWidth: '420px',
    //     width: '50vw',
    //     minWidth: '260px',
    //     data: {
    //       keystore
    //     }
    //   }
    // );
  }

  notificationsExist(): boolean {
    return (
      (this.nonNativeRuneAssets && this.nonNativeRuneAssets.length > 0) ||
      (this.chainBalanceErrors && this.chainBalanceErrors.length > 0)
    );
  }

  openReconnectXDEFIDialog() {
    this.overlaysService.setCurrentView(MainViewsEnum.ReconnectXDEFI);
    // this.dialog.open(
    //   ReconnectXDEFIDialogComponent,
    //   {
    //     maxWidth: '420px',
    //     width: '50vw',
    //     minWidth: '260px',
    //   }
    // );
  }

  pollLastBlock(): void {
    const refreshInterval$ = timer(0, 15000)
      .pipe(
        // This kills the request if the user closes the component
        takeUntil(this.killPolling),
        // switchMap cancels the last request, if no response have been received since last tick
        switchMap(() => this.midgardService.getLastBlock()),
        // catchError handles http throws
        catchError((error) => of(error))
      )
      .subscribe(async (res: LastBlock[]) => {
        if (res.length > 0) {
          this.lastBlockService.setBlock(res[0].thorchain);
        }
      });
    this.subs.push(refreshInterval$);
  }

  pollCap(): void {
    const mimirInterval$ = timer(0, 15000)
      .pipe(
        // This kills the request if the user closes the component
        takeUntil(this.killPolling),
        // switchMap cancels the last request, if no response have been received since last tick
        switchMap(() => this.midgardService.updateMimir()),
        // catchError handles http throws
        catchError((error) => of(error))
      )
      .subscribe(async (res: MimirResponse) => {
        this.midgardService.setMimir(res);
      });
    const networkInterval$ = timer(0, 15000)
      .pipe(
        // This kills the request if the user closes the component
        takeUntil(this.killPolling),
        // switchMap cancels the last request, if no response have been received since last tick
        switchMap(() => this.midgardService.getNetwork()),
        // catchError handles http throws
        catchError((error) => of(error))
      )
      .subscribe(async (res: NetworkSummary) => {
        this.midgardService.setNetwork(res);
      });
    this.subs.push(mimirInterval$, networkInterval$);
  }

  ngOnDestroy(): void {
    this.killPolling.next();
    for (const sub of this.subs) {
      sub.unsubscribe();
    }
  }
}
