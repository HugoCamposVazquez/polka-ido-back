/* eslint-disable @typescript-eslint/naming-convention */
import { fastifyEnvOpt } from "fastify-env";

export const config: fastifyEnvOpt = {
  schema: {
    type: "object",
    required: [
      "STATEMINT_MINTING_WALLET_MNEMONIC",
      "SWAP_FACTORY_ADDRESS",
      "FACTORY_DEPLOYMENT_BLOCK",
    ],
    properties: {
      NODE_ENV: {
        type: "string",
        default: "prod",
      },
      SERVER_ADDRESS: {
        type: "string",
        default: "0.0.0.0",
      },
      SERVER_PORT: {
        type: "number",
        default: 3000,
      },
      CORS_ORIGIN: {
        type: "string",
        default: "*",
      },
      MAX_REQ_PER_MIN: {
        type: "number",
        default: 1000,
      },
      REDIS_URL: {
        type: "string",
        default: "127.0.0.1:6379",
      },
      NETWORK_URL: {
        type: "string",
        default: "https://rpc.testnet.moonbeam.network",
      },
      NETWORK: {
        type: "string",
        default: "MoonbeamAlpha",
      },
      CHAIN_ID: {
        type: "number",
        default: 1287,
      },
      CONTRACT_NAME: {
        type: "string",
        default: "SaleContractFactory",
      },
      SWAP_FACTORY_ADDRESS: {
        type: "string",
      },
      FACTORY_DEPLOYMENT_BLOCK: {
        type: "number",
      },
      MINT_ATTEMPTS: {
        type: "number",
        default: 5,
      },
      STATEMINT_NETWORK_URL: {
        type: "string",
        default: "ws://127.0.0.1:9944",
      },
      STATEMINT_MINTING_WALLET_MNEMONIC: {
        type: "string",
      },
    },
  },
  env: true,
};

declare module "fastify" {
  interface FastifyInstance {
    config: {
      NODE_ENV: string | "test" | "prod";
      SERVER_ADDRESS: string;
      SERVER_PORT: number;
      CORS_ORIGIN: string;
      MAX_REQ_PER_MIN: number;
      NETWORK_URL: string;
      NETWORK: string;
      CHAIN_ID: number;
      CONTRACT_NAME: string;
      REDIS_URL: string;
      SWAP_FACTORY_ADDRESS: string;
      FACTORY_DEPLOYMENT_BLOCK: number;
      MINT_ATTEMPTS: number;
      STATEMINT_NETWORK_URL: string;
      STATEMINT_MINTING_WALLET_MNEMONIC: string;
    };
  }
}
