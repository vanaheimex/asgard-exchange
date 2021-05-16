import { Component, EventEmitter, OnInit, Output } from "@angular/core";
import { Subscription } from "rxjs";
import { currenciesName } from "src/app/_const/currencies";
import { CurrencyService } from "src/app/_services/currency.service";

export interface Currency {
  symbol: string;
  name: string;
  value: number;
  code?: string;
}

@Component({
  selector: "app-currency-converter",
  templateUrl: "./currency-converter.component.html",
  styleUrls: ["./currency-converter.component.scss"],
})
export class CurrencyConverterComponent implements OnInit {
  subs: Subscription[];
  currencies: Currency[];
  @Output() close: EventEmitter<null> = new EventEmitter<null>();
  activeIndex: number;
  message: string;

  constructor(private currencyService: CurrencyService) {
    this.currencies = [] as Currency[];

    const cur$ = currencyService.getDailyCurrencyValue().subscribe((curs) => {
      let usdBased = curs["usd"];
      for (const key in usdBased) {
        if (currenciesName[key.toUpperCase()]) {
          this.currencies.push({
            symbol: currenciesName[key.toUpperCase()]["symbol"],
            name: currenciesName[key.toUpperCase()]["name"],
            code: currenciesName[key.toUpperCase()]["code"],
            value: parseFloat(usdBased[key]),
          });
        }
      }
    });

    this.subs = [cur$];
  }

  saveCurrency() {
    this.currencyService.setActiveCurrency(this.currencies[this.activeIndex]);
    localStorage.setItem(
      `active_currency`,
      JSON.stringify(this.currencies[this.activeIndex])
    );
    this.message = "saved";
    this.close.emit();
  }

  ngOnInit(): void {
    this.message = "select";
  }

  ngOnDestroy(): void {
    this.subs.forEach((sub) => {
      sub.unsubscribe();
    });
  }
}
