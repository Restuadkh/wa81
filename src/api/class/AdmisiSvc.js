const path = require('path')
const grpc = require('@grpc/grpc-js')
const protoLoader = require('@grpc/proto-loader')

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let instance = null


class AdmisiSvc {
    admStub = null
    busy = true
    lsCancel = []

    constructor() {
        this.__startStub()
        this.busy = false
    }

    static getInstance() {
        return instance ? instance : new AdmisiSvc();
    }

    async __startStub() {
        const pkgDefAdm = protoLoader.loadSync(path.join(__dirname, '../protos/admition.proto'))
        const admProto = grpc.loadPackageDefinition(pkgDefAdm)
        this.admStub = new admProto.Adm('192.168.201.19:5005', grpc.credentials.createInsecure())
    }

    async list2Cancel(token) {
        if (token === '')
            this.lsCancel = []
        else
            this.lsCancel.push(token)
    }

    async isTokenCanceled(token) {
        return this.lsCancel.includes(token)
    }

    async reservation(req, token = '') {
        var waitTimeOut = 188098
        let rqt = 0, nd = 1, rt
        if (token !== '' && this.lsCancel.includes(token)) {
            if (token.length > 4)
                rt = { res: '*double request*⚠️, silakan coba beberapa saat lagi' }
            else
                rt = { res: ' 🙏🏻' }
            console.log(`## reservation@AdmisiSvc lsCancel::${token}`, rt)
            this.lsCancel = this.lsCancel.filter(x => x !== token)
            return rt
        }
        while (this.busy && waitTimeOut) {
            if (rqt == 0) {
                rqt = new Date().getTime()
                if ((rqt - 1_684_861_200_000) % 86_400_000 > 39_000) this.lsCancel = []
            }
            await sleep(nd)
            if (token !== '' && this.lsCancel.includes(token)) {
                console.log(`## reservation@AdmisiSvc lsCancel::${token}`, req)
                nd = 0
                break
            }
            if (!this.busy) break;
            waitTimeOut--
            if (waitTimeOut % 19 === 17) console.log(`## AdmisiSvc ${rqt % 1_000_000} #${new Date().getTime() - rqt}::`, req)
        }
        if (this.busy || nd === 0) {
            rt = { res: '*double request* ⚠️\nsilakan coba beberapa saat lagi' }
            console.log(`## reservation@AdmisiSvc busy::${token}`, rt)
        } else {
            this.busy = true
            rt = await this.__do_rsv(req, 2)
            this.busy = false
        }
        if (token !== '' && this.lsCancel.includes(token)) {
            this.lsCancel = this.lsCancel.filter(x => x !== token)
        }
        return rt
    }

    async __do_rsv(req, nTry) {
        nTry--
        let nx = 0 //, timeout = new Date().getTime() + 5_000
        try {
            const response = await new Promise((resolve, reject) => {
                // this.admStub.BookingQueue(req, { deadline: timeout }, (err, result) => {
                this.admStub.BookingQueue(req, (err, result) => {
                    if (err) {
                        nx = err.code
                        reject(err.message)
                    } else {
                        nx = 0
                        this.busy = false
                        resolve(result)
                    }
                })
            })
            return response
        } catch (e) {
            let ts = (new Date()).toISOString()
            console.log(`_________Error reservation@AdmisiSvc ${ts}${nTry}|${req.msg}:: ${nx}|`, e)
            if (nx === 14) {
                await sleep(757)
                await this.__startStub()
            }
            if (nTry < 1) return { err: `Error ${nx}\n${ts}\n${e}\n${req.msg}\n\n${e.stack}` }
            await sleep(321)
            return await this.__do_rsv(req, nTry)
        }
        // ToDo :: set-read-timeout <--
    }

}

module.exports = AdmisiSvc;