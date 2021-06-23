import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ConnectComponent, ConnectModal } from './connect.component';
import { XDEFIConnectComponent } from './xdefi-connect/xdefi-connect.component';
import { KeystoreCreateStorePhraseComponent } from './keystore-create-store-phrase/keystore-create-store-phrase.component';
import { KeystoreCreateComponent } from './keystore-create/keystore-create.component';
import { KeystoreConnectComponent } from './keystore-connect/keystore-connect.component';
import { ImportPhraseComponent } from './import-phrase/import-phrase.component';
import { ConnectErrorComponent } from './connect-error/connect-error.component';
import { BreadcrumbModule } from '../breadcrumb/breadcrumb.module';
import { TagModule } from '../tag/tag.module';
import { ArrowModule } from '../arrow/arrow.module';
import { PhraseWordsListModule } from '../phrase-words-list/phrase-words-list.module';
import { NoticeModule } from '../notice/notice.module';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TextFieldModule } from '../text-field/text-field.module';

@NgModule({
  declarations: [
    ConnectComponent,
    ConnectModal,
    XDEFIConnectComponent,
    KeystoreCreateStorePhraseComponent,
    KeystoreCreateComponent,
    KeystoreConnectComponent,
    ImportPhraseComponent,
    ConnectErrorComponent,
  ],
  imports: [
    CommonModule,
    RouterModule,
    BreadcrumbModule,
    TagModule,
    ArrowModule,
    PhraseWordsListModule,
    NoticeModule,
    FormsModule,
    MatIconModule,
    TextFieldModule,
  ],
  exports: [
    ConnectComponent,
    ConnectModal,
    XDEFIConnectComponent,
    KeystoreCreateStorePhraseComponent,
    KeystoreCreateComponent,
    KeystoreConnectComponent,
    ImportPhraseComponent,
    ConnectErrorComponent,
  ],
})
export class ConnectModule {}
