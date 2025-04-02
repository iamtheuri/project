import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import * as schema from "./schema";
// Had to do away with initial db url and delete it as I exposed it mistakenly while testing, but all security concerns now sorted
const sql = neon(process.env.DB_URL);
export const db = drizzle(sql, { schema });
