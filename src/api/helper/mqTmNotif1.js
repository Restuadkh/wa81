const amqp = require('amqplib/callback_api');
// const url_t2 = 'amqp://simrs:rmq187@192.168.201.19:5672'
// const Q_TMWAGW = 'tmgw.notif'
const url_t2 = 'amqp://simrs:rmq187@127.0.0.1:5672'
const Q_TMWA_1 = 'tm_queue'


module.exports = async function tm_notif1(msg, phn, img = '') {
    amqp.connect(url_t2, (connError, connection) => {
        if (connError) {
            console.log(`RMQ connection (1) error:: ${connError} !!`)
            // throw connError;
            return false;
        }

        connection.createChannel((channelError, channel) => {
            if (channelError) {
                console.log(`RMQ channel error ${Q_TMWA_1} !!`)
                // throw channelError;
                return false;
            }

            channel.assertQueue(Q_TMWA_1);

            // const dt = { msg: msg, to: 'ch.187i', phn: phn, pict: img }
            const dt = { msg: msg, to: 'ch.rme', phn: phn, pict: img }
            channel.sendToQueue(Q_TMWA_1, Buffer.from(JSON.stringify(dt)))
            console.log(`[Message send]ch.187x::${JSON.stringify(dt)}`)

            /*
            if (phn !== 'status@broadcast') {
                let nowTime = new Date();
                let hour = nowTime.getHours();
                let ntg1 = msg.toLowerCase().indexOf('lapor')
                let ntg2 = msg.toLowerCase().indexOf('sim')
                let fwd = true
                fwd = fwd || (msg.indexOf('#') >= 0 && msg.indexOf('#') < 5)
                fwd = fwd || (ntg1 >= 0 && ntg1 < 5) || (ntg2 >= 0 && ntg2 < 7)
                console.log(`${new Date().toLocaleString()} [tm_notif1] fwd:${fwd}|h:${hour}|t1:${ntg1}|t2:${ntg1}`)

                // if (fwd) {
                //     const dg = { msg: msg, to: 'group', phn: phn, pict: img }
                //     channel.sendToQueue(Q_TMWA_1, Buffer.from(JSON.stringify(dg)))
                //     console.log(`[Message send]group ${JSON.stringify(dg)}`)
                // }
            }
            */

            console.log(`${new Date().toLocaleString()} end-of-mQueue___________________________________________\n`)
            setTimeout(function () {
                connection.close()
                return
            }, 255);
        })
    })
}
