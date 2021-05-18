import { Component, OnDestroy } from "@angular/core";
import { Subscription } from "rxjs";
import { LastBlockService } from "src/app/_services/last-block.service";
import { environment } from "src/environments/environment";
import { links } from "src/app/_const/links";

@Component({
  selector: "app-last-block-indicator",
  templateUrl: "./last-block-indicator.component.html",
  styleUrls: ["./last-block-indicator.component.scss"],
})
export class LastBlockIndicatorComponent implements OnDestroy {
  subs: Subscription[];
  lastBlock: number;
  updating: boolean;
  isTestnet: boolean;

  gitHubUrl: string;
  links: any;

  constructor(private lastBlockService: LastBlockService) {
    this.isTestnet = environment.network === "testnet";
    this.gitHubUrl = links.github;
    this.links = links;

    const lastBlock$ = this.lastBlockService.lastBlock$.subscribe((block) => {
      this.lastBlock = block;
      this.updating = true;
      setTimeout(() => {
        this.updating = false;
      }, 1000);
    });

    this.subs = [lastBlock$];
  }

  ngOnDestroy() {
    for (const subs of this.subs) {
      subs.unsubscribe();
    }
  }
}
