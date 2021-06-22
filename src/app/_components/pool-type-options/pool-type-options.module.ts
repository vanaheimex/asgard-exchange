import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PoolTypeOptionsComponent } from './pool-type-options.component';
import { BreadcrumbModule } from '../breadcrumb/breadcrumb.module';

@NgModule({
  declarations: [PoolTypeOptionsComponent],
  imports: [
    CommonModule,
    BreadcrumbModule
  ],
  exports: [PoolTypeOptionsComponent],
})
export class PoolTypeOptionsModule {}
