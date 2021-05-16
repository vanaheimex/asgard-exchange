import { Injectable } from '@angular/core';
import { assetAmount, assetToBase, baseAmount } from '@xchainjs/xchain-util';
import { Asset } from '../_classes/asset';
import { PoolAddressDTO } from '../_classes/pool-address';
import { EthUtilsService } from './eth-utils.service';
import { Client } from '@xchainjs/xchain-ethereum/lib';
import { UserService } from './user.service';
import { Balances } from '@xchainjs/xchain-client';
import { Client as BinanceClient } from '@xchainjs/xchain-binance';
import { Client as BitcoinClient } from '@xchainjs/xchain-bitcoin';
import { Client as LitecoinClient } from '@xchainjs/xchain-litecoin';
import { Client as BchClient } from '@xchainjs/xchain-bitcoincash';
import { Client as ThorClient } from '@xchainjs/xchain-thorchain';

export interface EthDepositParams {
  asset: Asset;
  inputAmount: number;
  client: Client;
  thorchainAddress: string;
  recipientPool: PoolAddressDTO;
  balances: Balances;
}

export interface BinanceDepositParams {
  asset: Asset;
  inputAmount: number;
  client: BinanceClient;
  thorchainAddress: string;
  recipientPool: PoolAddressDTO;
}

export interface BitcoinDepositParams {
  asset: Asset;
  inputAmount: number;
  client: BitcoinClient;
  thorchainAddress: string;
  recipientPool: PoolAddressDTO;
  balances: Balances;
  estimatedFee: number;
}

export interface LitecoinDepositParams {
  asset: Asset;
  inputAmount: number;
  client: LitecoinClient;
  thorchainAddress: string;
  recipientPool: PoolAddressDTO;
  balances: Balances;
  estimatedFee: number;
}

export interface BchDepositParams {
  asset: Asset;
  inputAmount: number;
  client: BchClient;
  thorchainAddress: string;
  recipientPool: PoolAddressDTO;
  balances: Balances;
  estimatedFee: number;
}

export interface RuneDepositParams {
  client: ThorClient;
  inputAmount: number;
  memo: string;
}

@Injectable({
  providedIn: 'root',
})
export class KeystoreDepositService {
  constructor(
    private ethUtilsService: EthUtilsService,
    private userService: UserService
  ) {}

  async ethereumDeposit({
    asset,
    inputAmount,
    balances,
    client,
    thorchainAddress,
    recipientPool,
  }: EthDepositParams): Promise<string> {
    const targetTokenMemo = `+:${asset.chain}.${asset.symbol}:${thorchainAddress}`;

    const decimal = await this.ethUtilsService.getAssetDecimal(asset, client);
    let amount = assetToBase(assetAmount(inputAmount, decimal)).amount();

    const balanceAmount = this.userService.findRawBalance(balances, asset);

    if (amount.isGreaterThan(balanceAmount)) {
      amount = balanceAmount;
    }

    const hash = await this.ethUtilsService.callDeposit({
      inboundAddress: recipientPool,
      asset,
      memo: targetTokenMemo,
      amount,
      ethClient: client,
    });

    return hash;
  }

  async binanceDeposit({
    asset,
    inputAmount,
    client,
    thorchainAddress,
    recipientPool,
  }: BinanceDepositParams): Promise<string> {
    const targetTokenMemo = `+:${asset.chain}.${asset.symbol}:${thorchainAddress}`;
    const hash = await client.transfer({
      asset: {
        chain: asset.chain,
        symbol: asset.symbol,
        ticker: asset.ticker,
      },
      amount: assetToBase(assetAmount(inputAmount)),
      recipient: recipientPool.address,
      memo: targetTokenMemo,
    });

    return hash;
  }

