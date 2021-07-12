import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { Asset } from '../_classes/asset';
import { events } from '../_const/events';
import { UserService } from './user.service';

export type Events = {
  event_category: string;
  event_address?: string;
};

export function assetString(asset: Asset) {
  try {
    return `${asset.chain}.${asset.ticker}`;
  } catch (error) {
    return undefined;
  }
}

@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  constructor(private userService: UserService) {}

  public eventEmitter(
    eventAction: string,
    eventCategory?: string,
    eventLabel?: string,
    eventValue?: number,
    eventAddress?: string
  ) {
    (window as any).gtag('event', eventAction, {
      send_to: environment.googleMeasurement,
      event_category: eventCategory,
      event_label: eventLabel,
      value: eventValue,
    });
  }

  public event(
    eventName: string,
    eventLabel: string,
    eventVal?: number,
    ...values: string[]
  ) {
    try {
      let event = events[eventName][eventLabel];

      let r = /\*(.*?)\*/g;

      let valArray = event.label.match(r);
      if (valArray && values.length !== valArray.length) {
        console.error('Event values are not same!');
        return;
      }

      if (event.value === true && eventVal === undefined) {
        console.error('No value has been set!');
        return;
      }

      let label = event.label;
      for (let val in valArray) {
        label = label.replace(valArray[val], values[val]);
      }

      this.eventEmitter(event.action, event.category, label, eventVal);
    } catch (error) {
      console.error("Couldn't send the analytics!");
      console.log(error);
    }
  }
}
