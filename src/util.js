const { inspect } = require('util')

const rand = () => Math.round(Math.random() * 1000)
const getTimestamp = (date = new Date()) => Math.round((date.valueOf() / 1000))
const getDateStr = (date = new Date()) => `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`

const logMsg = (message, ...rest) => {
  const restStr = rest.reduce((acum, curr) => `${acum} ${inspect(curr)}`)
  console.log(new Date().toISOString(), message, restStr)
}

module.exports = {
  rand,
  logMsg,
  getDateStr,
  getTimestamp,
}
