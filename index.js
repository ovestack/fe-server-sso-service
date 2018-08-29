var util = require('util')
var request = require('request')
var redis = requireMod('redis')()
const zk = requireMod('zookeeper')
var logger = getLogger('zk-sso-service')

var DEF_CONF = {
    serviceMark: 'ovestack',
    exclude: [],
    tokenKey: 'ssoToken',
    redirect(ctx) {
        return `${ctx.protocol}://${ctx.get('host')}${ctx.originalUrl}`
    },
    getToken(ctx) {
        return ctx.session[this.tokenKey]
    }
}
var config = exports.config = Object.assign(DEF_CONF, getConfig().sso || {})
const REDIS_TOKEN_KEY = config.tokenKey
const SERVICE_MARK = config.serviceMark

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
var getUrl = exports.getUrl = function(type) {
    switch (type) {
        default:
            return getData(`/sso/${type}`).catch(err => {
                logger.error(err)
            })
    }
}

/**
 * 校验token
 * @param {*} token 
 */
exports.verify = async function (token) {
    var url = await getUrl('verify')
    try {
        var re = await util.promisify(request)({
            url,
            qs: {
                token,
                service: SERVICE_MARK
            },
            json: true
        })
        if (re.body && re.body.code === 200) {
            await store(token)
        } else {
            return re.message
        }
    } catch (err) {
        return err
    }
    
}

/**
 * 获取用户信息
 * @param {*} token 
 */
exports.getUser = async function (token) {
    var url = await getUrl('user')
    var re = await util.promisify(request)({
        url,
        headers: {
            'x-token': token
        },
        json: true
    })
    return re.body
}

/**
 * 客户端保存登陆态
 */
var store = exports.store = function (token) {
    return redis.zadd(REDIS_TOKEN_KEY, 1, token)
}

exports.restore = function (token) {
    return redis.zrem(REDIS_TOKEN_KEY, token)
}

exports.has = function (token) {
    return redis.zscore(REDIS_TOKEN_KEY, token)
}