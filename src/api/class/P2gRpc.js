const path = require('path')
const grpc = require('@grpc/grpc-js')
const protoLoader = require('@grpc/proto-loader')
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));


class P2gRpc {
    admStub = null
    port = '5007'
    busy = false
    busy2 = false
    lsCancel = []

    constructor(port = '') {
        if (port > '') this.port = port
        // console.log(`______________________________ constructor:${this.port} `)
        this.__startStub()
        this.busy = false
    }

    static getInstance(port = '') {
        // console.log(`____________________________ __getInstance:${port} `)
        return new P2gRpc(port);
    }

    async __startStub() {
        // console.log(`______________________________ __startStub:${this.port} `)
        const pkgDefAdm = protoLoader.loadSync(path.join(__dirname, '../protos/admition.proto'))
        const admProto = grpc.loadPackageDefinition(pkgDefAdm)
        this.admStub = new admProto.Adm(`192.168.201.19:${this.port}`, grpc.credentials.createInsecure())
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
        var waitTimeOut = 9898
        let rqt = 0, nd = 1, rt
        if (token !== '' && this.lsCancel.includes(token)) {
            if (token.length > 4)
                rt = { res: 'Maaf ada kendala pada sistem, silakan coba beberapa saat lagi' }
            else
                rt = { res: ' 🙏🏻' }
            console.log(`## reservation@p2gRpc lsCancel::${token}`, rt)
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
                console.log(`## reservation@p2gRpc lsCancel::${token}`, req)
                nd = 0
                break
            }
            if (!this.busy) break;
            waitTimeOut--
            if (waitTimeOut % 19 === 17) console.log(`## p2gRpc ${rqt % 1_000_000} #${new Date().getTime() - rqt}::`, req)
        }
        if (this.busy || nd === 0) {
            rt = { res: 'Maaf ada kendala teknis pada sistem,\nsilakan coba beberapa menit lagi🙏🏻' }
            console.log(`## reservation@p2gRpc busy::${token}`, rt)
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
        let nx = 0, timeout = new Date().getTime() + 27_000
        try {
            const response = await new Promise((resolve, reject) => {
                this.admStub.BookingQueue(req, { deadline: timeout }, (err, result) => {
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
            console.log(`_________Error reservation@p2gRpc:${this.port} ${ts}|${nTry}|${req.msg}:: ${nx}|`, e)
            if (nTry < 1) {
                this.busy = false
                return { err: `Error ${nx}:${this.port}\n${ts}\n${e}\n${req.msg}\n\n${e.stack}` }
            }
            if (nx === 14) await this.__startStub()
            await sleep(1010)
            return await this.__do_rsv(req, nTry)
        }
    }


    async chk(req, token = '') {
        var waitTimeOut = 9898
        let rqt = 0, nd = 1, rt
        while (this.busy2 && waitTimeOut) {
            if (rqt == 0) {
                rqt = new Date().getTime()
                if ((rqt - 1_684_861_200_000) % 86_400_000 > 39_000) this.lsCancel = []
            }
            await sleep(nd)
            if (token !== '' && this.lsCancel.includes(token)) {
                console.log(`## reservation@p2gRpc lsCancel::${token}`, req)
                nd = 0
                break
            }
            if (!this.busy2) break;
            waitTimeOut--
            if (waitTimeOut % 19 === 17) console.log(`## p2gRpc ${rqt % 1_000_000} #${new Date().getTime() - rqt}::`, req)
        }
        if (this.busy2 || nd === 0) {
            rt = { res: 'Maaf ada kendala teknis pada sistem,\nsilakan coba beberapa menit lagi🙏🏻' }
            console.log(`## reservation@p2gRpc busy3::${token}`, rt)
        } else {
            this.busy2 = true
            rt = await this.__do_chk(req, 2)
            this.busy2 = false
        }
        if (token !== '' && this.lsCancel.includes(token)) {
            this.lsCancel = this.lsCancel.filter(x => x !== token)
        }
        return rt
    }

    async __do_chk(req, nTry) {
        nTry--
        let nx = 0, timeout = new Date().getTime() + 9_000
        try {
            const response = await new Promise((resolve, reject) => {
                this.admStub.BookingChk(req, { deadline: timeout }, (err, result) => {
                    if (err) {
                        nx = err.code
                        reject(err.message)
                    } else {
                        nx = 0
                        this.busy2 = false
                        resolve(result)
                    }
                })
            })
            return response
        } catch (e) {
            let ts = (new Date()).toISOString()
            console.log(`_________Error reservation@p2gRpc:${this.port} ${ts}|${nTry}|${req.msg}:: ${nx}|`, e)
            if (nTry < 1) {
                this.busy2 = false
                return { err: `Error ${nx}:${this.port}\n${ts}\n${e}\n${req.msg}\n\n${e.stack}` }
            }
            if (nx === 14) await this.__startStub()
            await sleep(797)
            return await this.__do_chk(req, nTry)
        }
    }

}

module.exports = P2gRpc;