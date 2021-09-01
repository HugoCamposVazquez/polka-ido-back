import { FastifyPluginAsync } from "fastify";

import { onlyWhitelisted } from "../metrics/auth";

export const routesPlugin: FastifyPluginAsync = async function (instance) {
  instance.route({
    url: "/metrics",
    method: "GET",
    schema: { hide: true },
    preValidation: [onlyWhitelisted],
    handler: (_, reply) => {
      reply.type("text/plain").send(instance.metrics.client.register.metrics());
    },
  });
};
