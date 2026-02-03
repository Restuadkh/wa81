const { parentPort, workerData } = require('worker_threads')
const amqp = require('amqplib/callback_api')
const url_t2 = 'amqp://simrs:rmq187@192.168.201.19:5672'


parentPort.postMessage(mQsend(workerData.ch, workerData.dt))

function mQsend(ch, dt) {
    amqp.connect(url_t2, (connError, connection) => {
        if (connError) {
            console.log(`RmQ connection error:: ${connError} !!`)
            return connError
        }
        connection.createChannel((channelError, channel) => {
            if (channelError) {
                console.log(`RmQ channel error ${ch} !!`)
                return channelError
            }
            channel.assertQueue(ch)
            channel.sendToQueue(ch, Buffer.from(JSON.stringify(dt)))
            console.log(`[Mq send] ${new Date().toLocaleString()} ${JSON.stringify(dt)}`)
            setTimeout(() => {
                connection.close()
                return true
            }, 101)
        })
    })
}