import { Hono } from 'hono';
import { z } from 'zod';

import { fulfillPaidOrder, refundPaidOrder } from '../core/achievements';

export const paymentsRoutes = new Hono();

const paidOrderSchema = z.object({
  id: z.string(),
  status: z.string(),
  products: z.array(
    z.object({
      sku: z.string(),
      displayName: z.string().optional(),
    })
  ),
  metadata: z.record(z.string(), z.string()).default({}),
});

paymentsRoutes.post('/fulfill-order', async (c) => {
  try {
    const order = paidOrderSchema.parse(await c.req.json());
    const result = await fulfillPaidOrder(order);
    return c.json(result, result.success ? 200 : 400);
  } catch (error) {
    console.error(`Error fulfilling order: ${error}`);
    return c.json(
      {
        success: false,
        reason: 'Could not fulfill this order.',
      },
      400
    );
  }
});

paymentsRoutes.post('/refund-order', async (c) => {
  try {
    const order = paidOrderSchema.parse(await c.req.json());
    await refundPaidOrder(order);
    return c.json({}, 200);
  } catch (error) {
    console.error(`Error refunding order: ${error}`);
    return c.json({}, 400);
  }
});
