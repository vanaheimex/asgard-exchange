import { Component, OnInit } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { environment } from 'src/environments/environment';
import { OverlaysService } from 'src/app/_services/overlays.service';


@Component({
  selector: 'app-connect',
  templateUrl: './connect.component.html',
  styleUrls: ['./connect.component.scss']
})
export class ConnectComponent implements OnInit {

  // modalDimensions = {
  //   maxWidth: '420px',
  //   width: '50vw',
  //   minWidth: '260px'
  // };

  constructor(private dialog: MatDialog, public overlaysService: OverlaysService) { }

  ngOnInit(): void {}

  openDialog() {
    // this.dialog.open(
    //   ConnectModal,
    //   this.modalDimensions
    // );
    // this.overlayChange.emit(true);
    this.overlaysService.setCurrentSwapView('Connect');
  }

}

export enum ConnectionMethod {
  LEDGER = 'LEDGER',
  KEYSTORE = 'KEYSTORE',
  KEYSTORE_CREATE = 'KEYSTORE_CREATE',
  WALLET_CONNECT = 'WALLET_CONNECT',
  XDEFI = 'XDEFI',
}
export enum ConnectionView {
  KEYSTORE_CONNECT      = 'KEYSTORE_CONNECT',
  KEYSTORE_CREATE       = 'KEYSTORE_CREATE',
  KEYSTORE_WRITE_PHRASE = 'KEYSTORE_WRITE_PHRASE',
  XDEFI = 'XDEFI',
}

@Component({
  selector: 'app-connect-modal',
  templateUrl: 'connect-modal.component.html',
  styleUrls: ['./connect.component.scss'],
})
// tslint:disable-next-line:component-class-suffix
export class ConnectModal {

  connectionView: ConnectionView;
  isTestnet: boolean;
  isXDEFIConnected: boolean;
  phrase: string;

  constructor(
    public overlaysService: OverlaysService
  ) {
    this.isTestnet = environment.network === 'testnet' ? true : false;

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

  connectXDEFI() {
    if (!this.isXDEFIConnected) {
      return window.open('https://xdefi-io.medium.com/how-to-use-asgardex-with-xdefi-wallet-%EF%B8%8F-547081a8d274', '_blank');
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
    this.overlaysService.setCurrentSwapView('Swap')
    this.phrase = null;
  }

}
