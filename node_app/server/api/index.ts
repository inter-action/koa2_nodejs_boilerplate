import * as Router from "koa-router"
import * as koaPassport from "koa-passport";

import { User, getUserAccess } from "../entities";
import { tv_show } from "./tv_show";
import { AuthMiddlewares } from "../middleware";


export const apiRoutes = new Router({ prefix: "/api" })
    .post("/register", async (ctx) => {
        const body = ctx.request.body;
        let result = User.validateUserView(body)
        if (result.exists()) {
            throw result.get();
        }
        let user = User.convertUser(body)
        user.password = await User.createHashPr(user.password);
        await getUserAccess().getRespsitory().persist(user)
        ctx.status = 200;
    })
    // return a bearer token for auth. using username & password
    .post("/auth", koaPassport.authenticate("local", { session: false }), async (ctx) => {
        // bussiness logic specific, shouldn"t be included in here
        // if (ctx.req.user.status === 0) {
        //     throw new errors.AppError("user is not activated", 400);
        // }
        // if (ctx.req.user.status === 6) {
        //     throw new errors.AppError("user is locked", 400);
        // }
        let token = await User.createTokenPr(ctx.req.user);
        ctx.body = { data: token }
    })
    // pass on a valid bearer token
    .get("/test_auth", AuthMiddlewares.ensureBearerToken, async ctx => {
        ctx.status = 200;
        ctx.body = "hey you reached me";
    })
    .get("/", (ctx) => {
        ctx.body = "Hello api";
    })



apiRoutes.use(tv_show.routes(), tv_show.allowedMethods());
