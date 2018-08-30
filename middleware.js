var util = require('util')
var request = require('request')
var logger = getLogger('zk-sso-service')
var {
    checkLogin,
    getUrl,
    config,
    store
} = require('./')

const SERVICE_MARK = config.serviceMark
const SSO_KEY= `${config.serviceMark}:${config.key}`

module.exports = async function (ctx, next) {
    if (config.exclude.some(path => {
        return ctx.path === path
    })) {
        return await next()
    }
    if (await checkLogin(ctx)) {
        await next()
    } else if (ctx.query.ticket && ctx.query.redirect_url) {
        await verify(ctx, next)
    } else {
        let url = await getUrl('check')
        let redirect_url = config.redirect(ctx)
        ctx.redirect(
            `${url}?service=${config.serviceMark}&redirect_url=${redirect_url}`
        )
    }
}

module.exports.cors = async (ctx, next) => {
    var origin = ctx.get('origin') || '*'
    var header = {
        'Access-Control-Allow-Credentials': true,
        'Access-Control-Allow-Origin': origin
      }
    ctx.set(header)
    await next()
}

var verify = async function (ctx, next) {
    var url = await getUrl('verify')
    var {
        ticket,
        redirect_url
    } = ctx.request.query
    try {
        var re = await util.promisify(request)({
            url,
            qs: {
                ticket,
                service: SERVICE_MARK
            },
            json: true
        })
        if (re.body && re.body.code === 200) {
            re = re.body.result
            await store(re)
            ctx.cookies.set(
                SSO_KEY,
                re.sessionId,
                {
                    maxAge: re.expired
                }
            )
            ctx.redirect(redirect_url)
        } else {
            logger.error(re.body.message)
            await next()
        }
    } catch (err) {
        logger.error(err.message)
        await next()
    }
}