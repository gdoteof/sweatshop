import { PrismaClient } from '../generated/prisma/client'
import fs from 'fs'
import dotenv from 'dotenv'

const db_url = process.env.DATABASE_URL ||
    // attempt to read from a local .env file
    (fs.existsSync('.env') ? dotenv.parse(fs.readFileSync('.env')) : {}).DATABASE_URL;

const prisma = new PrismaClient(
    {
        datasources: {
            db: {
                url: db_url
            }
        },
    }, 

)

export default prisma