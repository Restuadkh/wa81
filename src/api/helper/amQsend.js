const amqp = require('amqplib/callback_api');
const url_t2 = process.env.RMQ_URL
const QUEUE_TM = 'tm_queue'

module.exports = async function amQsend(msg) {
    amqp.connect(url_t2, (connError, connection) => {
        if (connError) {
            console.log(`RMQ connection (0) error:: ${connError} !!`)
            // throw connError;
            return false;
        }
        connection.on('error', (err) => {
            console.log(`RMQ connection error: ${err}`)
        })
        connection.createChannel((channelError, channel) => {
            if (channelError) {
                console.log(`RMQ channel error ${QUEUE_TM} !!`)
                // throw channelError;
                return false;
            }
            channel.assertQueue(QUEUE_TM);

            const dt = { msg: msg, to: 'ch.187', phn: '' }
            channel.sendToQueue(QUEUE_TM, Buffer.from(JSON.stringify(dt)))
            console.log(`[mQsend] tm_notif81 ${new Date().toLocaleString()} ${JSON.stringify(dt)}`)

            setTimeout(function () {
                connection.close()
                return
            }, 255);
        })
    })
}


