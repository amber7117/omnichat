import { defineConfig } from "@prisma/config";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
    schema: "./prisma/schema.prisma",

    datasource: {
        name: "db",
        provider: "sqlite",
        url: process.env.DATABASE_URL!,
    },

    migrate: {
        connectionString: process.env.DATABASE_URL!,
    },
});
