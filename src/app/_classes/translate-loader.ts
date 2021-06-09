import { TranslateLoader } from '@ngx-translate/core';
import { Observable, of } from 'rxjs';
import { en, fr } from 'src/assets/locales/index';

export class LanguageLoader implements TranslateLoader {
	constructor() {}

    public getTranslation(lang: string): Observable<any> {
        console.log(en);
        switch(lang) {
            case "en":
                return of(en);
            default:
                return of(en);
        }
    }
}