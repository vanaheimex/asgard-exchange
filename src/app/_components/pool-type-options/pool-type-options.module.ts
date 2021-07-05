import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PoolTypeOptionsComponent } from './pool-type-options.component';
import { BreadcrumbModule } from '../breadcrumb/breadcrumb.module';
import { DirectivesModule } from 'src/app/_directives/directives.module';

@NgModule({
  declarations: [PoolTypeOptionsComponent],
  imports: [CommonModule, BreadcrumbModule, DirectivesModule],
  exports: [PoolTypeOptionsComponent],
})
export class PoolTypeOptionsModule {}
