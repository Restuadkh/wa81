const amqp = require('amqplib/callback_api')
const validPhnNumber = require('../helper/validPhnNumber')
const QUEUE = 'wa.informasi.notif'
const url_t2 = 'amqp://simrs:rmq187@192.168.201.19:5672'

class MsgQueue {
    observer = undefined
    constructor(WaInstance) {
        this.observer = WaInstance
        amqp.connect(url_t2, (connError, connection) => {
            if (connError) {
                console.log(`\n${new Date().toLocaleString()} RMQ connection error ${url_t2} ::${connError} !\n`)
                setTimeout(function () { }, 87_000)
                // throw connError;
                return false;
            }

            connection.createChannel((channelError, channel) => {
                if (channelError) {
                    console.log(`${new Date().toLocaleString()} RMQ channel error ::${channelError}\n`)
                    setTimeout(function () { }, 87_000)
                    // throw channelError;
                    return false;
                }

                channel.assertQueue(QUEUE);
                channel.consume(QUEUE, (m) => this.send_msg(m), { noAck: true })
                console.log(`${new Date().toLocaleString()} [*] Wait MsgQueue on queue ${QUEUE}`)
            })
        })
    }

    async send_msg(msg) {
        let np = 1, ck = '', img = '', note = '', dt = JSON.parse(msg.content.toString())
        if (typeof dt !== 'object')
            return false
        if (typeof dt.key !== 'string' || dt.key !== '#187' || typeof dt.phn !== 'string' || typeof dt.mx !== 'string')
            return false
        if (typeof dt.img === 'string' && (dt.img > 'A' || dt.img.indexOf('/Download/tm/') === 0))
            img = dt.img
        if (typeof dt.note === 'string' && dt.note > '')
            note = dt.note
        if (dt.mx === '.reStartService') {
            console.log(`\n»»${new Date().toLocaleString()} ${dt.mx}\n\n`)
            let nowTime = new Date()
            let timeDiff = (nowTime.valueOf() - my_app_up.valueOf()) / 1000
            my_app_up = new Date()
            if (Math.round(timeDiff / 60) > 2) {
                // tm_notif81(`⚠️WA-Informasi ${dt.mx}`)
                setTimeout(function () { process.exit(1) }, 7_000)
            } // else tm_notif81(`⚡️WA-Informasi skip ${dt.mx} |${my_app_up}`)
            return 1
        }

        const phnId = validPhnNumber(dt.phn)
        if (phnId.substring(0, 2) === "62" && phnId > "628") {
            while (np >= 0) {
                console.log(`\n»»${new Date().toLocaleString()} #${4 - np} --> ${phnId}|${img}|${dt.mx}`)
                if (await this.observer.updateMsg(phnId, dt.mx, img, note)) {
                    np = 1
                    break
                }
                np--
                if (np >= 0) setTimeout(function () { }, 87_000)
            }
        }
        if (np < 0) console.log('FAIL ::', np, '|', phnId, '|', dt)
    }

}

exports.MsgQueue = MsgQueue