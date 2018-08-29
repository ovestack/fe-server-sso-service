var {
    has,
    getUrl,
    config
} = require('./')

module.exports = async function (ctx, next) {
    if (config.exclude.indexOf(ctx.path) === 0) {
        return await next()
    }
    if (await has(config.getToken(ctx))) {
        await next()
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