const { downloadContentFromMessage } = require('@whiskeysockets/baileys')


module.exports = async function downloadMessage(msg, msgType, rBuff = 0) {
    let nTry = 1, buffer
    while (nTry < 8) {
        buffer = Buffer.from([])
        try {
            const stream = await downloadContentFromMessage(msg, msgType)
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk])
            }
            break
        } catch (e) {
            console.log(`\nERROR downloadMessage ${msgType}|${nTry}|${e}|\n${JSON.stringify(msg)}\n`)
            new Promise((resolve) => { setTimeout(resolve, 3_300) })
        }
        nTry++
    }

    if (nTry > 7)
        return null
    else if (rBuff)
        return buffer
    else
        return buffer.toString('base64')
}