  async bitcoinDeposit({
    asset,
    inputAmount,
    client,
    balances,
    thorchainAddress,
    recipientPool,
    estimatedFee,
  }: BitcoinDepositParams): Promise<string> {
    const targetTokenMemo = `+:${asset.chain}.${asset.symbol}:${thorchainAddress}`;

    // TODO -> consolidate this with BTC, BCH, LTC
    const balanceAmount = this.userService.findRawBalance(balances, asset);
    const toBase = assetToBase(assetAmount(inputAmount));
    const feeToBase = assetToBase(assetAmount(estimatedFee));
    const amount = balanceAmount
      // subtract fee
      .minus(feeToBase.amount())
      // subtract amount
      .minus(toBase.amount())
      .isGreaterThan(0)
      ? toBase.amount() // send full amount, fee can be deducted from remaining balance
      : toBase.amount().minus(feeToBase.amount()); // after deductions, not enough to process, subtract fee from amount

    if (amount.isLessThan(0)) {
      throw new Error('Insufficient funds. Try sending a smaller amount');
    }
    // TODO -> consolidate this with BTC, BCH, LTC

    const hash = await client.transfer({
      asset: {
        chain: asset.chain,
        symbol: asset.symbol,
        ticker: asset.ticker,
      },
      amount: baseAmount(amount),
      recipient: recipientPool.address,
      memo: targetTokenMemo,
      feeRate: +recipientPool.gas_rate,
    });

    return hash;
  }

  async litecoinDeposit({
    asset,
    inputAmount,
    client,
    balances,
    thorchainAddress,
    recipientPool,
    estimatedFee,
  }: LitecoinDepositParams): Promise<string> {
    const targetTokenMemo = `+:${asset.chain}.${asset.symbol}:${thorchainAddress}`;

    // TODO -> consolidate this with BTC, BCH, LTC
    const balanceAmount = this.userService.findRawBalance(balances, asset);
    const toBase = assetToBase(assetAmount(inputAmount));
    const feeToBase = assetToBase(assetAmount(estimatedFee));
    const amount = balanceAmount
      // subtract fee
      .minus(feeToBase.amount())
      // subtract amount
      .minus(toBase.amount())
      .isGreaterThan(0)
      ? toBase.amount() // send full amount, fee can be deducted from remaining balance
      : toBase.amount().minus(feeToBase.amount()); // after deductions, not enough to process, subtract fee from amount

    if (amount.isLessThan(0)) {
      throw new Error('Insufficient funds. Try sending a smaller amount');
    }
    // TODO -> consolidate this with BTC, BCH, LTC

    const hash = await client.transfer({
      asset: {
        chain: asset.chain,
        symbol: asset.symbol,
        ticker: asset.ticker,
      },
      amount: baseAmount(amount),
      recipient: recipientPool.address,
      memo: targetTokenMemo,
      feeRate: +recipientPool.gas_rate,
    });

    return hash;
  }

  async bchDeposit({
    asset,
    inputAmount,
    client,
    balances,
    thorchainAddress,
    recipientPool,
    estimatedFee,
  }: BchDepositParams): Promise<string> {
    // deposit token
    try {
      const targetTokenMemo = `+:${asset.chain}.${asset.symbol}:${thorchainAddress}`;

      // TODO -> consolidate this with BTC, BCH, LTC
      const balanceAmount = this.userService.findRawBalance(balances, asset);
      const toBase = assetToBase(assetAmount(inputAmount));
      const feeToBase = assetToBase(assetAmount(estimatedFee));
      const amount = balanceAmount
        // subtract fee
        .minus(feeToBase.amount())
        // subtract amount
        .minus(toBase.amount())
        .isGreaterThan(0)
        ? toBase.amount() // send full amount, fee can be deducted from remaining balance
        : toBase.amount().minus(feeToBase.amount()); // after deductions, not enough to process, subtract fee from amount

      if (amount.isLessThan(0)) {
        throw new Error('Insufficient funds. Try sending a smaller amount');
      }
      // TODO -> consolidate this with BTC, BCH, LTC

      const hash = await client.transfer({
        asset: {
          chain: asset.chain,
          symbol: asset.symbol,
          ticker: asset.ticker,
        },
        amount: baseAmount(amount),
        recipient: recipientPool.address,
        memo: targetTokenMemo,
        feeRate: +recipientPool.gas_rate,
      });

      return hash;
    } catch (error) {
      throw error;
    }
  }

  async runeDeposit({
    client,
    inputAmount,
    memo,
  }: RuneDepositParams): Promise<string> {
    return await client.deposit({
      amount: assetToBase(assetAmount(inputAmount)),
      memo,
    });
  }
}
