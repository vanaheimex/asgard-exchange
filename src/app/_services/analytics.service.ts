import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {

  constructor() { }

  public eventEmitter( 
    eventAction: string, 
    eventCategory?: string, 
    eventLabel?: string,  
    eventValue?: number ){ 
      (window as any).gtag('event', eventAction, { 
        'send_to': 'G-QDG7Z69FRZ',
        'event_category': eventCategory, 
        'event_label': eventLabel, 
        'value': eventValue
      })
  }
}
