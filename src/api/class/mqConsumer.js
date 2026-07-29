const amqp = require('amqplib/callback_api')
const validPhnNumber = require('../helper/validPhnNumber')
const QUEUE = 'wa.notif'
const url_t2 = 'amqp://simrs:rmq187@192.168.201.19:5672'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

class MsgQueue {
    observer = undefined
    constructor(WaInstance) {
        this.observer = WaInstance
        this.connect()
    }

    connect() {
        amqp.connect(url_t2, (connError, connection) => {
            if (connError) {
                console.log(
                    `\n${new Date().toLocaleString()} RMQ connection error ${url_t2} ::${connError}!\n`
                )
                setTimeout(() => this.connect(), 87_000) // retry connect setelah 87 detik
                return
            }

            connection.on('error', (err) => {
                console.log(`RMQ connection error: ${err}`)
            })
            connection.on('close', () => {
                console.log('RMQ connection closed, reconnecting...')
                setTimeout(() => this.connect(), 87_000)
            })

            connection.createChannel((channelError, channel) => {
                if (channelError) {
                    console.log(
                        `${new Date().toLocaleString()} RMQ channel error ::${channelError}\n`
                    )
                    return
                }

                channel.assertQueue(QUEUE)
                channel.consume(QUEUE, (m) => this.send_msg(m), { noAck: true })
                console.log(
                    `${new Date().toLocaleString()} [*] Wait MsgQueue on queue ${QUEUE}`
                )
            })
        })
    }

    async send_msg(msg) {
        // ... isi tetap sama, tapi ganti setTimeout kosong jadi await sleep(87_000)

        let np = 1,
            ck = '',
            img = '',
            note = '',
            dt = JSON.parse(msg.content.toString())
        console.log('Consume wa.notif : ', msg)
        if (typeof dt !== 'object') {
            console.log('dt : object')
            return false
        }
        if (
            typeof dt.key !== 'string' ||
            dt.key !== '#187' ||
            typeof dt.phn !== 'string' ||
            typeof dt.mx !== 'string'
        ) {
            console.log('dt : string / !187')
            return false
        }
        if (
            typeof dt.img === 'string' &&
            (dt.img > 'A' || dt.img.indexOf('/Download/tm/') === 0)
        )
            img = dt.img
        if (typeof dt.note === 'string' && dt.note > '') note = dt.note
        if (dt.mx === '.reStartService') {
            console.log(`\n»»${new Date().toLocaleString()} ${dt.mx}\n\n`)
            let nowTime = new Date()
            let timeDiff = (nowTime.valueOf() - my_app_up.valueOf()) / 1000
            my_app_up = new Date()
            if (Math.round(timeDiff / 60) > 2) {
                // tm_notif81(`⚠️WaGw1 ${dt.mx}`)
                // setTimeout(function () { process.exit(1) }, 7_000)
            } // else tm_notif81(`⚡️WaGw1 skip ${dt.mx} |${my_app_up}`)
            return 1
        }

        const phnId = validPhnNumber(dt.phn)
        if (
            (phnId.substring(0, 2) === '62' && phnId > '628') ||
            phnId.includes('@lid')
        ) {
            while (np >= 0) {
                console.log(
                    `\n»»${new Date().toLocaleString()} #${
                        4 - np
                    } --> ${phnId}|${img}|${dt.mx}`
                )
                if (await this.observer.updateMsg(phnId, dt.mx, img, note)) {
                    np = 1
                    break
                }
                np--
                if (np >= 0) await sleep(87_000)
            }
        }
        if (np < 0) console.log('FAIL ::', np, '|', phnId, '|', dt)
    }
}

exports.MsgQueue = MsgQueue
