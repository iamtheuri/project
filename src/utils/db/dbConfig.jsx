import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";
// Had to do away with initial db url and delete it as I exposed it mistakenly while testing, but all security concerns now sorted
const sql = neon("postgresql://neondb_owner:npg_6cVytOTf3ZQB@ep-royal-thunder-a4ar37nx-pooler.us-east-1.aws.neon.tech/trash2token?sslmode=require");
export const db = drizzle(sql, { schema });
