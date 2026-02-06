const { downloadContentFromMessage } = require('baileys')


module.exports = async function downloadMessage(msg, msgType, rBuff = 0) {
    let buffer = Buffer.from([])
    try {
        const stream = await downloadContentFromMessage(msg, msgType)
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk])
        }
    } catch (e) {
        logger.error(e)
        return console.log('error downloading file-message')
    }
    if (rBuff)
        return buffer
    else
        return buffer.toString('base64')
}
