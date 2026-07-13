"use client";

import { Contract } from "ethers";
import { ERC20_ABI, ESCROW_ABI } from "@/lib/abis";
import { ESCROW_ADDRESS } from "@/lib/contracts";
import { useChainRead, type ChainRead } from "@/hooks/useChainRead";
import type { AllowedToken } from "@/hooks/useAllowedTokens";

export interface TokenBalance {
  address: string;
  symbol: string;
  decimals: number;
  balance: bigint;
}
export interface AccountBalances {
  label: string;
  address: string;
  eth: bigint;
  tokens: TokenBalance[];
}
export interface BalancesData {
  tokens: AllowedToken[];
  accounts: AccountBalances[];
}

// 🇪🇸 NOTA: cuentas estándar de Anvil sembradas por `script/Deploy.s.sol` (1000e18 TKA+TKB c/u).
//    Son deterministas en local (chainId 31337); #0 es además el owner del Escrow.
const ANVIL_ACCOUNTS: ReadonlyArray<{ label: string; address: string }> = [
  { label: "Escrow (contract)", address: ESCROW_ADDRESS },
  { label: "Account #0 (owner)", address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" },
  { label: "Account #1", address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" },
  { label: "Account #2", address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" },
];

/**
 * Reads ETH + each allowlisted token balance for the escrow and the three seeded Anvil accounts.
 * Every account row and every token balance is fetched in parallel.
 */
export function useBalances(): ChainRead<BalancesData> {
  return useChainRead<BalancesData>(async (provider) => {
    const escrow = new Contract(ESCROW_ADDRESS, ESCROW_ABI, provider);
    const tokenAddresses = (await escrow.getAllowedTokens()) as string[];

    const tokens: AllowedToken[] = await Promise.all(
      tokenAddresses.map(async (address) => {
        const erc20 = new Contract(address, ERC20_ABI, provider);
        const [symbol, decimals] = await Promise.all([erc20.symbol(), erc20.decimals()]);
        return { address, symbol: symbol as string, decimals: Number(decimals) };
      }),
    );

    const accounts: AccountBalances[] = await Promise.all(
      ANVIL_ACCOUNTS.map(async ({ label, address }) => {
        const [eth, tokenBalances] = await Promise.all([
          provider.getBalance(address),
          Promise.all(
            tokens.map(async (token) => {
              const erc20 = new Contract(token.address, ERC20_ABI, provider);
              const balance = (await erc20.balanceOf(address)) as bigint;
              return { ...token, balance };
            }),
          ),
        ]);
        return { label, address, eth, tokens: tokenBalances };
      }),
    );

    return { tokens, accounts };
  });
}
