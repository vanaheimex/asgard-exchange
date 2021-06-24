import { getPoolShare, UnitData } from '@thorchain/asgardex-util';
import { baseAmount } from '@xchainjs/xchain-util';
import BigNumber from 'bignumber.js';

export class Liquidity {
  // pulled from https://gitlab.com/thorchain/thornode/-/issues/657#algorithm
  static getAsymAssetShare(
    s: BigNumber,
    T: BigNumber,
    A: BigNumber
  ): BigNumber {
    const part1 = s.times(A);
    const part2 = T.times(T).times(2);
    const part3 = T.times(s).times(2);
    const part4 = s.times(s);
    const numerator = part1.times(part2.minus(part3).plus(part4));
    const part5 = T.times(T).times(T);
    return numerator.div(part5).integerValue(1);
  }
}
