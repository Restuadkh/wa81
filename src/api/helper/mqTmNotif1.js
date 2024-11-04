const amqp = require('amqplib/callback_api');
const url_t2 = 'amqp://simrs:rmq187@192.168.201.19:5672'
const Q_TMWAGW = 'tmgw.notif'

let lsSimrsGroup = ['.']
let lshappybday = ['.']

module.exports = async function tm_notif1(msg, phn, img = '') {
    if (msg == '' && img == '' && phn > '') {
        lshappybday.push(phn)
        console.log(`lshappybday :: ${lshappybday}`)
        return
    }
    amqp.connect(url_t2, (connError, connection) => {
        if (connError) {
            console.log(`RMQ connection (1) error:: ${connError} !!`)
            // throw connError;
            return false;
        }

        connection.createChannel((channelError, channel) => {
            if (channelError) {
                console.log(`RMQ channel error ${Q_TMWAGW} !!`)
                // throw channelError;
                return false;
            }

            channel.assertQueue(Q_TMWAGW);

            const dt = { msg: msg, to: 'ch.wa-gw', phn: phn, pict: img };
            channel.sendToQueue(Q_TMWAGW, Buffer.from(JSON.stringify(dt)));

            let nowTime = new Date();
            let hours = nowTime.getHours();
            let fwd = (hours < 6 || hours > 7) && !lshappybday.includes(phn) && msg.indexOf('#Feedback-Presensi') < 0
            console.log(`[Message send]ch.wa-gw  fwd:${fwd}|${hours}|${JSON.stringify(dt)}`);

            if ((msg.indexOf('#') >= 0 && msg.indexOf('#') < 5) || fwd || lsSimrsGroup.includes(phn)) {
                const dg = { msg: msg, to: 'group', phn: phn, pict: img }
                channel.sendToQueue(Q_TMWAGW, Buffer.from(JSON.stringify(dg)))
                console.log(`[Message send]group ${JSON.stringify(dg)}`)

                if (!lsSimrsGroup.includes(phn)) lsSimrsGroup.push(phn)
                console.log(`lsSimrsGroup :: ${lsSimrsGroup}`)
            }

            console.log(`${new Date().toLocaleString()} end-of-mQueue___________________________________________\n`)
            setTimeout(function () {
                connection.close()
                return
            }, 255);
        })
    })
}
