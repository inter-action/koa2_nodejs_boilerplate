import * as Koa from 'koa'
import * as http from 'http'
import routes from './routes'

const app = new Koa()

app.use(async (ctx, next) => {
    const start = new Date();
    await next();
    const ms = new Date().getTime() - start.getTime();
    console.log(`${ctx.method} ${ctx.url} - ${ms}ms`);
});


app.use(routes.routes());

// handle uncaught error. replace console with logger 
app.on('error', function (err: any) {
    console.log('server error', err);
});

process.on('uncaughtException', console.error);

// app.listen(9000);
const server = http.createServer(app.callback()).listen(9000)
export { app, server };