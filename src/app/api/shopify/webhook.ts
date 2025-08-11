export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Verify webhook signature
  const hmac = req.headers['x-shopify-hmac-sha256'];
  const body = JSON.stringify(req.body);
  const hash = crypto.createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET!)
                    .update(body, 'utf8')
                    .digest('base64');

  if (hash !== hmac) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const order = req.body;
  
  // Check if order contains service-eligible products
  const serviceProducts = order.line_items.filter((item: any) => 
    item.product_id && isServiceEligibleProduct(item.product_id)
  );

  if (serviceProducts.length > 0) {
    // Create service booking automatically or send booking invitation
    await createServiceBookingFromOrder(order);
  }

  res.status(200).json({ received: true });
}