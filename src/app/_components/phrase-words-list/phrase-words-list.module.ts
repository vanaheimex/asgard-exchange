import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PhraseWordsListComponent } from './phrase-words-list.component';
import { NoticeModule } from '../notice/notice.module';

@NgModule({
  declarations: [PhraseWordsListComponent],
  imports: [CommonModule, NoticeModule],
  exports: [PhraseWordsListComponent],
})
export class PhraseWordsListModule {}
