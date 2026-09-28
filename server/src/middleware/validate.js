import { z } from 'zod';

/** Parse req.body (or another source) with a zod schema; 400 with field errors on failure. */
export const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง', fields: z.flattenError(result.error).fieldErrors });
  }
  req.valid = result.data;
  next();
};

export const money = z.coerce.number().min(0).max(1_000_000_000);
export const year = z.coerce.number().int().min(2020).max(2100);
