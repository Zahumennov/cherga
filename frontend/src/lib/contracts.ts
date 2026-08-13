import { CircleAbi, CircleFactoryAbi } from "@/generated/abis";
import localDeployment from "@/generated/local-deployment.json";
import type { Address } from "viem";

export const circleFactoryAddress = localDeployment.factory as Address;
export const mockTokenAddress = localDeployment.token as Address;

// Only the local mock stablecoin exists right now — real tokens land
// alongside real networks in stage 5.
export const tokens = [{ symbol: "mUSD", address: mockTokenAddress }] as const;

export { CircleAbi, CircleFactoryAbi };
