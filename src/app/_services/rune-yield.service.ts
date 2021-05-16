import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { shareReplay } from "rxjs/operators";
import { environment } from "src/environments/environment";
export interface RuneYieldPoolResponse {
  assetstake;
  assetwithdrawn;
  firststake;
  laststake;
  pool;
  poolunits;
  postassetstake;
  postrunestake;
  runestake;
  runewithdrawn;
  totalstakedasset;
  totalstakedbtc;
  totalstakedrune;
  totalstakedusd;
  totalunstakedasset;
  totalunstakedbtc;
  totalunstakedrune;
  totalunstakedusd;
}

@Injectable({
  providedIn: "root",
})
export class RuneYieldService {
  constructor(private http: HttpClient) {}

  getCurrentValueOfPool(address: string): Observable<RuneYieldPoolResponse[]> {
    if (environment.network === "testnet") {
      return;
    }
    return this.http
      .get<RuneYieldPoolResponse[]>(
        "https://multichain-asgard-consumer-api.vercel.app/api/v2/member/poollist?address=" +
          address
      )
      .pipe(shareReplay());
  }
}
