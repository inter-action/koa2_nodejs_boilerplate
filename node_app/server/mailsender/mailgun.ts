import * as https from "https"
import * as querystring from "querystring"
import * as path from "path";

import * as ejs from "ejs";

import { logger } from "../logging"
import { BytesReader } from "../utils"

// https://documentation.mailgun.com/api-sending.html#sending
// http://stackoverflow.com/questions/6158933/how-to-make-an-http-post-request-in-node-js

// should have used superagent
// todo: move config info out.

// options = {
//     from: "Mailgun Sandbox <postmaster@sandbox2f07aac2c5e04826a0fffb549244596d.mailgun.org>",
//     to: "jing.miao <243127395@qq.com>",
//     subject: "Hello jing.miao",
//     text: "Congratulations jing.miao, you just sent an email with Mailgun!  You are truly awesome!  You can see a record of this email in your logs: https://mailgun.com/cp/log .  You can send up to 300 emails/day from this sandbox server.  Next, you should add your own domain so you can send 10,000 emails/month for free."
// }
interface IMailOptions {
    from?: string
    to: string
    subject: string
    html: string,
}


export function loadTplPr(filename: string, data: Object) {
    let ejsOptions = {
        root: path.resolve(__dirname, "templates"),
        filename: filename,
        cache: true,
        // debug: true
    }
    return new Promise<string>((resolve, reject) => {
        ejs.renderFile(path.resolve(ejsOptions.root, filename), data, ejsOptions, (err, str) => {
            if (err) reject(err)
            else resolve(str)
        });
    })
}

/**
 *
 * send mail throgh mailgun.
 *
 * @export
 * @param {IMailOptions} options
 * @returns Promise<object>
 */
export function sendmail(options: IMailOptions) {
    if (!options.from) options.from = "Mailgun Sandbox <postmaster@sandbox2f07aac2c5e04826a0fffb549244596d.mailgun.org>"
    const payload = querystring.stringify(options)

    const httpsOptions = {
        hostname: "api.mailgun.net",
        port: 443,
        path: "/v3/sandbox2f07aac2c5e04826a0fffb549244596d.mailgun.org/messages",
        auth: "api:key-441c89e823b944daf0d0ca128a7e38c4",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Content-Length": Buffer.byteLength(payload)
        },
        method: "POST"
    };
    const request = https.request(httpsOptions);
    request.write(payload)
    request.end()

    return new Promise<any>((resolve, reject) => {

        request.on("response", (res: any) => {
            const reader = new BytesReader()
            res.pipe(reader)
            reader.on("finish", () => {
                const respStr = reader.buffer.toString("utf8")
                if (res.statusCode === 200) {
                    logger.info("sending email succed: ", )
                    resolve(respStr)
                } else {
                    reject(new Error(`request failed: ${res.statusCode}, ${respStr}`))
                }
            })
            reader.on("error", err => {
                reject(err)
            })
        })

        request.on("error", (err) => {
            logger.error({ error: err.message }, `sending email failed: ${err.message}`)
            reject(err)
        })
    })
}
