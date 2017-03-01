import * as Router from 'koa-router';
import * as boom from 'boom';
import * as validator from 'validator';
const passport = require('koa-passport');
import * as _ from 'lodash';

import { getUserAccess, User } from '../entities';

import { Constants, decodeBase64URLsafe, encodeBase64URLsafe } from '../utils';
import { mailgun } from '../mailsender'

export const appRouts = new Router()

appRouts.get('/logout', async ctx => {
    ctx.logout();
    ctx.redirect('/')
});

appRouts.get('/login', async (ctx) => {
    await ctx.render('login')
})

appRouts.post('/login', async (ctx, next) => {
    let nuser = null;
    await passport.authenticate('local', (user) => {
        nuser = user;
    })(ctx, next);
    if (nuser) {
        ctx.logIn(nuser, (error) => {
            if (error) throw error;
            else ctx.redirect('/')
        })
    } else {
        await ctx.render('error', { msg: 'incorrect username or password' });
    }
})


appRouts.get('/forget-password', async (ctx) => {
    await ctx.render('forget_password');
});

appRouts.post('/forget-password', async (ctx) => {
    let body = ctx.request.body;
    if (!(_.isString(body.email) && validator.isEmail(body.email))) {
        throw boom.badData('email is required');
    }

    let result = await User.generateResetToken(Date.now() + Constants.TIME.ONE_DAY_MILI_SEC, body.email);
    if (result.isLeft()) throw result.getLeft();
    else {
        let html = await mailgun.loadTplPr('reset_password.ejs', { resetUrl: `http://localhost:9000/reset-password?token=${encodeBase64URLsafe(result.getRight())}` });
        await mailgun.sendmail({ to: body.email, subject: 'reset password', html })
        ctx.status = 200;
    }
});


appRouts.get('/reset-password', async (ctx) => {
    let query = ctx.request.query;
    if (!query.token) {
        throw boom.badData('token is required');
    }

    await ctx.render('reset_password', { token: query.token });
})

appRouts.post('/reset-password', async (ctx) => {
    let body = ctx.request.body;
    if (body.token == null || validator.isEmpty(body.token)) {
        throw boom.badData()
    }

    // should also check password length
    if (
        !body.password ||
        !body.repeatPassword ||
        validator.isEmpty(body.password) ||
        validator.isEmpty(body.repeatPassword) ||
        body.password !== body.repeatPassword) {

        throw boom.badData()
    }

    let tokenResult = await User.validateResetTokenPr(decodeBase64URLsafe(body.token));
    if (tokenResult.isLeft()) throw tokenResult.getLeft();
    else {
        let user = tokenResult.getRight();
        let usermodel = await getUserAccess().findOne({ email: user.email });
        ctx.assert(usermodel != null, 500, 'logic error');
        let typeAssuredUser = usermodel as User;
        typeAssuredUser.password = await User.createHashPr(body.password);
        let updated = await getUserAccess().getRespsitory().persist(typeAssuredUser);
        if (ctx.isUnauthenticated()) {
            ctx.logout()
        }
        ctx.logIn(updated, (error) => {
            if (error) throw error;
            else ctx.redirect('/')
        })
    }
})


// GET /auth/github
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  The first step in GitHub authentication will involve redirecting
//   the user to github.com.  After authorization, GitHub will redirect the user
//   back to this application at /auth/github/callback
appRouts.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));

// GET /auth/github/callback
//   Use passport.authenticate() as route middleware to authenticate the
//   request.  If authentication fails, the user will be redirected back to the
//   login page.  Otherwise, the primary route function will be called,
//   which, in this example, will redirect the user to the home page.
appRouts.get('/auth/github/callback',
    passport.authenticate('github', { failureRedirect: '/login', successRedirect: '/' }));

// has to be put in the last. Otherwise this route would get matched before others
appRouts.get('/', async (ctx) => {
    let option: any = {}
    if (ctx.req.user) {
        option.user = ctx.req.user
    }
    await ctx.render('index', option);
})
