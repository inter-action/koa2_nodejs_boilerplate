import * as path from "path";

import * as orm from "../db/typeorm"
export { orm };

import { logger, initLogger } from "../logging";
import { ENV } from "../utils/env";

export async function initConfig(syncSchema = true) {
    configEnv();
    initLogger();
    return await setDB(syncSchema)
}

export function configEnv() {
    const env = process.env.NODE_ENV;

    if (!env) {
        throw new Error("process.env.NODE_ENV is not defined");
    }
    let configPath = path.resolve(__dirname, `./dotenv/${env}.env`);
    logger.info("config env using path: ", configPath);
    let result = require("dotenv").config({ path: configPath });
    if (result.error) {
        throw result.error
    }

}

async function setDB(syncSchema = true) {
    await orm.connect();

    const env = process.env.NODE_ENV;
    if (syncSchema && env === ENV.dev) {
        try {
            return await orm.getConnection().syncSchema(true);
        } catch (e) {
            logger.error("failed to connect with mysql", e);
            throw e;
        }
    }
}