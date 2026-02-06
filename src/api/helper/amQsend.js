const { Worker } = require('worker_threads')
const QUEUE_TM = 'tm_queue_'
const Q_WA_GW = 'wa.notif_'


async function amQsend(msg, tch='ch.187') {
    setTimeout(async () => {
        try {
            const dt = {
                to: tch,
                msg: msg,
                phn: ''
            }
            const worker = new Worker('./src/api/helper/workerMq.js', { workerData: { ch: QUEUE_TM, dt: dt } })
            worker.on("error", error => { console.log(`got error :: ${error}`) })
        } catch (e) {
            console.log('Error amQsend ::: ', e)
        }
    }, 3)
}

async function gw_notif2(msg) {
    try {
        const dt = {
            'phn': '6281904000707@s.whatsapp.net',
            'mx': msg,
            'key': '#187'
        };
        const worker = new Worker('./src/api/helper/workerMq.js', { workerData: { ch: Q_WA_GW, dt: dt } })
        worker.on("error", error => { console.log(`got error :: ${error}`) })
        // worker.on("message", result => { console.log(`got result :: ${result}`) });
    } catch (e) {
        console.log('Error gw_notif2 ::: ', e)
    }
}

module.exports = { amQsend, gw_notif2 }