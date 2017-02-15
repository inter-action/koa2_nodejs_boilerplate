import * as chai from 'chai'
const glob = require('glob');

// KnexInstance
import { server } from '../../server/index'
import { KnexInstance, KnexConstants } from '../../server/data/db'

const chaiHttp = require('chai-http')
const should = chai.should()

const expect = chai.expect
chai.use(chaiHttp);

export function dbSeed() {
    return async _ => {
        await KnexInstance.migrate.rollback(KnexConstants.MIGRATION)
        await KnexInstance.migrate.latest(KnexConstants.MIGRATION)
        return await KnexInstance.seed.run(KnexConstants.SEED)
    }
}

export function dbRollback() {
    return async _ => {
        return await KnexInstance.migrate.rollback(KnexConstants.MIGRATION);
    }
}

// load from config/test.env, but i hate context switching
let methodBlackList: RegExp[] = [
    // /^tv_show/gi
];

export function runWithFilter(cb: (module: any, key: string, hasSideEffect: boolean) => void) {
    // options is optional
    glob(`${__dirname}/api/**/*.js`, function (err, files) {
        if (err) throw err;
        else {
            for (let i = 0; i < files.length; i++) {
                let filepath: string = files[i];
                let filename = filepath.substring(filepath.lastIndexOf('/') + 1);
                if (filename.indexOf('test') !== -1) {
                    console.log('skip test with no test keyword: ', filename);
                    continue;
                }

                if (methodBlackList.some(r => r.test(filename))) {
                    console.log(`skip test:  ${filename} in blacklist `);
                    continue;
                }

                let module = require(filepath);
                Reflect.ownKeys(module).forEach((k: string) => {
                    if (typeof module[k] !== 'function') return;

                    let hasSideEffect = true
                    if (/noSideEffect$/i.test(k)) {
                        hasSideEffect = false
                    }
                    cb(module, k, hasSideEffect)
                })
            }
        }

    })
}

export { chai, chaiHttp, server, should, expect, KnexInstance, KnexConstants }