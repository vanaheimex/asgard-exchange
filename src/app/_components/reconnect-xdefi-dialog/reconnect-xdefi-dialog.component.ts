import { Component, Inject, OnInit } from "@angular/core";
import {
  MainViewsEnum,
  OverlaysService,
} from "src/app/_services/overlays.service";
// import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { UserService } from "src/app/_services/user.service";
import { XDEFIService } from "src/app/_services/xdefi.service";
import { environment } from "src/environments/environment";

@Component({
  selector: "app-reconnect-xdefi-dialog",
  templateUrl: "./reconnect-xdefi-dialog.component.html",
  styleUrls: ["./reconnect-xdefi-dialog.component.scss"],
})
export class ReconnectXDEFIDialogComponent implements OnInit {
  connecting: boolean;
  connectingError: boolean;
  listProviders: typeof XDEFIService.listProvider;
  isValidNetwork: boolean;
  isTestnet: boolean;
  constructor(
    // @Inject(MAT_DIALOG_DATA) public data,
    // private dialogRef: MatDialogRef<ReconnectXDEFIDialogComponent>,
    private userService: UserService,
    private xdefiService: XDEFIService,
    private overlaysService: OverlaysService
  ) {
    this.isTestnet = environment.network === "testnet";
  }

  ngOnInit(): void {
    setTimeout(() => {
      this.listProviders = this.xdefiService.listEnabledXDFIProviders();
      this.isValidNetwork = this.xdefiService.isValidNetwork();
    }, 200);
  }

  async initConnect() {
    try {
      this.connecting = true;
      const user = await this.xdefiService.connectXDEFI();
      this.userService.setUser(user);
      // this.dialogRef.close();
      this.overlaysService.setCurrentView(MainViewsEnum.Swap);
    } catch (error) {
      this.connecting = false;
      this.connectingError = true;
      console.error(error);
    }
  }

  getBreadcrumbText() {
    if (this.connectingError) {
      return { text: "An xdefi connection error occureded", isError: true };
    }

    if (!this.isValidNetwork) {
      return { text: "Incorrect network!", isError: true };
    }

    if (this.connecting) {
      return { text: "Connecting", isError: false };
    }

    return { text: "Reconnect or forget", isError: false };
  }

  forget() {
    localStorage.clear();
    this.overlaysService.setCurrentView(MainViewsEnum.Swap);
    // this.dialogRef.close();
  }
}
