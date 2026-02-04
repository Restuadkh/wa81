const amqp = require('amqplib/callback_api');
const url_t2 = 'amqp://simrs:rmq187@192.168.201.19:5672'
const Q_TMWAGW = 'tmgw.notif'

let lsSimrsGroup = ['.']
let lshappybday = ['.']

module.exports = async function tm_notif1(msg, phn, img = '') {
    if (msg === '' && img === '' && phn > '') {
        let pid = ("" + phn).replace(/\D/g, "")
        lshappybday.push(pid)
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

            const dt = { msg: msg, to: 'ch.wa-gw', phn: phn, pict: img }
            channel.sendToQueue(Q_TMWAGW, Buffer.from(JSON.stringify(dt)))
            console.log(`[Message send]ch.wa-gw::${JSON.stringify(dt)}`)

            if (phn !== 'status@broadcast') {
                let nowTime = new Date();
                let hour = nowTime.getHours();
                let ntg1 = msg.toLowerCase().indexOf('lapor')
                let ntg2 = msg.toLowerCase().indexOf('sim')
                // let fwd = (hour < 6 || hour >= 7) && !lshappybday.includes(phn) && msg.indexOf('#Feedback-Presensi') < 0
                let pid = ("" + phn).replace(/\D/g, "")
                let fwd = !lshappybday.includes(pid) && msg.indexOf('#Feedback-Presensi') < 0
                fwd = fwd || lsSimrsGroup.includes(phn)
                fwd = fwd || (ntg1 >= 0 && ntg1 < 5) || (ntg2 >= 0 && ntg2 < 7)
                fwd = fwd || (msg.indexOf('#') >= 0 && msg.indexOf('#') < 5 && msg.indexOf('#Feedback-Presensi') < 0)
                console.log(`${new Date().toLocaleString()} [tm_notif1] fwd:${fwd}|h:${hour}|t1:${ntg1}|t2:${ntg1}`, lsSimrsGroup.includes(phn))

                if (fwd) {
                    const dg = { msg: msg, to: 'group', phn: phn, pict: img }
                    channel.sendToQueue(Q_TMWAGW, Buffer.from(JSON.stringify(dg)))
                    console.log(`[Message send]group ${JSON.stringify(dg)}`)

                    if (!lsSimrsGroup.includes(phn)) lsSimrsGroup.push(phn)
                    console.log(`lsSimrsGroup :: ${lsSimrsGroup}`)
                }
            }

            console.log(`${new Date().toLocaleString()} end-of-mQueue___________________________________________\n`)
            setTimeout(function () {
                connection.close()
                return
            }, 255);
        })
    })
}