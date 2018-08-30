var redis = requireMod('redis')()
const zk = requireMod('zookeeper')
var logger = getLogger('zk-sso-service')

var DEF_CONF = {
    serviceMark: 'ovestack',
    exclude: [],
    prefix: 'sso:ss',
    key: 'sso.sid',
    redirect(ctx) {
        return `${ctx.protocol}://${ctx.get('host')}${ctx.originalUrl}`
    }
}
var config = exports.config = Object.assign(DEF_CONF, getConfig().sso || {})

const REDIS_KEY = config.prefix
const SSO_KEY= `${config.serviceMark}:${config.key}`

var getData = function(path) {
    return new Promise(function(resolve, reject) {
        zk.getData(path, function(event) {}, function(error, data, stat) {
            if (error) {
                reject(error.stack)
            }
            resolve(data.toString('utf8'))
        })
    })
}

/**
 * 获取服务地址
 */
exports.getUrl = function(type) {
    switch (type) {
        default:
            return getData(`/sso/${type}`).catch(err => {
                logger.error(err)
            })
    }
}

/**
 * 客户端保存登陆态
 */
exports.store = function ({
    sessionId,
    expired,
    userInfo
}) {
    return redis.setex(`${REDIS_KEY}:${sessionId}`, expired, JSON.stringify(userInfo))
}

exports.restore = function (sessionIds) {
    return Promise.all(
        sessionIds.map(sessionId => {
            return redis.del(`${REDIS_KEY}:${sessionId}`)
        })
    )
}

exports.checkLogin = async function (ctx) {
    var sessionId = ctx.cookies.get(SSO_KEY)
    return sessionId && await redis.get(`${REDIS_KEY}:${sessionId}`)
}

exports.getUser = async function (ctx) {
    var sessionId = ctx.cookies.get(SSO_KEY)
    var re = await redis.del(`${REDIS_KEY}:${sessionId}`)
    if (re) {
        return JSON.parse(re)
    }
}