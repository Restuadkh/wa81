const amqp = require('amqplib/callback_api')
const { validPhnNumber } = require('../helper/validPhnNumber')

const url_t2 = 'amqp://simrs:rmq187@192.168.201.19:5672'
const QUEUE_WA = 'wa_adm.notif_'


class MsgQueue {
    observer = undefined
    constructor(WaInstance) {
        this.observer = WaInstance
        amqp.connect(url_t2, (connError, connection) => {
            if (connError) {
                console.log(`\n${new Date().toLocaleString()} RMQ CONNECTION ERROR ${url_t2} ::${connError} !\n`)
                setTimeout(function () { }, 123_000)
                throw connError
                // return false;
            }

            connection.createChannel((channelError, channel) => {
                if (channelError) {
                    console.log(`${new Date().toLocaleString()} RMQ channel error ::${channelError}\n`)
                    setTimeout(function () { }, 123_000)
                    throw channelError
                    // return false;
                }

                let ntry = 310
                while (!this.observer?.instance?.online && ntry > 0) {
                    new Promise((resolve) => { setTimeout(resolve, 555) })
                    ntry--
                }

                // setTimeout(async () => {
                channel.assertQueue(QUEUE_WA)
                channel.consume(QUEUE_WA, (m) => this.send_msg(m), { noAck: true })
                console.log(`${new Date().toLocaleString()} [*] Wait MsgQueue on queue ${QUEUE_WA}`)
                // }, 101_000)
                // console.log(`${new Date().toLocaleString()} [*] eoc MsgQueue.constructor`)
            })
        })
    }


    async send_msg(msg) {
        let np = 1, ck = '', img = '', note = '', dt = JSON.parse(msg.content.toString())
        if (typeof dt !== 'object')
            return false
        if (typeof dt.key !== 'string' || dt.key !== '#81' || typeof dt.phn !== 'string' || typeof dt.mx !== 'string') {
            try {
        	console.log(typeof dt.data, dt.data)
                if (typeof dt.phn === 'string' && dt.phn === '_phn_priority_' && dt.data)
                    await this.observer.updtTheGoodclients(dt.data)
            } catch (e) {
                console.log('Error cli@MsgQueue::', e)
            }
            return false
        }
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
                // tm_notif81(`⚠️Wa81 ${dt.mx}`)
                setTimeout(function () { process.exit(1) }, 7_000)
            } // else tm_notif81(`⚡️Wa81 skip ${dt.mx} |${my_app_up}`)
            return 1
        }

        const phnId = validPhnNumber(dt.phn)
        if (phnId.length > 8 && "69".indexOf(phnId.substring(0, 1)) >= 0) {
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