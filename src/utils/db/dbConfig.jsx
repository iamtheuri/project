import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";
const sql = neon("postgresql://neondb_owner:npg_6cVytOTf3ZQB@ep-royal-thunder-a4ar37nx-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require");
export const db = drizzle(sql, { schema });
