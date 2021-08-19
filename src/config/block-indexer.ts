/* eslint-disable @typescript-eslint/naming-convention */
export const blockIndexerConfig = {
  schema: {
    type: "object",
    required: ["FACTORY_DEPLOYMENT_BLOCK"],
    properties: {
      NODE_ENV: {
        type: "string",
        default: "prod",
      },

      REDIS_HOST: {
        type: "string",
        default: "127.0.0.1",
      },
      REDIS_PORT: {
        type: "string",
        default: 6379,
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
      FACTORY_CONTRACT_NAME: {
        type: "string",
        default: "SaleContractFactory",
      },
      TOKEN_SALE_CONTRACT_NAME: {
        type: "string",
        default: "SaleContract",
      },
      FACTORY_DEPLOYMENT_BLOCK: {
        type: "number",
      },
    },
  },
  env: true,
};
export interface Env {
  NODE_ENV: string | "test" | "prod";
  NETWORK_URL: string;
  NETWORK: string;
  CHAIN_ID: number;
  FACTORY_CONTRACT_NAME: string;
  TOKEN_SALE_CONTRACT_NAME: string;
  REDIS_HOST: string;
  REDIS_PORT: number;
  FACTORY_DEPLOYMENT_BLOCK: number;
}
