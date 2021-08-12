import { BlockRepository } from "../repositories/BlockRepository";
import { ApiController } from "../services/fastify-types";
import { logger } from "../services/logger";

interface PaginationQuery {
  page?: number;
  limit?: number;
}

export const getBlocks: ApiController<PaginationQuery> = {
  url: "/blocks",
  handler: async function (request, reply) {
    logger.info("Fetching blocks");
    const blockRepository = this.db.getCustomRepository(BlockRepository);

    reply.send(
      await blockRepository.getAll(
        request.query.page,
        getBlocks.url,
        request.query.limit
      )
    );
  },

  opts: {
    schema: {
      querystring: {
        limit: {
          type: "number",
          exclusiveMinimum: 0,
        },
        page: {
          type: "number",
          exclusiveMinimum: 0,
        },
      },
    },
  },
};
