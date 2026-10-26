import { z } from 'zod';

import { BaseZodDictionary, BlockConfiguration, DocumentBlocksDictionary } from '../utils';

/**
 *
 * @param blocks Main DocumentBlocksDictionary
 * @returns zod schema that can parse arbitary objects into a single BlockConfiguration
 */
export default function buildBlockConfigurationSchema<T extends BaseZodDictionary>(
  blocks: DocumentBlocksDictionary<T>
) {
  const blockObjects = (Object.keys(blocks) as Array<keyof T & string>).map((type) =>
    z.object({
      type: z.literal(type),
      data: blocks[type].schema,
    })
  );
  type TBlockObject = (typeof blockObjects)[number];

  return z
    .discriminatedUnion('type', blockObjects as [TBlockObject, ...TBlockObject[]])
    .transform((v) => v as BlockConfiguration<T>);
}
