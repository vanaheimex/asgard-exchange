import { Component, Output, EventEmitter } from "@angular/core";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { environment } from "src/environments/environment";
import { OverlaysService } from "src/app/_services/overlays.service";

@Component({
  selector: "app-connect",
  templateUrl: "./connect.component.html",
  styleUrls: ["./connect.component.scss"],
})
export class ConnectComponent {
  constructor(public overlaysService: OverlaysService) {}

  openDialog() {
    this.overlaysService.setCurrentSwapView("Connect");
  }
}

export enum ConnectionMethod {
  LEDGER = "LEDGER",
  KEYSTORE = "KEYSTORE",
  KEYSTORE_CREATE = "KEYSTORE_CREATE",
  WALLET_CONNECT = "WALLET_CONNECT",
  XDEFI = "XDEFI",
}
export enum ConnectionView {
  KEYSTORE_CONNECT = "KEYSTORE_CONNECT",
  KEYSTORE_CREATE = "KEYSTORE_CREATE",
  KEYSTORE_WRITE_PHRASE = "KEYSTORE_WRITE_PHRASE",
  KEYSTORE_IMPORT_PHRASE = "KEYSTORE_IMPORT_PHRASE",
  XDEFI = "XDEFI",
}

@Component({
  selector: "app-connect-modal",
  templateUrl: "connect-modal.component.html",
  styleUrls: ["./connect.component.scss"],
})
// eslint-disable-next-line @angular-eslint/component-class-suffix
export class ConnectModal {
  connectionView: ConnectionView;
  isTestnet: boolean;
  isXDEFIConnected: boolean;
  phrase: string;

  @Output() closeEvent = new EventEmitter<null>();

  constructor(public overlaysService: OverlaysService) {
    this.isTestnet = environment.network === "testnet" ? true : false;

    this.isXDEFIConnected = false;
    if ((window as any).xfi) {
      this.isXDEFIConnected = true;
    }
  }

  createKeystore() {
    this.connectionView = ConnectionView.KEYSTORE_CREATE;
  }

  connectKeystore() {
    this.connectionView = ConnectionView.KEYSTORE_CONNECT;
  }

  createKeystoreFromPhrase() {
    this.connectionView = ConnectionView.KEYSTORE_IMPORT_PHRASE;
  }

  connectXDEFI() {
    if (!this.isXDEFIConnected) {
      return window.open(
        "https://xdefi-io.medium.com/how-to-use-asgardex-with-xdefi-wallet-%EF%B8%8F-547081a8d274",
        "_blank"
      );
    }
    this.connectionView = ConnectionView.XDEFI;
  }

  storePhrasePrompt(phrase: string) {
    this.phrase = phrase;
    this.connectionView = ConnectionView.KEYSTORE_WRITE_PHRASE;
  }

  clearConnectionMethod() {
    this.phrase = null;
    this.connectionView = null;
  }

  close() {
    // this.dialogRef.close();
    // this.overlayChange.emit(false);
    this.closeEvent.emit();
    this.phrase = null;
  }
}
