import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
} from "typeorm";

import { Block } from "../entities";

@EventSubscriber()
export class BlockSubscriber implements EntitySubscriberInterface<Block> {
  beforeInsert(event: InsertEvent<Block>): void {
    // eslint-disable-next-line no-console
    console.log(event);
  }
}
