import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { BehaviorSubject, bindNodeCallback, Observable } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { Currency } from '../_components/account-settings/currency-converter/currency-converter.component';

@Injectable({
  providedIn: 'root',
})
export class CurrencyService {
  private currencyApi: string;
  private activeCurrencySource = new BehaviorSubject<Currency>({
    symbol: '$',
    value: 1,
    name: 'US Dollar',
    code: 'USD',
  });
  private _activeCurrency: Currency;
  cur$ = this.activeCurrencySource.asObservable();

  constructor(private http: HttpClient) {
    this.currencyApi =
      'https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest';

    this._activeCurrency = JSON.parse(
      localStorage.getItem(`active_currency`)
    ) ?? {
      symbol: '$',
      value: 1,
      name: 'US Dollar',
      code: 'USD',
    };
    this.activeCurrencySource.next(this._activeCurrency);

    if (localStorage.getItem(`active_currency`)) {
      this.getDailyCurrencyValue().subscribe((curs) => {
        let usdBased = curs['usd'];
        this._activeCurrency.value = parseFloat(
          usdBased[this._activeCurrency.code.toLocaleLowerCase()]
        );
      });
    }
  }

  getDailyCurrencyValue(): Observable<any> {
    return this.http.get<any>(`${this.currencyApi}/currencies/usd.min.json`);
  }

  setActiveCurrency(currency: Currency) {
    this._activeCurrency = currency;
    this.activeCurrencySource.next(currency);
  }

  getActiveCurrency(): Currency {
    return this._activeCurrency;
  }
}
