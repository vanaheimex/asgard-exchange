import { Injectable } from '@angular/core';
import {
  CanActivate,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
  Router,
} from '@angular/router';
import { Observable } from 'rxjs';
import { User } from '../_classes/user';
import { UserService } from '../_services/user.service';

@Injectable({
  providedIn: 'root',
})
export class HasUserGuard implements CanActivate {
  user: User;

  constructor(private userService: UserService, private router: Router) {
    const user$ = this.userService.user$.subscribe(
      (user) => (this.user = user)
    );
  }

  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ):
    | Observable<boolean | UrlTree>
    | Promise<boolean | UrlTree>
    | boolean
    | UrlTree {
    if (this.user) return true;
    return this.router.parseUrl('/swap');
  }
}
