/* eslint-disable no-unsafe-optional-chaining */
const QRCode = require('qrcode')
const pino = require('pino')
const {
    default: makeWASocket,
    DisconnectReason,
    useMultiFileAuthState,
} = require('@whiskeysockets/baileys')
const { unlinkSync } = require('fs')
const { v4: uuidv4 } = require('uuid')
const path = require('path')
const processButton = require('../helper/processbtn')
const generateVC = require('../helper/genVc')
const sleep = require('../helper/sleep')
const { connectDB, getCollection } = require('../models/chat.model')
const axios = require('axios')
const config = require('../../config/config')
const downloadMessage = require('../helper/downloadMsg')
const logger = require('pino')()
const useMongoDBAuthState = require('../helper/mongoAuthState')
const fs = require('fs')
const fsp = require('fs').promises
const { amQsend, gw_notif2 } = require('../helper/amQsend')
const {
    validPhnNumber,
    waIdToPhnNumber,
    stringTrim,
    cTimeStamp,
    isFontStandart,
} = require('../helper/validPhnNumber')
const myToken = require('../helper/myToken')
const myWords = require('../helper/myWords')
const MyGrpc2 = require('./P2gRpc')

class WhatsAppInstance {
    socketConfig = {
        defaultQueryTimeoutMs: undefined,
        printQRInTerminal: false,
        logger: pino({
            level: config.log.level,
        }),
    }
    axiosInstance = axios.create({ baseURL: config.webhookUrl })
    key = ''
    authState
    allowWebhook = undefined
    webhook = undefined
    appState = 'Init Service'
    xConnState = true
    stsIniT = new Date().toISOString()
    con00 = 0
    cnt01 = 0
    cntWait = 3_333
    info2group = 0
    nBEerror = 0
    ID_rsdPS = '6281904000707@s.whatsapp.net'
    ID_rsdPS_lid = '6281904000707@s.whatsapp.net'
    ID_rsdGw = '6289510778377@s.whatsapp.net'
    ID_rsdGw_lid = '103663481704599@lid'
    ID_Admin = '628121549688@s.whatsapp.net'
    lsGoodclient = ['6287882917469', '6281328451789', '6282337992517']
    lsTrustedClient = [
        '6289510778377',
        '628112637570',
        '6285729363646',
        '6287882917469',
        '6281804150382',
    ]
    lsBotClient = ['6281808800055']
    lsTrialclient = ['6285729363646']
    lsBruteClient = []
    lsBruteRm = []
    clientIdnoBonus = []
    lastNoRequest = []
    noRspRm = []
    lsClientId = []
    lsWhData = []
    lsXmsg = []
    lsUnreadChats = []
    lsRevCanceled = []
    lsUnSent = []
    lsExResp = []
    lastUrC = ''
    isReSend = false
    p0_busy = false
    p1_busy = false
    prevMsgId = []
    prevMsgTd = []
    lsXclients = []
    pInfoRetry1 = []
    pInfoLate1 = []
    sXrm = ''
    sX2rm = '#?#'
    sXrmId = ''
    diskSts = '?#?#?'
    task01do = 0
    nextFetchBl = 0

    instance = {
        key: this.key,
        chats: [],
        qr: '',
        messages: [],
        qrRetry: 0,
        customWebhook: '',
    }

    constructor(key, allowWebhook, webhook) {
        // this.key = key ? key : uuidv4()
        this.key = key ? key : 'wa-81-adm'
        this.instance.customWebhook = this.webhook ? this.webhook : webhook
        this.allowWebhook = config.webhookEnabled
            ? config.webhookEnabled
            : allowWebhook
        if (this.allowWebhook && this.instance.customWebhook !== null) {
            this.allowWebhook = true
            this.instance.customWebhook = webhook
            this.axiosInstance = axios.create({ baseURL: webhook })
            this.__NoteSet(this.key, { s_construct: cTimeStamp() })
        }
    }

    async init(sts = '') {
        if (sts === '') {
            await this.getBlackList()
            this.lsXmsg = []
            this.prevMsgId = []
            this.prevMsgTd = []
            this.pInfoLate1 = []
        }
        this.collection = mongoClient.db('wa81-a').collection(this.key)
        // const { state, saveCreds } = await useMongoDBAuthState(this.collection)
        const { state, saveCreds } = await useMultiFileAuthState(
            './session/' + this.key
        )

        this.authState = { state: state, saveCreds: saveCreds }
        this.socketConfig.auth = this.authState.state
        this.socketConfig.browser = Object.values(config.browser)
        this.instance.sock = makeWASocket(this.socketConfig)
        await amQsend(
            `Wa81 init ...${sts}\ndf:${this.diskSts}\n${this.stsIniT}`
        )
        await this.SendWebhook(
            `Wa81 ${sts} ${this.appState}\ndf: ${this.diskSts}`,
            { tm: cTimeStamp(), sn: new Date().getTime() },
            this.key
        )
        this.setHandler()
        console.log(
            `:::IsOnline? ${this.instance.online} ${this.appState}::: Init WhatsAppInstance ---------------------------------------☑️?`
        )
        this.appState = 'Reload from ' + cTimeStamp()
        this.__NoteSet(this.key, { s_init: cTimeStamp() })
        return this
    }

    async SendWebhook(type, body, key) {
        if (!this.allowWebhook) return
        this.lsWhData.push([type, body, key])
        setTimeout(async () => {
            await this.__webHookPost()
        }, 5)
    }

    async __webHookPost() {
        if (this.lsWhData.length < 1) return
        let ls = [...this.lsWhData]
        this.lsWhData = []
        ls.map(async (d) => {
            await this.axiosInstance
                .post('', { type: d[0], body: d[1], instanceKey: d[2] })
                .catch(() => {})
        })
    }

    async __NoteSet(iKey, data) {
        if (process.env.WEBHOOK_ENABLED === 'true') {
            let r = await this.axiosInstance
                .put('note', { instanceKey: iKey, data: data })
                .catch((e) => {
                    console.log('Exception __NoteSet::', e.code, e)
                })

            console.log(`ikey = ${iKey}`)
            console.log(`data = ${JSON.stringify(data, null, 2)}`)
            if (r && r.data) return console.log(`__NoteSet(${iKey})::`, r.data)
        } else {
            return null
        }
    }

    async __NoteGet(iKey) {
        if (process.env.WEBHOOK_ENABLED === 'true') {
            const r = await this.axiosInstance
                .get(`${iKey}`)
                .then((res) => res.data)
                .catch((err) => {
                    console.log(`Exception __NoteGet ${iKey}::`, err.code, err)
                })
            if (r && r.data) return r.data
            console.log(`ikey = ${iKey}`)
            return r
        } else {
            return null
        }
    }

    setHandler() {
        logger.info('Info: setHandler...')
        const sock = this.instance.sock
        // on credentials update save state
        sock?.ev.on('creds.update', this.authState.saveCreds)

        // on socket closed, opened, connecting
        sock?.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update

            console.log(
                `${new Date().toLocaleString()} connection state: ${connection} |qr:${
                    this.instance.qr
                }`
            )

            if (connection === 'connecting') {
                this.con00++
                if (this.con00 % 2 === 1) {
                    this.prevMsgId = []
                    this.prevMsgTd = []
                    this.pInfoLate1 = []
                    await this.SendWebhook(
                        `Wa81.connecting... #${this.con00}\n${JSON.stringify(
                            lastDisconnect?.error?.output?.payload
                        )}`,
                        { tm: cTimeStamp(), sn: new Date().getTime() },
                        this.key
                    )
                    await amQsend(
                        `⚡️⚠️Wa81.connecting... #${
                            this.con00
                        }\n${JSON.stringify(
                            lastDisconnect?.error?.output?.payload
                        )}`
                    )
                }
                if (this.con00 > 33) this.con00 = 0
                await this.__NoteSet(this.key, { s_connecting: cTimeStamp() })
                return
            }
            if (connection !== 'close') {
                if (connection === 'undefined' && this.instance.online == true)
                    await this.SendWebhook(
                        `Wa81.sts online: ${this.instance.online}`,
                        { tm: cTimeStamp(), sn: new Date().getTime() },
                        this.key
                    )
                else if (
                    connection === 'open' &&
                    this.instance.online === false
                )
                    await this.SendWebhook(
                        `Wa81.conn.${connection}.................`,
                        { tm: cTimeStamp(), sn: new Date().getTime() },
                        this.key
                    )
                else if (
                    connection !== undefined &&
                    this.instance.online !== undefined
                )
                    await this.SendWebhook(
                        `Wa81.conn.${connection}|${this.instance.online}`,
                        { tm: cTimeStamp(), sn: new Date().getTime() },
                        this.key
                    )
            }

            if (connection === undefined) {
                if (this.instance.online) {
                    await sock.sendMessage(this.ID_rsdGw, { text: '/🔔' })
                    await amQsend('♻️WA-Pendaftaran is Online')
                } else {
                    // await amQsend('⛑WA-Pendaftaran is Offline')
                    // await amQsend('⛑WA-Pendaftaran is Offline', 'group')
                    // this.info2group++
                    await this.__NoteSet(this.key, {
                        s_undefined: cTimeStamp(),
                        i_group: 1,
                        info2group: this.info2group,
                    })
                }
            } else if (connection === 'close') {
                this.instance.online = false
                this.con00 = 0
                await this.SendWebhook(
                    `Wa81.close.${lastDisconnect?.error?.output?.statusCode}`,
                    { connection: connection },
                    this.key
                )
                await this.__NoteSet(this.key, { s_close: cTimeStamp() })
                if (
                    lastDisconnect?.error?.output?.statusCode !==
                    DisconnectReason.loggedOut
                ) {
                    this.cnt01++
                    console.log(
                        lastDisconnect?.error?.output?.payload,
                        `#${this.cnt01}\n`
                    )
                    await this.SendWebhook(
                        `Wa81.disconnected #${this.cnt01} ${JSON.stringify(
                            lastDisconnect?.error?.output?.payload
                        )}`,
                        { tm: cTimeStamp(), sn: new Date().getTime() },
                        this.key
                    )
                    // {"statusCode":515,"error":"Unknown","message":"Stream Errored (restart required)"}
                    // {"statusCode":408,"error":"Request Time-out","message":"Connection was lost"}
                    // {"statusCode":428,"error":"Precondition Required","message":"Connection Terminated"}
                    let mx = `⚡️🔴WA81.disconnected\n${JSON.stringify(
                        lastDisconnect?.error?.output?.payload
                    )}`
                    await this.__NoteSet(this.key, { conn_close: mx })
                    await amQsend(mx)

                    if (/Method Not Allowed/is.test(mx)) {
                        mx = mx.replace('WA81.', 'Wa-Pendaftaran ')
                        await amQsend('😱' + mx)
                        if (this.cnt01 === 1) this.cnt01++
                        this.cntWait += 900_000
                    }
                    if (this.cnt01 === 2) {
                        await amQsend(mx, 'group')
                        this.info2group++
                        await this.__NoteSet(this.key, {
                            conn_close: cTimeStamp(),
                            i_group: 1,
                            info2group: this.info2group,
                        })
                    }

                    this.cntWait += 19_000
                    if (/408/is.test(mx) || /428/is.test(mx)) {
                        if (this.cntWait < 900_000) this.cntWait = 3_777
                    } else if (/restart required/is.test(mx)) {
                        if (this.cntWait < 900_000) this.cntWait = 1_111
                        this.cnt01 = 0
                    }

                    if (this.cnt01 % 33 === 0)
                        await this.SendWebhook(
                            `Wa81.attempt to reset...`,
                            { tm: cTimeStamp(), sn: new Date().getTime() },
                            this.key
                        )
                    await sleep(this.cntWait)
                    if (this.cnt01 % 33 === 0) process.exit(-1)
                    setTimeout(async () => {
                        await this.init('restart')
                    }, 1_234)
                } else {
                    logger.info('STATE: Connection loggedOut')
                    logger.info(lastDisconnect?.error?.output)
                    await this.SendWebhook(
                        `Wa81.LoggedOut ${JSON.stringify(
                            lastDisconnect?.error?.output?.payload
                        )}`,
                        { tm: cTimeStamp(), sn: new Date().getTime() },
                        this.key
                    )
                    this.xConnState = false
                    let mx = `🔴WA-Pendaftaran loggedOut\n${JSON.stringify(
                        lastDisconnect?.error?.output?.payload
                    )}`
                    await amQsend(`🔴${mx}`)
                    await amQsend(`🔴${mx}`, 'group')
                    await this.__NoteSet(this.key, {
                        conn_loggedOut: cTimeStamp(),
                        i_group: 1,
                        xConnState: this.xConnState,
                        rmk: mx,
                    })
                    await sleep(5_555)
                    await this.collection.drop().then((r) => {
                        logger.info('STATE: Droped collection')
                        logger.info(
                            'STATE: Connection status is Droped loggedOut'
                        )
                    })
                    // process.exit(-1)
                }
            } else if (connection === 'open') {
                if (config.mongoose.enabled) {
                    // let alreadyThere = await Chat.findOne({ key: this.key }).exec()
                    // if (!alreadyThere) {
                    //     const saveChat = new Chat({ key: this.key })
                    //     await saveChat.save()
                    // }
                    const collection = await getCollection()

                    const alreadyThere = await collection.findOne({
                        key: this.key,
                    })

                    if (!alreadyThere) {
                        await collection.insertOne({
                            key: this.key,
                            chat: [],
                        })
                    }
                }
                await this.__NoteSet(this.key, { s_open: cTimeStamp() })

                try {
                    const d = await this.__NoteGet(this.key)
                    if (d) {
                        console.log(`await __NoteGet(${this.key}) ::`, d)
                        if (d.xConnState === false)
                            this.xConnState = d.xConnState
                        if (d.info2group) this.info2group
                    }
                } catch (err) {
                    console.log(`\n\n::::ERROR test01`, err)
                    await amQsend(`⚠️Wa81 ERR test01 ${err}`)
                }

                if (!this.xConnState) {
                    this.xConnState = true
                    await this.__NoteSet(this.key, {
                        i_group: 0,
                        tm: cTimeStamp(),
                        info2group: this.info2group,
                        xConnState: this.xConnState,
                    })
                    console.log('🟢WA-Pendaftaran is Online')
                    await amQsend('🟢WA-Pendaftaran is now Online', 'group')
                    await this.SendWebhook(
                        `Wa81.attempt to restart...`,
                        { tm: cTimeStamp(), sn: new Date().getTime() },
                        this.key
                    )
                    this.instance.sock.ws.close() // close WebSocket connection
                    this.instance.sock.ev.removeAllListeners() // remove all events
                    await sleep(1_234)
                    process.exit(1)
                }
                this.instance.online = true
                this.con00 = 0
                this.cnt01 = 0
                this.cntWait = 0
                console.log('                      ▲WA-81 connection Up')
                // if (['all', 'connection', 'connection.update', 'connection:open',].some((e) => config.webhookAllowedEvents.includes(e)))
                await this.SendWebhook(
                    'Wa.81.connection up',
                    {
                        connection: connection,
                        tm: cTimeStamp(),
                        sn: new Date().getTime(),
                    },
                    this.key
                )
                await amQsend('🟢WA-81 connection Up')
                await gw_notif2('t')
                // await sock.sendMessage(this.ID_rsdGw, { text: 'WA-81 connection up🙏🏻' })
                await this.attemptReSend()
                if (this.info2group > 0) {
                    this.info2group = 0
                    await this.__NoteSet(this.key, {
                        tm: cTimeStamp(),
                        info2group: this.info2group,
                        xConnState: this.xConnState,
                    })
                    await amQsend('🟢WA-Pendaftaran is now Online', 'group')
                }
                console.log('\n')
            }

            if (qr) {
                console.log(`requesting QR  @${connection}`)
                await amQsend('⚡️ WA-81 requesting QRCode!')
                await amQsend('⚡️ WA-Pendaftaran requesting QRCode!', 'group')
                console.log(
                    await QRCode.toString(qr, { type: 'terminal', small: true })
                )
                QRCode.toDataURL(qr).then((url) => {
                    this.xConnState = false
                    this.instance.qr = url
                    this.instance.qrRetry++
                    this.__NoteSet(this.key, {
                        s_qr: cTimeStamp(),
                        xConnState: this.xConnState,
                    })
                    if (this.instance.qrRetry >= config.instance.maxRetryQr) {
                        // close WebSocket connection
                        this.instance.sock.ws.close()
                        // remove all events
                        this.instance.sock.ev.removeAllListeners()
                        this.instance.qr = ''
                        logger.info('socket connection terminated')
                        amQsend(
                            '⚡️ WA-Pendaftaran connection terminated.',
                            'group'
                        )
                        this.info2group++
                        this.__NoteSet(this.key, {
                            s_qr_out: cTimeStamp(),
                            info2group: this.info2group,
                            xConnState: this.xConnState,
                        })
                    }
                })
            }
        })

        // on new mssage --------------------------------------------------------------------------------------
        sock?.ev.on('messages.upsert', async (m) => {
            // console.log('Pesan Baru : ', JSON.stringify(m))

            if (m.type === 'prepend') {
                console.log(`DEBUG prepend:: ${m}`)
                this.instance.messages.unshift(...m.messages)
            }
            if (m.type !== 'notify' && m.type !== 'append') {
                console.log('DEBUG skip', m.type, JSON.stringify(m), '\n')
                return
            }

            this.instance.messages.unshift(...m.messages)
            const rSn = new Date().getTime()
            m.messages.map(async (msg) => {
                let clientId = msg.key.remoteJid
                if (msg.key.remoteJid.includes('s.whatsapp.net'))
                    clientId = msg.key.remoteJid
                else if (msg.key.remoteJidAlt?.includes('s.whatsapp.net'))
                    clientId = msg.key.remoteJidAlt
                else if (msg.key.participant?.includes('s.whatsapp.net'))
                    clientId = msg.key.participant
                else if (msg.key.participantAlt?.includes('s.whatsapp.net'))
                    clientId = msg.key.participantAlt

                if (msg.key.fromMe || clientId === 'status@broadcast') {
                    return
                }
                if (!msg.message) {
                    if (msg.messageStubType) {
                        if (
                            ['CALL_MISSED_VOICE', 'CALL_MISSED_VIDEO'].includes(
                                msg.messageStubType
                            )
                        )
                            await this.callNotAvl(clientId, 1)
                    } else {
                        await amQsend(
                            `🤔Wa81 No message?\n${JSON.stringify(msg)}`
                        )
                    }
                    return
                }

                const messageType = Object.keys(msg.message)[0]
                if (
                    [
                        'protocolMessage',
                        'senderKeyDistributionMessage',
                    ].includes(messageType)
                )
                    return

                if (this.prevMsgId.includes(msg.key.id)) {
                    await this.SendWebhook(
                        'duplicateMsg',
                        {
                            key: this.key,
                            ...msg,
                            sn: rSn,
                            messageType: messageType,
                            mx: `skip msg.key.id ...`,
                            msg: msg,
                            tm: cTimeStamp(msg.messageTimestamp * 1_000, 19),
                        },
                        this.key
                    )
                    setTimeout(async () => {
                        this.lsUnreadChats = this.lsUnreadChats.filter(
                            (v) => v !== clientId
                        )
                    }, 33)
                    return
                }
                this.prevMsgId.push(msg.key.id)
                if (this.prevMsgId.length > 255) this.prevMsgId.shift()

                if (!this.lsClientId.includes(clientId))
                    this.lsClientId.push(clientId)

                const webhookData = { key: this.key, ...msg }
                webhookData['messageType'] = messageType
                webhookData['tm'] = cTimeStamp(msg.messageTimestamp * 1_000, 19)

                let mx = '',
                    qm = '',
                    er = '',
                    xErr1 = '',
                    clientName = ''
                try {
                    if (messageType === 'messageContextInfo') {
                        if (msg.message.ephemeralMessage) {
                            ;[mx, qm, er] = await this.getTxtMsg(
                                messageType,
                                msg.message.ephemeralMessage
                            )
                        } else if (msg.message.reactionMessage) {
                            qm = msg.message.reactionMessage.text
                            webhookData['msg'] = msg
                            webhookData['sn'] = rSn
                            webhookData['mx'] = `reactionMessage ${qm}`
                            await this.SendWebhook(
                                'reactionMessage',
                                webhookData,
                                this.key
                            )
                            return
                        } else if (msg.message.editedMessage) {
                            if (await this.isBruteClient(clientId)) {
                                this.lsUnreadChats = this.lsUnreadChats.filter(
                                    (v) => v !== clientId
                                )
                            } else {
                                ;[mx, qm, er] = await this.getTxtMsg(
                                    'editedMessage',
                                    msg.message.editedMessage
                                )
                                setTimeout(async () => {
                                    await this.reactMessage(
                                        clientId,
                                        msg.key,
                                        '🙈'
                                    )
                                }, 11)
                            }
                        } else {
                            if (!msg.message.pinInChatMessage)
                                await amQsend(
                                    `🤔81.unknown msg ${waIdToPhnNumber(
                                        clientId
                                    )}\n${JSON.stringify(msg.message)}`
                                )
                        }
                    } else {
                        ;[mx, qm, er] = await this.getTxtMsg(messageType, msg)
                    }

                    if (mx > '' || qm > '')
                        await this.readMessage({
                            remoteJid: clientId,
                            id: msg.key.id,
                            participant: msg.key?.participant,
                        })
                    else if (messageType === 'messageContextInfo')
                        this.lsUnreadChats = this.lsUnreadChats.filter(
                            (v) => v !== clientId
                        )

                    webhookData['mx'] = mx
                    if (er !== '') {
                        webhookData['er'] = er
                        await amQsend(
                            `⚠️Wa81 err:${er}\n: //wa.me/${clientId.replace(
                                /\D/g,
                                ''
                            )}`
                        )
                    }
                    clientName = msg.pushName
                } catch (e) {
                    xErr1 = `⚠️Wa81 err.ContextMessage\n${e}`
                    webhookData['err-1'] = xErr1
                    console.log(xErr1)
                    await amQsend(
                        `${xErr1}\n: //wa.me/${clientId.replace(/\D/g, '')}`
                    )
                }

                console.log(
                    '============================= Pesan Baru ==================================='
                )
                console.log('Number : ', clientId)
                console.log('Message : ', mx)
                console.log('qm : ', qm)
                console.log('xErr1 : ', xErr1)
                console.log('webhookData : ', webhookData)
                console.log('data : ', JSON.stringify(msg))
                console.log(new Date())

                webhookData['sn'] = rSn
                if (mx > '')
                    mx = mx.replace(/^(\s|#|\u00A0)+|(\s|#|\u00A0)+$/g, '') // trim the text message
                await this.m81Response(clientId, mx, qm, xErr1, webhookData)
            })
        })

        sock?.ev.on('messages.delete', async (xx) => {
            try {
                await amQsend(`⚡️Wa81 m..delete\n${JSON.stringify(xx)}`)
                await this.SendWebhook(
                    'm..delete',
                    { tm: cTimeStamp(), sn: new Date().getTime(), cc: xx },
                    this.key
                )
                console.log('messages.delete', xx)
            } catch (e0) {
                console.log(`::Exception messages.delete: ${e0}\n`, xx)
            }
        })

        sock?.ev.on('messages.update', async (ms) => {
            ms.map(async (m) => {
                try {
                    if (
                        !m.key.fromMe &&
                        m.key.remoteJid !== 'status@broadcast'
                    ) {
                        await this.SendWebhook(
                            'ms..update',
                            {
                                tm: cTimeStamp(),
                                sn: new Date().getTime(),
                                key: m.key,
                                rst: [m],
                            },
                            this.key
                        )
                    }
                } catch (e) {
                    await amQsend(`⚠️Wa81 ERR messages.update ${e}\n${m}`)
                }
            })
        })

        sock?.ev.on('chats.update', async (changedChat) => {
            let nC = 0,
                nw = 0,
                tm = cTimeStamp()
            changedChat.map(async (chat) => {

                console.log(
                    '============================= chats.update ==================================='
                )
                let id = chat.id

                let text = ''
                const lastMsg = chat.messages?.[0]
                const msg = lastMsg?.message?.message
                text = this.getText(lastMsg?.message?.message)
                if (chat.messages.key.remoteJid?.includes('s.whatsapp.net'))
                    id = chat.messages.key.remoteJid
                else if (
                    chat.messages.key.remoteJidAlt?.includes('s.whatsapp.net')
                )
                    id = chat.messages.key.remoteJidAlt
                if (id === this.ID_rsdPS || id === 'status@broadcast') return
                
                console.log('ID/Number :', id)
                console.log('Message   :', text)
                console.log('Data      :', JSON.stringify(chat, null, 2))
                console.log(new Date())

                const index = this.instance.chats.findIndex(
                    (pc) => pc.id === id
                )
                const PrevChat = this.instance.chats[index]
                this.instance.chats[index] = { ...PrevChat, ...chat } /// wadah untuk chat yang belum dibaca Pasient/Client
                try {
                    if (chat.unreadCount > 0) {
                        if (
                            chat.unreadCount > 1 &&
                            this.lsUnreadChats.includes(id)
                        ) {
                            await amQsend(
                                `⚡️⚡️Wa81 unreadC* //wa.me/${id.replace(
                                    /@s.whatsapp.net/g,
                                    ''
                                )}\n${tm}`
                            )
                            this.lastUrC += '*'
                        } else {
                            if (this.lsUnreadChats.length > 0) {
                                nC++
                                if (
                                    id === this.ID_rsdGw ||
                                    id === this.ID_rsdGw_lid
                                ) {
                                    this.lastUrC += '*'
                                    await amQsend(
                                        `⚡️🧐Wa81 unreadC : ${this.lsUnreadChats.length}\n${tm}`
                                    )
                                }
                            }
                            if (!this.lsUnreadChats.includes(id))
                                this.lsUnreadChats.push(id)
                        }
                    } else {
                        this.lsUnreadChats = this.lsUnreadChats.filter(
                            (v) => v !== id
                        )
                        if (
                            this.lsUnreadChats.length < 1 &&
                            this.lastUrC.length > 0
                        ) {
                            this.lastUrC = ''
                            this.p1_busy = false
                            await amQsend(
                                `⚡️☕️Wa81 unreadC is Empty\n${cTimeStamp()}`
                            )
                        }
                    }
                } catch (e) {
                    console.log(`\n\n::::ERROR chats.update ${tm}`, e)
                    await amQsend(`⚠️Wa81 ERR chats.update ${e}\n${tm}`)
                }
            })

            if (nC > 0) {
                nw = this.lsUnreadChats.length
                if (nw > 0 && !this.p0_busy) {
                    this.p0_busy = true
                    setTimeout(async () => {
                        if (this.lsUnreadChats.length >= nw)
                            await this.infoUnreadC()
                        this.p0_busy = false
                    }, 19_000)
                }
            }
        })

        // on recive new chat
        sock?.ev.on('chats.upsert', async (newChat) => {
            const chats = newChat.map((chat) => {
                return { ...chat, messages: [] }
            })
            this.instance.chats.push(...chats)
        })

        // on chat delete
        sock?.ev.on('chats.delete', async (deletedChats) => {
            deletedChats.map((chat) => {
                const index = this.instance.chats.findIndex(
                    (c) => c.id === chat
                )
                if (index >= 0) this.instance.chats.splice(index, 1)
                this.lsUnreadChats = this.lsUnreadChats.filter(
                    (v) => v !== chat
                )
            })
        })

        // on receive all chats
        sock?.ev.on('chats.set', async ({ chats }) => {
            console.log('\n::chats.dset', JSON.stringify(chats))
            this.instance.chats = []
            const recivedChats = chats.map((chat) => {
                return { ...chat, messages: [] }
            })
            this.instance.chats.push(...recivedChats)
            await this.updateDb(this.instance.chats)
            await this.updateDbGroupsParticipants()
            await this.SendWebhook(
                'chats.set',
                { tm: cTimeStamp(), cc: chats },
                this.key
            )
        })

        sock?.ev.on('groups.upsert', async (newChat) => {
            console.log('groups.upsert', newChat)
            this.createGroupByApp(newChat)
            if (
                ['all', 'groups', 'groups.upsert'].some((e) =>
                    config.webhookAllowedEvents.includes(e)
                )
            )
                await this.SendWebhook(
                    'group_created',
                    { data: newChat },
                    this.key
                )
        })

        sock?.ev.on('groups.update', async (newChat) => {
            console.log('groups.update', newChat)
            this.updateGroupSubjectByApp(newChat)
            if (
                ['all', 'groups', 'groups.update'].some((e) =>
                    config.webhookAllowedEvents.includes(e)
                )
            )
                await this.SendWebhook(
                    'group_updated',
                    { data: newChat },
                    this.key
                )
        })

        sock?.ev.on('group-participants.update', async (newChat) => {
            console.log('group-participants.update', newChat)
            this.updateGroupParticipantsByApp(newChat)
            if (
                [
                    'all',
                    'groups',
                    'group_participants',
                    'group-participants.update',
                ].some((e) => config.webhookAllowedEvents.includes(e))
            )
                await this.SendWebhook(
                    'group_participants_updated',
                    { data: newChat },
                    this.key
                )
        })

        // // sending presence
        // sock?.ev.on('presence.update', async (json) => {
        //     if (['all', 'presence', 'presence.update'].some((e) => config.webhookAllowedEvents.includes(e)))
        //         await this.SendWebhook('presence', json, this.key)
        // })

        sock?.ws.on('CB:call', async (data) => {
            if (data.content) {
                if (data.content.find((e) => e.tag === 'offer')) {
                    const content = data.content.find((e) => e.tag === 'offer')
                    // if (['all', 'call', 'CB:call', 'call:offer'].some((e) => config.webhookAllowedEvents.includes(e)))
                    await this.SendWebhook(
                        'call_offer',
                        {
                            id: content.attrs['call-id'],
                            timestamp: parseInt(data.attrs.t),
                            user: {
                                id: data.attrs.from,
                                platform: data.attrs.platform,
                                platform_version: data.attrs.version,
                            },
                        },
                        this.key
                    )
                    await this.callNotAvl(data.attrs.from, 1)
                } else if (data.content.find((e) => e.tag === 'terminate')) {
                    const content = data.content.find(
                        (e) => e.tag === 'terminate'
                    )
                    // if (['all', 'call', 'call:terminate'].some((e) => config.webhookAllowedEvents.includes(e)))
                    await this.SendWebhook(
                        'call_terminate',
                        {
                            id: content.attrs['call-id'],
                            user: { id: data.attrs.from },
                            timestamp: parseInt(data.attrs.t),
                            reason: data.content[0].attrs.reason,
                        },
                        this.key
                    )
                    await this.callNotAvl(data.attrs.from, 1579)
                }
            }
        })
    }

    diffDay(n1, n2) {
        // return parseInt((n1 - 1_684_861_200_000) / 86_400_000) - parseInt((n2 - 1_684_861_200_000) / 86_400_000)
        return (
            parseInt((n1 - 1_684_882_800_000) / 86_400_000) -
            parseInt((n2 - 1_684_882_800_000) / 86_400_000)
        )
    }

    async theDresponse(phn, ntag) {
        if (phn == '6281575603052') return { res: '  🙏🙏🏻' }
        else {
            try {
                if (ntag < 4) {
                    const tz = new Date().getTime() - 131_000
                    this.lastNoRequest = this.lastNoRequest.filter(
                        (x) => x.t > tz
                    )
                    const i = this.lastNoRequest.findIndex((x) => x.c === phn)
                    if (i >= 0) {
                        this.lastNoRequest[i].t = new Date().getTime()
                        this.lastNoRequest[i].n++
                        if (this.lastNoRequest[i].n > 2) {
                            this.lsBotClient.push(phn)
                            this.lsBotClient.push('#' + phn)
                        }
                        if (this.lastNoRequest[i].n > 1) return { res: '' }
                    } else {
                        this.lastNoRequest.push({
                            c: phn,
                            n: 1,
                            t: new Date().getTime(),
                        })
                    }
                }
            } catch (e) {
                await amQsend(`❌Wa81 Error theDresponse\n::${e}\n${phn}`)
            }

            return {
                res:
                    '🙂🙏🏻Ini Layanan Pendaftaran *RSUD Panembahan Senopati*\n' +
                    '\nUntuk cara daftar,\n_kirim_: Daftar\n' +
                    '\nUntuk pertanyaan/informasi, silakan WA ke:\n*Hotline RSUD-PS 0811-263-7570*',
            }
        }
    }

    getText(message) {
        if (!message) return ''

        if (message.conversation) return message.conversation

        if (message.extendedTextMessage) return message.extendedTextMessage.text

        if (message.imageMessage?.caption) return message.imageMessage.caption

        if (message.videoMessage?.caption) return message.videoMessage.caption

        if (message.documentMessage?.caption)
            return message.documentMessage.caption

        if (message.buttonsResponseMessage)
            return message.buttonsResponseMessage.selectedDisplayText

        if (message.listResponseMessage)
            return message.listResponseMessage.title

        return ''
    }

    infoWaitTime(np, cc) {
        let cw = '\n\n🙈 +'
        let nn = cc.indexOf(cw)
        if (nn > 27) cc = cc.substring(0, nn)
        if (np < 321) return cc

        let ns = Math.floor(np / 1_000) + 3
        if (ns > 100) {
            nn = Math.floor(ns / 60)
            if (nn > 0) cw += `${nn} menit`
            ns %= 60
            if (ns > 0) cw += ' '
        }
        if (ns > 0) cw += `${ns} detik`
        if (cw.length > 5) cw += ' jeda spam'
        return cc + cw
    }

    async isUntrustedRM(mx, token, nd, clientId, rtn = 0) {
        const p1 = mx.replace(/[^#^\d]/g, '').match(/#\d{5,}#/g)
        try {
            if (p1 && p1[0].length == 8) {
                if (this.sXrm.indexOf(p1[0]) >= 0) {
                    if (rtn === 1 || nd < 50) return true
                    if (nd > 10_000) nd = 10_000
                    this.lsUnreadChats = this.lsUnreadChats.filter(
                        (v) => v !== clientId
                    )
                    await this.noSpamMx(
                        token,
                        nd,
                        1,
                        '*Double request*, silakan coba beberapa saat lagi'
                    )
                    for (let ii = 0; ii < 10; ii++) {
                        await sleep(parseInt(nd / 10))
                        // if (await admService.isTokenCanceled(token)) break
                    }
                    await this.noSpamMx(token, 3_000, 1, ' ')
                }
            }
        } catch (e) {
            console.log(`Error isUntrustedRM ${p1}\n${mx}\n${e}`)
            await amQsend(`⚠️Wa81 Err.isUntrustedRM: ${p1}\n${mx}\n${e}`)
        }
        return false
    }

    async isBlackListed(phn, mx) {
        if (this.lsGoodclient.includes(phn)) return false
        let r = this.lsXclients.includes(phn)
        if (!r) {
            const p1 = mx.replace(/[^#^\d]/g, '').match(/#\d{5,}#/g)
            if (p1 && p1[0].length == 8) {
                r =
                    this.sXrm.indexOf(p1[0]) >= 0 ||
                    this.sX2rm.indexOf(p1[0]) >= 0
            }
        }
        return r
    }

    async myCmdRequest(clientId, nsc, cmd) {
        let rs = { res: ' ' }
        if (
            clientId !== this.ID_rsdGw &&
            clientId !== this.ID_rsdGw_lid &&
            clientId !== this.ID_Admin
        )
            rs = { res: '❓' }
        else if (cmd.substring(0, 6) === '/dummy') {
            const ct = stringTrim(cmd.substring(7)) // + "@s.whatsapp.net"
            rs = { res: `*syntax error:\n${cmd[6]}` }
            if (cmd[6] === '#') {
                rs = { res: `*Temporary mute:\n${ct}.` }
                await this.setBruteClient(ct, 5, 21_600_000)
            } else if (cmd[6] === '$') {
                const cc = stringTrim(cmd.substring(7)).substring(0, 7) + '#'
                if (cc[0] == '#') {
                    const tz = new Date().getTime() + 10_800_000
                    const ii = this.lsBruteRm.findIndex((x) => x.r === cc)
                    if (ii >= 0) this.lsBruteRm[ii].t = tz
                    else this.lsBruteRm.push({ r: cc, c: '', t: tz })
                    rs = { res: `*attempt blocking rm::\n${cc}` }
                } else if (cc[0] == '!') {
                    cc = cc.replace('!', '#')
                    this.lsBruteRm = this.lsBruteRm.filter(
                        (x) => x.r !== cc || x.t === 0
                    )
                    rs = { res: `*attempt unblocking rm::\n${cc}` }
                }
            } else if (cmd[6] === '~') {
                rs = { res: `*Till restart mute:\n${ct}.` }
                await this.setBruteClient(ct, 0)
            } else if (cmd[6] === '^') {
                let x = await sock.updateBlockStatus(ct, 'unblock') // Unblock user
                rs = { res: `*UnBlockStatus: ${x}\n${ct}.` }
                await this.setBruteClient(ct, 0)
            } else if (cmd[6] === '!') {
                if (cmd[7] === '*') {
                    rs = { res: `Unmute: *` }
                    this.lsBruteClient = this.lsBruteClient.filter(
                        (x) => x.t === 0
                    )
                    this.lsBruteRm = this.lsBruteRm.filter((x) => x.t === 0)
                } else {
                    rs = { res: `*Unmute:\n${ct}` }
                    this.lsBruteClient = this.lsBruteClient.filter(
                        (x) => x.c !== ct
                    )
                    this.lsBruteRm = this.lsBruteRm.filter((x) => x.t === 0)
                }
                await this.getBlackList()
                this.lsXmsg = this.lsXmsg.filter((x) => x.n < 0)
            }
        } else if (cmd === '/good') {
            const phn = cmd.substring(5).replace(/\D/g, '')
            rs = { res: `*Adding GoodClient:\n${phn}.` }
            await this.setTheGoodclient(phn)
        } else if (cmd === '/🔔') {
            const ct = new Date().toISOString()
            rs = { res: `${cmd} ${ct}` }
        } else if (cmd === '/svc.rst') {
            rs = { res: '⚠️Wa81 RESTARTING SEVICE' }
            console.log(
                `\n${new Date().toLocaleString()} RESTARTING SEVICE_____________________________________________\n`
            )
            setTimeout(async () => {
                process.exit(1)
            }, 888)
        } else if (cmd.startsWith('/WaSvc')) {
            this.lsXmsg = this.lsXmsg.filter((x) => x.n < -9)
            rs = { res: "🤲Insya'Allah berkah\nQ&A Cache Cleared" }
        }
        await amQsend(`📝Wa81:: ${cmd}\n${rs.res}\n\nby //wa.me/${clientId}`)
        return rs
    }

    async setBruteClient(clientId, nc = 1, nd = 119_000, rtkn = '') {
        const phn = clientId.replace(/\D/g, '')
        if (this.lsTrustedClient.includes(phn)) return false
        let nn = nc,
            tz = new Date().getTime()
        this.lsBruteRm = this.lsBruteRm.filter((x) => x.t === 0 || x.t > tz)
        const i = this.lsBruteClient.findIndex((x) => x.c === phn)
        tz += nd
        if (nc === 0) {
            nn = 44
            if (i >= 0) {
                this.lsBruteClient[i].t = 0
                this.lsBruteClient[i].n = nn
                this.lsBruteClient[i].r = rtkn
            } else {
                this.lsBruteClient.push({ c: phn, t: 0, n: nn, r: rtkn, q: 1 })
            }
        } else if (i >= 0) {
            if (this.lsBruteClient[i].t !== 0) this.lsBruteClient[i].t = tz
            this.lsBruteClient[i].n += nc
            this.lsBruteClient[i].r = rtkn
            nn = this.lsBruteClient[i].n
        } else this.lsBruteClient.push({ c: phn, t: tz, n: nc, r: rtkn, q: 1 })

        if (nn > 4 && rtkn.length > 18) {
            const p1 = rtkn.replace(/[^#^\d]/g, '').match(/#\d{5,}#/g)
            if (p1 && p1[0].length == 8) {
                const j = this.lsBruteRm.findIndex((x) => x.r === p1[0])
                if (j >= 0) this.lsBruteRm[j].t = nn >= 44 ? 0 : tz
                else
                    this.lsBruteRm.push({
                        r: p1[0],
                        c: rtkn,
                        t: nn >= 44 ? 0 : tz,
                    })

                if (nn >= 44) this.noRspRm.push(p1[0])
            }
        }
    }

    async isBruteClient(clientId, rtkn = '') {
        const phn = clientId.replace(/\D/g, '')
        let i = this.lsBruteClient.findIndex((x) => x.c === phn),
            now = new Date().getTime()
        if (i >= 0) {
            this.lsBruteClient = this.lsBruteClient.filter(
                (x) => x.t === 0 || x.t > now
            )
            i = this.lsBruteClient.findIndex((x) => x.c === phn)
        }

        let tz = i >= 0 ? this.lsBruteClient[i].t : now + 120_000
        const b = i >= 0 && (this.lsBruteClient[i].n > 4 || tz === 0)
        if (
            b &&
            tz > 0 &&
            rtkn.startsWith('batal#') &&
            rtkn.length > 18 &&
            this.lsBruteClient[i].q &&
            this.lsBruteClient[i].q === 1
        ) {
            this.lsBruteClient[i].q = 0
            return false
        }

        if (rtkn.length > 18) {
            const p1 = rtkn.replace(/[^#^\d]/g, '').match(/#\d{5,}#/g)
            if (p1 && p1[0].length == 8) {
                let j = this.lsBruteRm.findIndex((x) => x.r === p1[0])
                if (b) {
                    if (j >= 0) this.lsBruteRm[j].t = tz
                    else this.lsBruteRm.push({ r: p1[0], c: '', t: tz })
                } else if (j >= 0) {
                    this.lsBruteRm = this.lsBruteRm.filter(
                        (x) => x.t === 0 || x.t > now
                    )
                    j = this.lsBruteRm.findIndex((x) => x.r === p1[0])
                    if (j >= 0) {
                        tz = this.lsBruteRm[j].t
                        const nd =
                            tz === 0 ? 3_600_000 : tz > now ? tz - now : 90_000
                        await this.setBruteClient(phn, 5, nd + 90_000, rtkn)
                        this.lsUnreadChats = this.lsUnreadChats.filter(
                            (x) => x !== clientId
                        )
                        return true
                    }
                }
            }
        }

        if (b)
            this.lsUnreadChats = this.lsUnreadChats.filter(
                (x) => x !== clientId
            )
        return b
    }

    async isSpamMsgs(now, nsc, rtkn, phn) {
        if (this.lsTrustedClient.includes(phn)) {
            return false
        } else if (this.lsXmsg.length < 1) {
            if (rtkn > '') this.lsXmsg.push({ s: rtkn, t: now, n: 1, r: '' })
        } else {
            const nrx = now - 5_100
            this.lsXmsg = this.lsXmsg.filter((d) => d.t > nrx)
            if (rtkn === '') return false
            const i = this.lsXmsg.findIndex((d) => d.s === rtkn)
            if (i < 0) {
                this.lsXmsg.push({ s: rtkn, t: now, n: 1, r: '' })
            } else {
                // console.log('::isSpamMsgs #', this.lsXmsg[i].n, i, this.lsXmsg[i].t, now - this.lsXmsg[i].t, this.lsXmsg[i].s, this.lsXmsg[i].r)
                // if (nsc > 1_800_000 || this.diffDay(now, this.lsXmsg[i].t) === 0) {
                if (
                    nsc < 21_599_995 ||
                    nsc > 21_900_000 ||
                    this.diffDay(now, this.lsXmsg[i].t) === 0
                ) {
                    this.lsXmsg[i].n++
                    if (this.lsXmsg[i].t < now + 700)
                        this.lsXmsg[i].t = now + 700
                } else if (this.lsXmsg[i].n < 2) {
                    this.lsXmsg[i].t = now - 700
                    return false
                }
                return true
            }
        }
        return false
    }

    async noSpamMx(token, ms = 1_000, nc = 1, resp = '') {
        const i = this.lsXmsg.findIndex((d) => d.s === token)
        const now = new Date().getTime()
        if (i >= 0) {
            if (this.lsXmsg[i].t < now + ms) this.lsXmsg[i].t = now + ms
            if (nc > 0) this.lsXmsg[i].n += nc
            else this.lsXmsg[i].n = nc
            this.lsXmsg[i].r = resp
        } else this.lsXmsg.push({ s: token, t: now + ms, n: nc, r: resp })
    }

    async onDuplRequest(clientId, now, token, ntag, nsc) {
        let i = this.lsXmsg.findIndex((x) => x.s === token)
        let rs,
            nc = i >= 0 ? this.lsXmsg[i].n : 0
        let np = nsc < 21_575_000 ? 21_000 : 21_599_500 - nsc
        if (np < 300) np = 0

        if (i >= 0 && ntag > 3) {
            this.lsXmsg[i].t +=
                nsc < 21_540_000 || nsc > 22_000_000 ? 21_000 : 12_500
            if (nsc > 21_530_000 && nsc < 21_600_000) {
                if (!this.clientIdnoBonus.includes(clientId))
                    this.clientIdnoBonus.push(clientId)
            } else if (this.clientIdnoBonus.length > 0) {
                this.clientIdnoBonus = []
            }
        }

        if (i >= 0 && nc <= 8 && this.lsXmsg[i].r && this.lsXmsg[i].r > ' ') {
            rs = { res: this.lsXmsg[i].r }
            np = 5
            if (ntag > 3) {
                if (/Silakan coba beberapa saat/i.test(rs.res)) {
                    this.lsXmsg[i].t += 11_500
                    rs.res = this.infoWaitTime(this.lsXmsg[i].t - now, rs.res)
                } else if (this.lsXmsg[i].r.startsWith('🙂')) {
                    this.lsXmsg[i].t += 10_000
                    rs.res = this.infoWaitTime(this.lsXmsg[i].t - now, rs.res)
                }
            }
        } else {
            rs = { res: nc < 4 ? '  🙏' : '   🙏' }
            if (i < 0 || nc < 4) np = 0
        }

        if (nc < 1) {
            rs = { res: 'Silakan coba beberapa menit lagi' }
            np = 120_000
            if (i >= 0) {
                np = this.lsXmsg[i].t - now
                let ns = parseInt(np / 60_000) + 1
                if (ns > 0) rs = { res: `Silakan coba ${ns} menit lagi` }
            }
        } else if (nc > 8) {
            rs = { res: '  spam 🚫' }
            await this.noSpamMx(token, 7_200_000, 1, ' ')
            await this.setBruteClient(clientId, 5, 7_212_000, token)
            np = 0
        } else if (
            nc > 3 &&
            nsc > 21_540_000 &&
            nsc < 21_600_000 &&
            !token.match(/#d\+[1-9]+/)
        ) {
            rs = { res: '⏰' }
            if (nc > 4 && ntag > 3) {
                let _c = '',
                    _l =
                        'Pendaftaran belum dibuka,  silakan coba lagi mulai jam 06:00 WIB.'.split(
                            ''
                        )
                _l.forEach((s) => {
                    _c += s + '\n'
                })
                rs = { res: _c + '\n⚠️' }
            } else if (nc > 5) {
                rs = { res: '⚠️' }
            }
            if (nsc < 21_600_000) np = 21_600_000 - nsc
            if (np < 11_000) np = 11_000
            else if (np > 120_000 || nsc > 22_000_000) np = 120_000
            i = this.lsXmsg.findIndex((d) => d.s === token)
            if (i >= 0) this.lsXmsg[i].r = ''
        } else if (
            nc > 3 &&
            (nsc < 21_595_000 || nsc > 25_000_000) &&
            this.lsXmsg[i].t < now + 8_100
        ) {
            rs = { res: '⚠️' }
            np = 60_000
            await this.noSpamMx(token, np - 5_000, 1, ' ')
            i = this.lsXmsg.findIndex((d) => d.s === token)
            if (i >= 0) {
                this.lsXmsg[i].n = nc
                np = this.lsXmsg[i].t - now
                let ns = parseInt(np / 60_000) + 1
                if (ns > 0) {
                    rs = { res: `⚠️Silakan coba ${ns} menit lagi` }
                    np = ns * 60_000
                }
            }
        }
        if (np > 19_000) await this.setBruteClient(clientId, 5, np, token)
        return rs
    }

    async onSkipRequest(phn, rtkn) {
        let i = this.lsBruteClient.findIndex((x) => x.c === phn)
        if (i >= 0 && this.lsBruteClient[i].t > 0) {
            let j,
                t3 = 0,
                t4 = 0,
                now = new Date().getTime()
            this.lsBruteClient[i].n++
            if (
                this.lsBruteClient[i].r &&
                this.lsBruteClient[i].r > '' &&
                this.lsBruteClient[i].r !== rtkn
            ) {
                j = this.lsXmsg.findIndex(
                    (x) => x.s === this.lsBruteClient[i].r
                )
                if (j >= 0) {
                    this.lsXmsg[j].r = ''
                    this.lsXmsg[j].t += 15_000
                    t3 = this.lsXmsg[j].t
                }
            }
            j = this.lsXmsg.findIndex((x) => x.s === rtkn)
            if (j >= 0) {
                this.lsXmsg[j].r = ''
                this.lsXmsg[j].t += 15_000
                t4 = this.lsXmsg[j].t
            }

            let v0 = this.lsBruteClient[i].t + 27_000,
                v1 = now + 35_000
            let tm = t3 > t4 ? t3 : t4
            if (tm < v0) tm = v0
            if (tm < v1) tm = v1
            if (this.lsBruteClient[i].n > 21) tm = now + 21_600_000
            console.log(
                '?? isMuted #',
                this.lsBruteClient[i],
                `::now:${now}-->tm:${tm}|v0:${v0}|v1:${v1}|t3:${t3}|t4:${t4}`
            )
            this.lsBruteClient[i].t = tm
            await amQsend(
                `⛑Wa81::mute ${parseInt(
                    (tm - now) / 1000
                )} sec.\n${JSON.stringify(
                    this.lsBruteClient[i]
                )}\n${rtkn}\n: ${phn}`
            )
        } else if (i >= 0) {
            await amQsend(
                `🚫Wa81::mute ${this.lsBruteClient[i].t}\n${rtkn}\n: ${phn}`
            )
        }
    }

    async tempHold(clientId, rtkn) {
        const now = new Date().getTime()
        const nsc = (now - 1_684_861_200_000) % 86_400_000
        if (nsc > 21_600_370 || rtkn.match(/#d\+[1-9]+/)) {
            return false
        }
        let nx = 0
        if (
            nsc > 21_539_000 &&
            nsc < 21_600_390 &&
            !this.clientIdnoBonus.includes(clientId) &&
            !this.clientIdnoBonus.includes(rtkn)
        ) {
            this.clientIdnoBonus.push(rtkn)
            let nd = 21_600_395 - nsc
            nx = this.lsXmsg.findIndex((d) => d.s === rtkn)
            if (nx >= 0) {
                this.lsXmsg[nx].t = now + nd + 900
                if (this.lsXmsg[nx].n > 1) return true
            } else {
                this.lsXmsg.push({ s: rtkn, t: now + nd + 900, n: 1, r: '' })
            }
            await sleep(nd)
            nx = this.lsXmsg.findIndex((d) => d.s === rtkn)
            if (nx >= 0 && this.lsXmsg[nx].n > 1) {
                let phn = clientId.replace(/\D/g, '')
                if (!this.lsXclients.includes(phn)) this.lsXclients.push(phn)
                nx = 0
            } else nx = 1
        }
        return nx === 0
    }

    async m81Response(clientId, mx, qm, xErr, webhookData) {
        setTimeout(async () => {
            const phn = clientId.replace(/\D/g, '')
            const isGoodClient = this.lsGoodclient.includes(phn)
            let rst = [],
                rs,
                rtkn = '',
                xs,
                nx = 0

            let ntag = mx.replace(/[^#]/g, '').length
            if (
                ntag === 0 &&
                mx.length > 27 &&
                mx.length < 123 &&
                /^daftar/i.test(mx)
            ) {
                if (mx.replace(/[^,]/g, '').length > 3)
                    mx = mx.replace(/,/g, '#')
                else if (mx.replace(/[^\n]/g, '').length > 3)
                    mx = mx.replace(/\n/g, '#')
                else if (mx.replace(/[^\/]/g, '').length > 3)
                    mx = mx.replace(/\//g, '#')
                ntag = mx.replace(/[^#]/g, '').length
            }
            let now = new Date().getTime()
            let nsc = (now - 1_684_861_200_000) % 86_400_000

            webhookData['tq'] = now
            try {
                if (mx > '') {
                    rtkn = myToken(mx, nsc, clientId)
                    let cky = stringTrim(mx.replace(/[^\u000A-\u00FF]/g, ''))
                        .substring(0, 25)
                        .toLowerCase()
                    if (cky.length < 1) cky = ' '

                    const rsv = ntag > 3 && /daftar/is.test(cky)
                    if (rsv) {
                        rtkn = await this.getToken(phn, mx, now, rtkn)
                        ntag = rtkn.replace(/[^#]/g, '').length
                        if (
                            nsc > 21_530_000 &&
                            nsc < 21_555_000 &&
                            !isGoodClient
                        ) {
                            if (!this.clientIdnoBonus.includes(clientId))
                                this.clientIdnoBonus.push(clientId)
                            if (
                                rtkn.length > 17 &&
                                rtkn.length < 80 &&
                                !this.clientIdnoBonus.includes(rtkn)
                            )
                                this.clientIdnoBonus.push(rtkn)
                        }
                        now = new Date().getTime()
                        nsc = (now - 1_684_861_200_000) % 86_400_000
                    } else {
                        if (ntag < 2) rtkn += phn
                    }

                    const isBadClient = await this.isBlackListed(phn, rtkn)
                    if (await this.isBruteClient(phn, rtkn)) {
                        rs = { res: '' }
                        setTimeout(async () => {
                            await this.onSkipRequest(phn, rtkn)
                        }, 0)
                        if (
                            ntag === 0 &&
                            cky.length < 13 &&
                            (xs = myWords(cky))
                        ) {
                            if (xs.startsWith('🙈\nhttps://health.kompas')) {
                                await this.setBruteClient(clientId, 0)
                                console.log('--> go Blocking <---', clientId)
                                let x = await sock.updateBlockStatus(
                                    clientId,
                                    'block'
                                ) // Block user
                                console.log(
                                    `==>> updateBlockStatus ${clientId} :::`,
                                    x
                                )
                                await amQsend(
                                    `🤡Wa81::BlockStatus ${x}\n🤡: ${clientId}`
                                )
                            }
                        }
                    } else if (this.lsBotClient.includes(phn)) {
                        rs = { res: '' }
                        await amQsend(mx + `\n🙈: //wa.me/${phn}`)
                        if (!this.lsBotClient.includes('#' + phn))
                            await amQsend(mx + `\n🙈 ${phn}`, 'group')
                        setTimeout(async () => {
                            this.lsUnreadChats = this.lsUnreadChats.filter(
                                (x) => x !== clientId
                            )
                        }, 86)
                    } else if (
                        ntag === 0 &&
                        cky.length < 4 &&
                        '|jam|j|t|t,|'.indexOf(`|${cky}|`) >= 0
                    ) {
                        if (cky[0] === 'jam')
                            rs = {
                                res: `WA anda masuk pada:\n${cTimeStamp()
                                    .replace('.', ',')
                                    .replace(' ', '\n')}`,
                            }
                        else
                            rs = {
                                res: `${cTimeStamp()
                                    .replace('.', ',')
                                    .replace(' ', '\n')}`,
                            }
                    } else if (
                        mx[0] === '/' &&
                        (clientId === this.ID_rsdGw ||
                            clientId === this.ID_rsdGw_lid ||
                            clientId === this.ID_Admin)
                    )
                        rs = await this.myCmdRequest(clientId, nsc, mx)
                    else if (
                        ntag === 0 &&
                        cky.length < 13 &&
                        (xs = myWords(cky))
                    ) {
                        rs = { res: xs }
                        if (xs.startsWith('🙈\nhttps://health.kompas')) {
                            await this.setBruteClient(clientId, 0)
                            rs = { res: '' }
                            console.log('--> Go Blocking <---', clientId)
                            let x = await sock.updateBlockStatus(
                                clientId,
                                'block'
                            ) // Block user
                            console.log(
                                `==>> updateBlockStatus ${clientId} :::`,
                                x
                            )
                            await amQsend(
                                `🤡Wa81::BlockStatus ${x}\n🤡: ${clientId}`
                            )
                        }
                    } else if (
                        mx.length > 203 ||
                        /^✅|^Pendaftaran berhasil|^Belum ada reservasi RM|http/s.test(
                            mx
                        )
                    )
                        rs = await this.theDresponse(phn, ntag)
                    else if (
                        cky.length < 3 ||
                        (cky.length < 11 &&
                            /maaf|^ok|\bbaik\b|\bsiap\b|^n[gj]{1,}[i|e]+h/i.test(
                                cky
                            ))
                    ) {
                        rs = { res: cky.length < 3 ? `${cky}🙂` : ' 🙏🏻🙂' }
                        // xs = isFontStandart(mx)
                        // if (xs > ' ') rs = { res: xs }
                    } else if (await this.isSpamMsgs(now, nsc, rtkn, phn))
                        rs = await this.onDuplRequest(
                            clientId,
                            now,
                            rtkn,
                            ntag,
                            nsc
                        )
                    else if (
                        rsv &&
                        isBadClient &&
                        nsc < 21_601_500 &&
                        nsc >= 21_500_000 &&
                        !rtkn.match(/#d\+[1-9]+/)
                    ) {
                        if (nsc >= 21_600_000) {
                            await sleep(21_601_999 - nsc)
                            rs = {
                                res: 'Sistem baru saja aktif, silakan coba lagi',
                            }
                        } else {
                            rs = { res: 'Silakan coba lagi mulai jam 06:00' }
                            if (nsc < 21_595_000)
                                await this.noSpamMx(
                                    rtkn,
                                    21_595_100 - nsc,
                                    1,
                                    rs.res
                                )
                        }
                        if (nsc > 21_595_000) {
                            setTimeout(async () => {
                                this.lsXmsg = this.lsXmsg.filter(
                                    (x) => x.s !== rtkn
                                )
                            }, 531)
                        }
                    } else if (
                        rsv &&
                        nsc < 21_600_300 &&
                        nsc > 21_550_000 &&
                        (await this.tempHold(clientId, rtkn))
                    ) {
                        if (!this.clientIdnoBonus.includes(clientId))
                            this.clientIdnoBonus.push(clientId)
                        rs = { res: 'Silakan coba lagi mulai jam 06:00🕛' }
                        if (nsc < 21_595_500) {
                            await this.noSpamMx(
                                rtkn,
                                21_596_000 - nsc,
                                1,
                                ' Silakan coba beberapa saat lagi'
                            )
                        } else if (nsc >= 21_599_000) {
                            setTimeout(async () => {
                                this.lsXmsg = this.lsXmsg.filter(
                                    (x) => x.s !== rtkn
                                )
                            }, 900)
                        }
                    } else {
                        // --------------------------------------------------------------------------------------- ----------------------------------
                        if (
                            rsv &&
                            isBadClient &&
                            (nsc > 21_601_000 || nsc < 21_500_000)
                        ) {
                            await sleep(1_255)
                            await this.isUntrustedRM(mx, rtkn, 5_999, clientId)
                        }
                        nx = 1
                        let now2 = new Date().getTime()
                        webhookData['tq'] = now2
                        rs = await this.execRsv(clientId, mx, now2, '')
                        if (!rs || rs.err) {
                            nx = -1
                            this.nBEerror++
                            await amQsend(
                                `⛑Wa81 execRsv-error #${this.nBEerror}\n${rs?.err}\n: ${clientId}`
                            )
                            rs = await this.execRsv(clientId, mx, now2, '')
                            if (!rs) {
                                rs = {
                                    err: 'Maaf, ada error pada sistem kami🙏🏻',
                                }
                                this.lsXmsg = this.lsXmsg.filter(
                                    (x) => x.s !== rtkn
                                )
                            }
                        }
                    }

                    webhookData['tr'] = new Date().getTime()
                    if (rs) {
                        if (rs.res) {
                            let nd = 0,
                                sx = ' ',
                                ptp = 0
                            const cr = rs.res
                            if (
                                /^Pendaftaran berhasil|berhasil reservasi/s.test(
                                    cr
                                )
                            ) {
                                ptp = 200
                            } else if (
                                cr === '√' ||
                                cr === '°°' ||
                                /^✅/u.test(cr)
                            ) {
                                ptp = 210
                            } else if (
                                /kendala teknis|server error/i.test(cr)
                            ) {
                                ptp = 500
                            } else if (
                                nsc < 86_390_000 &&
                                /^Booking .* belum dibuka|^Perjanjian .* belum dibuka/i.test(
                                    cr
                                )
                            ) {
                                ptp = 402
                            } else if (
                                /^☑️Reservasi|silakan coba lagi, jika/su.test(
                                    cr
                                )
                            ) {
                                if (/|silakan coba lagi, jika/su.test(cr))
                                    await this.setTheGoodclient(phn)
                                if (/silakan coba lagi, jika/s.test(cr)) {
                                    setTimeout(async () => {
                                        this.lsXmsg = this.lsXmsg.filter(
                                            (x) => x.s !== rtkn
                                        )
                                    }, 0)
                                }
                            } else if (
                                /^🙏Pendaftaran online .* tunggu beberapa|🙏Pendaftaran online .* dibuka/iu.test(
                                    cr
                                )
                            )
                                ptp = 400
                            else if (
                                /^Pendaftaran|^Info|^Selamat .*Informasi/.test(
                                    cr
                                )
                            )
                                ptp = 301
                            else if (/^Maaf|^Error|^Info|^RM/s.test(cr)) {
                                ptp = 110
                                if (/^Error/i.test(cr)) {
                                    sx = isFontStandart(mx)
                                    if (sx > ' ') rs.rem = sx
                                }
                            } else if (
                                /^Selamat.*poliklinik libur|^Selamat.*Pendaftaran.* tutup/is.test(
                                    cr
                                )
                            )
                                ptp = 410
                            else if (/^Silakan kirim ulang se/.test(cr))
                                ptp = 420
                            else if (/^_contoh.*_atau/is.test(cr)) {
                                nd = cr.indexOf('_atau')
                                rs.rem = cr.substring(nd)
                                rs.res = cr.substring(0, nd - 1)
                            } else if (/^🗒️Untuk Informasi/isu.test(cr)) {
                                rs.res = cr.replace('🗒️', '🙏🏻')
                                await this.noSpamMx(rtkn, 121_000, 1, rs.res)
                            } else if (
                                (nsc < 21_590_00 || nsc > 21_630_000) &&
                                /^🗒️|^🙏|^🙏🏻|^🙄|^Tgl|^dr/u.test(cr)
                            )
                                ptp = 101
                            else if (
                                nsc < 86_270_000 &&
                                /^Reservasi .* dibatalkan/.test(cr)
                            )
                                ptp = 401
                            else if (/Format mendaftar/i.test(cr)) {
                                if (cr.startsWith('🙂'))
                                    await this.noSpamMx(rtkn, 300_000, 2, cr)
                                await this.noSpamMx(
                                    rtkn,
                                    nsc > 25_600_000 ? 600_000 : 60_000,
                                    1,
                                    '🙂' + cr
                                )
                                nd = 0
                                if (/Format perjanjian/i.test(cr))
                                    nd = cr.indexOf('Format perjanjian')
                                else if (/atau, perjanjian/.test(cr))
                                    nd = cr.indexOf('atau, perjanjian')
                                if (nd > 1) {
                                    rs.rem = cr.substring(nd)
                                    rs.res = cr.substring(0, nd - 1)
                                }
                                sx = isFontStandart(mx)
                                if (sx > ' ') rs.rem = sx
                            }

                            if (rs.res) {
                                nd = 1
                                try {
                                    const rx =
                                        await this.instance.sock.sendMessage(
                                            clientId,
                                            { text: rs.res }
                                        )
                                    rst.push(rx)
                                    nd = 0
                                    if (ptp === 101)
                                        setTimeout(async () => {
                                            await this.ps_info01(
                                                clientId,
                                                now,
                                                rtkn,
                                                ntag,
                                                cr
                                            )
                                        }, 0)
                                    else if (ptp === 110)
                                        setTimeout(async () => {
                                            await this.ps_info10(
                                                clientId,
                                                rtkn,
                                                cr,
                                                nx
                                            )
                                        }, 0)
                                    else if (ptp === 401)
                                        setTimeout(async () => {
                                            await this.ps_batal(
                                                clientId,
                                                now,
                                                rtkn,
                                                ntag,
                                                cr
                                            )
                                        }, 0)
                                    else if (
                                        [
                                            200, 210, 220, 301, 400, 402, 410,
                                            420,
                                        ].includes(ptp)
                                    )
                                        setTimeout(async () => {
                                            await this.ps_pause(
                                                ptp,
                                                clientId,
                                                rtkn,
                                                cr
                                            )
                                        }, 0)

                                    if (
                                        nsc > 57_000_000 &&
                                        this.nextFetchBl < now
                                    ) {
                                        this.nextFetchBl = now + 29_000_000
                                        await this.getBlackList()
                                    }
                                } catch (e7) {
                                    if (nd === 1)
                                        this.lsUnSent.unshift({
                                            id: clientId,
                                            msg: rs.res,
                                        })
                                    console.log(
                                        `\n\n::::ERROR.1244 sendMessage::${e7}\n${rtkn}\n${rs.res}\n▲ ${clientId}\n`,
                                        e7
                                    )
                                    await amQsend(
                                        `⚠️Wa81 ERR.1245 sendMessage::${e7}\n${rtkn}\n${
                                            rs.res
                                        }\n▲ //wa.me/${clientId.replace(
                                            /\D/g,
                                            ''
                                        )}`
                                    )
                                }
                            } else {
                                rst.push('')
                            }
                        }
                        if (rs.rem) {
                            if (/^🗒️Untuk Informasi/u.test(rs.rem))
                                rs.rem = rs.rem.replace('🗒️', '🙏🏻')
                            rst.push(
                                await this.instance.sock.sendMessage(clientId, {
                                    text: rs.rem,
                                })
                            )
                        }
                        if (rs.err) {
                            await this.instance.sock.sendMessage(clientId, {
                                text: 'Maaf, ada error pada sistem kami,\nsilakan coba beberapa saat lagi',
                            })
                            rst.push(rs.err)
                            console.log(`\nError::${rs.err}\n`)
                            await amQsend(`⛑⛑⛑Wa81 queue-error:\n${rs.err}`)
                        }
                    }
                    webhookData['rst'] = rst
                } else if (qm > '') {
                    webhookData['tr'] = new Date().getTime()
                    webhookData['rst'] = await this.sendTextMessage(
                        clientId,
                        qm
                    )
                } else if (xErr > '') {
                    webhookData['tr'] = new Date().getTime()
                    webhookData['rst'] = await this.sendTextMessage(
                        clientId,
                        'Maaf text anda tidak terbaca (terkendala koneksi-WA)🙏🏻'
                    )
                }
            } catch (e) {
                xErr = `⛑⛑⛑Wa81 Error-process:\n${e}\n${now}\n${mx}\n${e.stack}\n`
                console.log(xErr)
                await amQsend(
                    `${xErr}\n: //wa.me/${clientId.replace(/\D/g, '')}`
                )
                webhookData['err-3'] = `Error-process::${e.stack}`
                rst.push(
                    await this.instance.sock.sendMessage(clientId, {
                        text: 'Maaf, ada error sistem\nsilakan coba beberapa menit lagi🙏🏻',
                    })
                )
                webhookData['rst'] = rst
                if (rtkn > '') {
                    await this.noSpamMx(
                        rtkn,
                        171_000,
                        -1,
                        ' Silakan coba beberapa saat lagi'
                    )
                    await this.setBruteClient(clientId, 5, 175_000, rtkn)
                }
                await sleep(5_000)
            }

            webhookData['tx'] = new Date().getTime()
            await this.SendWebhook('message', webhookData, this.key)
        }, 0)
    }

    sayMxTime(cc, clientId) {
        if (this.pInfoLate1.includes(clientId)) return ''
        this.pInfoLate1.push(clientId)
        if (this.pInfoLate1.length > 88) this.pInfoLate1.shift()

        const _d = new Date(new Date().getTime() + 25_199_991) // 25_200_000
        let cr = _d.toISOString().substring(11, 19),
            cf = cc.match(/\(di jam (.+)\),/)
        if (cf) {
            let ct = cf[1].replace(/[^0-9:]/g, '')
            if (cr < ct) cr = ct
        }
        return `*WA anda tadi masuk di jam ${cr}`
    }

    sayWait2retry(clientId, nsc) {
        if (this.pInfoRetry1.includes(clientId)) return ''

        this.pInfoRetry1.push(clientId)
        if (this.pInfoRetry1.length > 88) this.pInfoRetry1.shift()

        // const nsc = (new Date().getTime() - 1_684_861_200_000) % 86_400_000
        const tm = 3600_000 * 23.0
        const nw = parseInt((tm - nsc) / 1000) + 60
        let cr = ''
        if (nw >= 60) {
            let nh = parseInt(nw / 3600),
                nm = Math.round((nw % 3600) / 60)
            if (nm % 5 > 0) {
                nm += 5 - (nm % 5)
                if (nm >= 60) {
                    nm = 0
                    nh++
                }
            }
            let cm = nm > 0 ? `${nm} menit ` : ''
            if (nh > 0) cr = `_silakan coba ${nh} jam ${cm}lagi_`
            else cr = `_silakan coba ${cm}lagi_`
        }
        return cr
    }

    async ps_pause(pId, clientId, rtkn, cr) {
        const nsc = (new Date().getTime() - 1_684_861_200_000) % 86_400_000
        let nd,
            sx = ' '
        switch (pId) {
            case 200:
                // nd = 5_000
                // if (/^Pendaftaran berhasil, untuk/s.test(cr))
                //     sx = cr.replace('Pendaftaran berhasil,', '🗓 Telah terdaftar')
                // else if (/berhasil reservasi/s.test(cr))
                //     sx = cr.replace('berhasil reservasi', 'telah reservasi')
                // else {
                //     sx = "          🙏"
                // }
                await this.noSpamMx(
                    rtkn,
                    150_000,
                    1,
                    ' Silakan coba beberapa saat lagi'
                )
                break
            case 210:
                if (!/berhasil dibatalkan/is.test(cr)) {
                    await this.noSpamMx(
                        rtkn,
                        120_000,
                        1,
                        cr === '°°' ? cr : ' √'
                    )
                }
                break
            case 220:
                await this.noSpamMx(rtkn, 180_000, -1, ' ')
                break
            case 301:
                if (nsc > 21_660_000) {
                    nd = 3_600_000
                } else {
                    nd = 21_595_000 - nsc
                    if (nd > 1_800_000) nd = 1_800_000
                }
                if (nd > 1_000) {
                    let cc = ' '
                    if (/^Pendaftaran untuk hari .+ dimulai jam/i.test(cr))
                        cc = '🙂Pendaftaran akan dimulai jam 06:00'
                    // if (/^Pendaftaran .+ akan dibuka pada hari/si.test(cr))
                    else cc = ' ' + cr
                    await this.noSpamMx(rtkn, nd, 0, cc)
                }
                break
            case 400:
                nd = 21_595_000 - nsc
                if (nd > 300_000) nd = 300_000
                if (nd > 1_000)
                    await this.noSpamMx(
                        rtkn,
                        nd,
                        0,
                        ' Silakan coba beberapa saat lagi'
                    )
                break
            case 402:
                if (nsc >= 57_600_000 && nsc < 61_500_000)
                    nd = 61_200_000 - nsc // 16:00 - 17:00 61_200
                else if (nsc > 84_600_000) nd = 86_400_000 - nsc
                else nd = 1_800_000
                if (nd > 1_000)
                    await this.noSpamMx(rtkn, nd, 1, ' ' + stringTrim(cr))
                break
            case 410:
                nd = cr.indexOf('\n\n')
                sx = nd > 19 ? cr.substring(0, nd) : cr
                nd = sx.indexOf(',\nPendaftaran')
                if (nd > 5 && nd < 19) sx = sx.substring(nd + 2)
                else {
                    nd = sx.indexOf('🙂')
                    if (nd > 5) sx = sx.substring(nd)
                }
                await this.noSpamMx(rtkn, 3_600_000, 0, ' ' + sx)
                break
            case 420:
                nd = 125_000 // (/2.+menit/.test(cr)) ? 120_000 : 170_0000
                await this.noSpamMx(rtkn, nd - 5_000, 0, ' ')
                await this.setBruteClient(clientId, 5, nd, rtkn)
                break
        }
    }

    async ps_info01(clientId, now, rtkn, ntag, cr) {
        const nsc = (now - 1_684_861_200_000) % 86_400_000
        if (/belum menyerahkan|kasir/is.test(cr)) {
            await this.noSpamMx(rtkn, 300_000, 0, ' ' + cr)
        } else if (/tidak sesuai|tidak ada data/i.test(cr)) {
            await this.noSpamMx(rtkn, 600_000, 2, ' ' + cr.replace('🙏', '🧐'))
            await this.setBruteClient(clientId, 1, 600_000)
        } else if (/harap/.test(cr) && !/sudah reservasi/.test(cr)) {
            this.lsXmsg = this.lsXmsg.filter((d) => d.s !== rtkn)
        } else if (/Ini adalah|diampu oleh|praktik di/s.test(cr)) {
            await this.noSpamMx(rtkn, 900_000, 0, ' ' + cr)
        } else if (/hari .+libur/is.test(cr)) {
            await this.noSpamMx(rtkn, 1_800_000, 0, '🙂' + cr)
        } else if (ntag < 2) {
            await this.noSpamMx(rtkn, 35_000, 0, ' ')
        } else if (/teragenda|belum terjadwal|agendanya/.test(cr)) {
            if (!rtkn.startsWith('ut.11.')) {
                // ct = `ut.11..${ci[0]}`
                if (nsc < 21_597_000 || nsc > 21_630_000)
                    await this.noSpamMx(
                        rtkn,
                        600_000,
                        1,
                        '🧐' + cr.replace('🙏', '')
                    )
            }
        } else if (/belum dibuka|akan dibuka| 06:0/s.test(cr)) {
            // "🙏Pendaftaran online untuk hari-H akan dibuka mulai jam 06:00 pagi.
            let nd = 21_597_000 - nsc
            if (nd > 3_600_000) nd = 3_600_000
            else if (nd < 1000) nd = 500

            if (nd > 1_000) await this.noSpamMx(rtkn, nd, 0, '🙂' + cr)
        } else {
            let nd = /sudah reservasi/i.test(cr) ? -2 : 1
            if (nd < 0) {
                try {
                    this.lsExResp = this.lsExResp.filter(
                        (d) => d.t > now - 3_600_000
                    )
                    nd = cr.indexOf(',')
                    if (nd > 40) {
                        let ss = cr.substring(0, nd)
                        nd = this.lsExResp.findIndex((d) => d.s === ss)
                        if (nd >= 0) {
                            this.lsExResp[nd].n++
                            this.lsExResp[nd].t = now + 3_600_000
                            if (this.lsExResp[nd].n >= 2)
                                await this.setBruteClient(
                                    clientId,
                                    5,
                                    300_000,
                                    rtkn
                                )
                        } else {
                            this.lsExResp.push({ s: ss, t: now, n: 1 })
                        }
                    }
                } catch (e) {
                    console.log(`\n\n::::ERROR blocking3.rsv ${rtkn}`, e)
                    await amQsend(`⚠️Wa81 ERR blocking3.rsv ${e}\n${rtkn}`)
                }
                nd = 2
            }
            await this.noSpamMx(
                rtkn,
                120_000,
                nd,
                ' Silakan coba beberapa saat lagi'
            )
        }
    }

    async ps_info10(clientId, rtkn, cr, nx = 0) {
        const nsc = (new Date().getTime() - 1_684_861_200_000) % 86_400_000
        let nd = 60_000,
            sx = ' ' + cr.replace('Maaf,', '🙏')
        if (nsc < 21_555_000) {
            nd = 21_556_000 - nsc
            if (nd > 1_800_000) nd = 1_800_000
        } else if (nsc > 22_000_000) nd = 600_000

        // "Maaf, mulai 17/09/2024 pendaftaran Klinik Gigi untuk Hari-H dibuka mulai jam 06:00.
        if (/^Maaf, .* dibuka .* 06/i.test(cr) && nsc < 21_590_000) {
            if (/^Maaf, mulai 17\/09\/2024 p/.test(cr)) {
                sx = ' ' + cr.replace('Maaf, mulai 17/09/2024 p', 'P')
                sx = sx.replace('H dibuka', 'H akan dibuka')
            }
            nx = 0
            nd = 21_550_000 - nsc
            if (nd > 7_200_000) nd = 7_200_000
            else if (nd < 4_000) nd = 4_000
        } else if (/^Maaf, Kuota/i.test(cr)) {
            if (nsc < 21_000_000 || nsc > 21_618_000) nd = 600_000
        } else if (/^Maaf, tanggal .* libur/is.test(cr)) {
            sx = '🙂' + cr
            nd = 3_600_000
        } else if (/tidak sesuai/is.test(cr)) {
            nd = 120_000
            sx = ' ' + cr.replace('Maaf,', '🧐')
            await this.setBruteClient(clientId, 1, 900_000)
        } else if (
            /tidak menerima|tidak menyediakan|tidak ada|tidak praktik|berhalangan/is.test(
                cr
            )
        ) {
            nd = 600_000
            nx = 1
        } else if (/teragenda|diagendakan|belum terjadwal|agendanya/.test(cr)) {
            sx = cr.replace('Maaf,', '🧐')
            nd = 600_000
        }
        // else if (/^Error nama|daftar *#/si.test(cr)) {
        //     if (nsc > 8_300 && nsc < 86_390_000 && /^Error nama klinik/si.test(cr)) {
        //         sx = '👁' + cr; nd = 300_000; nx = 2
        //     } else nd = 8_000
        // }
        // else if (/format|harap/i.test(cr)) {
        //     nd = 5_000
        // }
        else if (/reservasi online|praktik|tidak/i.test(cr)) {
            sx = ' ' + cr
            if (nd > 120_000) nd = 120_000
        } else {
            nx = 1
            if (nd > 300_000) {
                nd = 300_000
            }
        }
        if (nsc < 23_000_000 && nsc > 21_599_000) nd = 1_100
        else if (nsc < 21_599_500 && nsc + nd > 21_599_000)
            nd = 21_599_000 - nsc
        if (nd > 1_000) await this.noSpamMx(rtkn, nd, nx, sx)
    }

    async ps_batal(clientId, now, rtkn, ntag, cr) {
        // const nsc = (new Date().getTime() - 1_684_861_200_000) % 86_400_000
        try {
            // Reservasi RM 703741 untuk tgl 24/01 dengan Fisioterapis #28 berhasil dibatalkan.
            if (/☑️/u.test(cr)) {
                await this.clearOneXmsg(cr, clientId.replace(/\D/g, ''))
                return
            }
            this.lsRevCanceled = this.lsRevCanceled.filter(
                (d) => d.t > now - 9_800_000
            )
            let nd = this.lsRevCanceled.findIndex(
                (d) => d.s === cr.substring(0, 21)
            )
            if (nd < 0)
                this.lsRevCanceled.push({
                    s: cr.substring(0, 21),
                    t: now,
                    n: 1,
                })
            else {
                this.lsRevCanceled[nd].n++
                this.lsRevCanceled[nd].t = now
                if (this.lsRevCanceled[nd].n >= 3) nd = 321
            }

            await this.setBruteClient(
                clientId,
                nd >= 321 ? 5 : 2,
                3_600_000 * 6
            )

            let sx = ' Silakan coba beberapa saat lagi'
            if (ntag >= 3 || /batal/is.test(rtkn))
                await this.noSpamMx(rtkn, 180_000, 1, sx)

            if (nd >= 321 && ntag >= 3)
                await this.noSpamMx(
                    rtkn.replace('batal', 'daftar'),
                    3_600_000,
                    7,
                    sx
                )
        } catch (e) {
            console.log(`\n\n::::ERROR blocking.rev ${rtkn}`, e)
            await amQsend(`⚠️🟠Wa81 ERR blocking.rev ${e}\n${rtkn}\n${e.stack}`)
        }
    }

    async clearOneXmsg(cr, phn) {
        try {
            const ls = cr.match(/RM (\d+) /)
            if (ls) {
                const matcher = new RegExp(`${ls[1]}`)
                this.lsXmsg = this.lsXmsg.filter((d) => !matcher.test(d.s))
            }
            // if (phn > '0') {
            //     const ii = this.lsTrialclient.indexOf(phn)
            //     if (ii !== -1) this.lsTrialclient.splice(ii, 1)
            // }
        } catch (e) {
            console.log('ERROR clearOneXls', e)
            await amQsend(`⚠️😱Wa81 ERR clearOneXls ${e}\n${cr}\n${e.stack}`)
        }
    }

    async attemptReSend() {
        if (this.lsUnSent.length < 1 || this.isReSend) return
        this.isReSend = true
        setTimeout(async () => {
            let n = this.lsUnSent.length,
                m,
                r
            while (n > 0) {
                try {
                    n--
                    m = this.lsUnSent.pop()
                    if (m) {
                        r = await this.instance.sock.sendMessage(m.id, {
                            text: m.msg,
                        })
                        await this.SendWebhook(
                            `Wa81.rx.${m.id}`,
                            {
                                tm: cTimeStamp(),
                                sn: new Date().getTime(),
                                mx: m.msg,
                                rst: r,
                            },
                            this.key
                        )
                        await sleep(888)
                    }
                } catch (e) {
                    this.lsUnSent.unshift(m)
                    console.log(`\n\n::::ERROR.1092 attemptReSend::${e}\n${m}`)
                    await amQsend(`⚠️Wa81 ERR.1092 attemptReSend::${e}\n${m}`)
                    break
                }
            }
            this.isReSend = false
        }, 123)
    }

    // async doRsv(waId, mx, now, token) {
    //     try {
    //         const rsv = { msg: mx, sender: waIdToPhnNumber(waId), tm: cTimeStamp(now) }
    //         return await admService.reservation(rsv, token)
    //     } catch (e) {
    //         console.log(`Error doRsv ${waId}\n${e}`)
    //         await amQsend(`⚠️Wa81 Error-doRsv:\n${waId}\n${e}`)
    //     }
    //     return null
    // }

    async execRsv(waId, mx, now, token) {
        try {
            const rsv = {
                msg: mx,
                sender: waIdToPhnNumber(waId),
                tm: cTimeStamp(now),
            }
            return await MyGrpc2.getInstance('5007').reservation(rsv, token)
        } catch (e) {
            console.log(`Error execRsv  ${waId}:${token}::`, e)
            await amQsend(`⛑⛑😱Wa81 Error-execRsv:\n${waId}\n${token}\n${e}`)
        }
        return null
    }

    async getToken(phn, mx, now, rtkn) {
        try {
            let dt = { msg: mx, sender: phn, tm: cTimeStamp(now) }
            let rd = await MyGrpc2.getInstance('5006').chk(dt, '')
            if (!rd || rd.err) {
                console.log(`Error getToken (a):: ${phn}${mx}`, rd)
                await amQsend(
                    `⛑Wa81 ERROR getToken\n${rd?.err}\n:${mx}\n${phn}`
                )
            } else {
                dt = JSON.parse(rd.res)
                if (dt.tkn > '' && dt.tkn.length < 55) rtkn = dt.tkn
            }
        } catch (e) {
            console.log(`Error getToken (b):: ${phn}${mx}\n`, e)
            await amQsend(`⛑⛑Wa81 Error-getToken::\n${phn}\n${mx}\n${e}`)
        }
        return rtkn
    }

    async getTxtMsg(mxType, msx) {
        let mx = '',
            qm = '',
            err = ''
        try {
            if (mxType === 'messageContextInfo') {
                mxType = Object.keys(msx.message)[0]
            }
            switch (mxType) {
                case 'conversation':
                    mx = msx.message.conversation
                    break
                case 'extendedTextMessage':
                    mx = msx.message.extendedTextMessage.text
                    break
                case 'highlyStructuredMessage':
                    mx =
                        msx.message.highlyStructuredMessage.hydratedHsm
                            .hydratedTemplate.hydratedContentText
                    break
                case 'editedMessage':
                    // mx = msx.message.protocolMessage.editedMessage.conversation
                    qm = '🙃 _silakan kirim_'
                    break
                case 'imageMessage':
                    try {
                        mx = msx.message.imageMessage.caption
                        const sender = msx.key
                            ? msx.key.remoteJid.replace(/[^0-9]/g, '')
                            : '-'
                        const t =
                            (new Date().getTime() - 1_684_861_200_000) %
                            86_400_000
                        if (t >= 19_000 && t <= 86_380_000) {
                            await this.unduhMsg(
                                'image',
                                msx.message.imageMessage,
                                sender
                            )
                        } else {
                            await amQsend(
                                `🙄Wa81 NoTime4DownloadImage\n${sender}`
                            )
                        }
                    } catch (e1) {
                        console.log(`Error get imageMessage: ${sender}\n${e1}`)
                        await amQsend(
                            `⚠️Wa81 Error@imageMessage ${sender}\n${e1}`
                        )
                    }
                    if (!mx) qm = '🙄'
                    break
                case 'videoMessage':
                    try {
                        mx = msx.message.videoMessage.caption
                        const sender = msx.key
                            ? msx.key.remoteJid.replace(/[^0-9]/g, '')
                            : '-'
                        const t =
                            (new Date().getTime() - 1_684_861_200_000) %
                            86_400_000
                        if (t >= 70_000 && t <= 86_300_000) {
                            await this.unduhMsg(
                                'video',
                                msx.message.videoMessage,
                                sender
                            )
                        } else {
                            await amQsend(
                                `🙄Wa81 NoTime4DownloadVideo\n${sender}`
                            )
                        }
                    } catch (e1) {
                        console.log(`Error get @videoMessage ${sender}\n${e1}`)
                        await amQsend(`⚠️Wa81 Error@videoMessage\n${e1}`)
                    }
                    if (!mx) qm = '🙄'
                    break
                case 'stickerMessage':
                    qm = '🙏🏻🙂'
                    try {
                        let t =
                            (new Date().getTime() - 1_684_861_200_000) %
                            86_400_000
                        if (t >= 8_000 && t <= 86_390_000) {
                            const sender = msx.key
                                ? msx.key.remoteJid.replace(/[^0-9]/g, '')
                                : '-'
                            await this.unduhMsg(
                                'image',
                                msx.message.stickerMessage,
                                sender
                            )
                        }
                    } catch (e1) {
                        console.log('Err..@stickerMessage: ' + e1)
                        await amQsend(`⚠️Wa81 Error@stickerMessage\n${e1}`)
                    }
                    break
                case 'documentMessage':
                    try {
                        let t =
                            (new Date().getTime() - 1_684_861_200_000) %
                            86_400_000
                        if (t >= 80_000 && t <= 86_300_000) {
                            const sender = msx.key
                                ? msx.key.remoteJid.replace(/[^0-9]/g, '')
                                : '-'
                            await this.unduhMsg(
                                'document',
                                msx.message.documentMessage,
                                sender
                            )
                        }
                    } catch (e1) {
                        console.log('Error get .. @documentMessage' + e1)
                        await amQsend(`⚠️Wa81 Error@documentMessage\n${e1}`)
                    }
                    if (!mx) qm = '🙄'
                    break
                case 'documentWithCaptionMessage':
                    try {
                        mx = msx.message.documentWithCaptionMessage.caption
                        const sender = msx.key
                            ? msx.key.remoteJid.replace(/[^0-9]/g, '')
                            : '-'
                        await this.unduhMsg(
                            'document',
                            msx.message.documentWithCaptionMessage,
                            sender
                        )
                    } catch (e1) {
                        if (!mx) qm = '🙄'
                        console.log(
                            'Error get .. @documentWithCaptionMessage' + e1
                        )
                        await amQsend(
                            `⚠️Wa81 Error@documentWithCaptionMessage\n${e1}`
                        )
                    }
                    break
                case 'audioMessage':
                    qm = 'Maaf hanya menerima pesan text saja🔇'
                    break
                case 'reactionMessage':
                    await amQsend(`⚡️☕️Wa81 rcv::reactionMessage`)
                    break
                case 'contactMessage':
                    qm = '🙄'
                    break
                case 'contactsArrayMessage':
                    qm = '🙄'
                    break
                case 'locationMessage':
                    qm = '🙄'
                    break
                case 'groupInviteMessage':
                    qm = '🙄'
                    break
                case 'productMessage':
                    qm = '🙄'
                    await amQsend(`⚡️☕️Wa81 rcv::productMessage`)
                    break
                case 'templateMessage':
                    await amQsend(
                        `⚡️☕️Wa81 rcv::templateMessage\n\n${JSON.stringify(
                            msx
                        )}`
                    )
                    try {
                        mx =
                            msx.message.templateMessage.hydratedTemplate
                                .hydratedContentText
                        qm = ''
                    } catch (e1) {
                        if (!mx) qm = '🙄'
                        console.log('Error get .. templateMessage' + e1)
                        await amQsend(`⚠️Wa81 Error@templateMessage\n${e1}`)
                    }
                    break
                case 'call':
                    qm =
                        '🔇Maaf tidak dapat menerima tlp,\nsilakan *tlp (0274) 367381 / 367386*'
                    break
                case 'viewOnceMessageV2':
                    qm = '🧐'
                    break
                case 'listMessage':
                    qm = '🧐'
                    break
                case 'buttonsMessage':
                    qm = '🧐'
                    break
                default:
                    qm = '?'
                    err = `☕️Wa81 Unhandle::${mxType}\n${JSON.stringify(msx)}`
                    console.log(err)
                    await amQsend(`⚡️${err}`)
                    break
            }
        } catch (e) {
            err = `🤔Wa81 Err.getTxtMsg::${mxType}\n${e}`
            console.log(err)
        }
        return [mx, qm, err]
    }

    async unduhMsg(ctype, oMx, sender = '') {
        setTimeout(async () => {
            const nFile = new Date().getTime() % 1000_000_000_000
            const tMime = oMx.mimetype
                ? oMx.mimetype.replace(/\//g, '.')
                : ctype
            let nTry = 1
            while (nTry < 5) {
                try {
                    const buffer = await downloadMessage(oMx, ctype, 1)
                    await fsp.writeFile(
                        `/mnt/cam/wa/${nFile}-${sender}-${tMime}`,
                        buffer
                    )
                    console.log(
                        '::Download',
                        nFile,
                        sender,
                        tMime,
                        oMx.fileLength
                    )
                    nTry = 5
                    break
                } catch (err) {
                    console.log(
                        '::ERROR Download',
                        nTry,
                        nFile,
                        sender,
                        tMime,
                        err
                    )
                    await amQsend(
                        `⚡️Wa81 Err.d/l ${nTry}|${tMime}::${sender}\n${err}`
                    )
                    await sleep(3_300)
                }
                nTry++
            }
        }, 179)
    }

    async infoUnreadC() {
        if (this.p1_busy) return
        this.p1_busy = true
        if (this.lsUnreadChats.length > 0) {
            const cl = this.lsUnreadChats.join('\n').replace(/[A-z@.]/g, '')
            if (cl !== this.lastUrC) {
                this.lastUrC = cl
                await amQsend(
                    `⚡️Wa81 unreadC #${
                        this.lsUnreadChats.length
                    }\n//wa.me/${cl}\n${cTimeStamp()}`
                )
            }
        }
        this.p1_busy = false
    }

    async callNotAvl(waId, ndelay = 1) {
        try {
            if (await this.isBruteClient(waId)) return
            setTimeout(async () => {
                const ans =
                    '🔇Maaf tidak dapat menerima tlp,\nsilakan *tlp ke (0274) 367381 / 367386*'
                await this.instance.sock?.sendMessage(waId, { text: ans })
            }, ndelay)
        } catch (e) {
            console.log(`Error sendMessage on CB:call ${waId}\n${e}`)
            await amQsend(`⚠️Wa81 Err.callNotAvl:\n${waId}\n${e}`)
        }
    }

    async hapusErrorRespons() {
        this.task01do++
        if (this.task01do > 0) return
        /*
            { "remoteJid": "6288232667014@s.whatsapp.net", "fromMe": true, "id": "BAE5C004BF7F281F", "ts": "1719766803" },
            { "remoteJid": "6281226924006@s.whatsapp.net", "fromMe": true, "id": "BAE568D58DD02EE9", "ts": "1719766803" },
            { "remoteJid": "6285712886442@s.whatsapp.net", "fromMe": true, "id": "BAE57B17B6DC162E", "ts": "1719766806" },
        */
        let ls = []
        for (let i = 0; i < ls.length; i++) {
            await this.hapusMessageFme(
                ls[i].remoteJid,
                ls[i].id,
                true,
                ls[i].ts
            )
            // await this.hapusMessageFme(this.getWhatsAppId(to), data.key.id, true, data.messageTimestamp)
            await sleep(10_321)
        }
        this.task01do = 1
    }

    async hapusMessageFme(clientId, mxId, fromMe, tmstamp) {
        try {
            console.log('::hapusMessageFme::', clientId, mxId, fromMe, tmstamp)
            const r = await this.instance.sock?.chatModify(
                {
                    clear: {
                        messages: [
                            { id: mxId, fromMe: fromMe, timestamp: tmstamp },
                        ],
                    },
                },
                clientId,
                []
            )
            await amQsend(`⚡️Wa.I delMsgFme:\n${r} ${clientId}`)
        } catch (e) {
            console.log('::ERROR hapusMessageFme::', e)
            await amQsend(`⚡️Wa.I Err.hapusMessageFme ${e}`)
        }
    }

    async reactMessage(id, key, emoji) {
        try {
            if (await this.isBruteClient(id)) return
            const reactionMessage = {
                react: {
                    text: emoji, // use an empty string to remove the reaction
                    key: key,
                },
            }
            const res = await this.instance.sock?.sendMessage(
                this.getWhatsAppId(id),
                reactionMessage
            )
            return res
        } catch (e) {
            logger.error('Error react message failed')
        }
    }

    async readMessage(msgObj) {
        try {
            setTimeout(async () => {
                if (await this.isBruteClient(msgObj.remoteJid)) {
                    this.lsUnreadChats = this.lsUnreadChats.filter(
                        (x) => x !== msgObj.remoteJid
                    )
                    return
                }
                const key = {
                    remoteJid: msgObj.remoteJid,
                    id: msgObj.id,
                    participant: msgObj?.participant, // required when reading a msg from group
                }

                await this.instance.sock?.readMessages([key])
            }, 86)
        } catch (e) {
            logger.error('Error set read-message failed', e)
        }
    }

    getWhatsAppId(id) {
        if (id.includes('@g.us') || id.includes('@s.whatsapp.net')) return id
        return id.includes('-') ? `${id}@g.us` : `${id}@s.whatsapp.net`
    }

    async verifyId(id) {
        if (id.includes('@g.us')) return true
        const [result] = await this.instance.sock?.onWhatsApp(id)
        if (result?.exists) return true
        throw new Error('no account exists')
    }

    async sendTextMessage(to, message, verify = 0) {
        let data
        try {
            if (verify > 0) await this.verifyId(this.getWhatsAppId(to))
            data = await this.instance.sock?.sendMessage(
                this.getWhatsAppId(to),
                { text: message }
            )
        } catch (e) {
            data = `Err.sendTextMessage: ${to} ::${e}`
            await amQsend(`⚠️Wa81 Err.sendTextMessage:\n${to}\n${e}`)
        }
        return data
    }

    async sendMediaFile(to, file, type, caption = '', filename) {
        await this.verifyId(this.getWhatsAppId(to))
        const data = await this.instance.sock?.sendMessage(
            this.getWhatsAppId(to),
            {
                mimetype: file.mimetype,
                [type]: file.buffer,
                caption: caption,
                ptt: type === 'audio' ? true : false,
                fileName: filename ? filename : file.originalname,
            }
        )
        return data
    }

    async sendUrlMediaFile(to, url, type, mimeType, caption = '') {
        await this.verifyId(this.getWhatsAppId(to))
        const data = await this.instance.sock?.sendMessage(
            this.getWhatsAppId(to),
            {
                [type]: { url: url },
                caption: caption,
                mimetype: mimeType,
            }
        )
        return data
    }

    async sendButtonMessage(to, data) {
        await this.verifyId(this.getWhatsAppId(to))
        const result = await this.instance.sock?.sendMessage(
            this.getWhatsAppId(to),
            {
                templateButtons: processButton(data.buttons),
                text: data.text ?? '',
                footer: data.footerText ?? '',
                viewOnce: true,
            }
        )
        return result
    }

    async sendMediaButtonMessage(to, data) {
        await this.verifyId(this.getWhatsAppId(to))
        const result = await this.instance.sock?.sendMessage(
            this.getWhatsAppId(to),
            {
                [data.mediaType]: { url: data.image },
                footer: data.footerText ?? '',
                caption: data.text,
                templateButtons: processButton(data.buttons),
                mimetype: data.mimeType,
                viewOnce: true,
            }
        )
        return result
    }

    async getUserStatus(of) {
        await this.verifyId(this.getWhatsAppId(of))
        const status = await this.instance.sock?.fetchStatus(
            this.getWhatsAppId(of)
        )
        return status
    }

    async blockUnblock(to, data) {
        await this.verifyId(this.getWhatsAppId(to))
        const status = await this.instance.sock?.updateBlockStatus(
            this.getWhatsAppId(to),
            data
        )
        return status
    }

    async sendContactMessage(to, data) {
        await this.verifyId(this.getWhatsAppId(to))
        const vcard = generateVC(data)
        const result = await this.instance.sock?.sendMessage(
            await this.getWhatsAppId(to),
            {
                contacts: {
                    displayName: data.fullName,
                    contacts: [{ displayName: data.fullName, vcard }],
                },
            }
        )
        return result
    }

    async sendListMessage(to, data) {
        await this.verifyId(this.getWhatsAppId(to))
        const result = await this.instance.sock?.sendMessage(
            this.getWhatsAppId(to),
            {
                text: data.text,
                sections: data.sections,
                buttonText: data.buttonText,
                footer: data.description,
                title: data.title,
                viewOnce: true,
            }
        )
        return result
    }

    async setStatus(status, to) {
        await this.verifyId(this.getWhatsAppId(to))
        const result = await this.instance.sock?.sendPresenceUpdate(status, to)
        return result
    }

    async DownloadProfile(of) {
        await this.verifyId(this.getWhatsAppId(of))
        const ppUrl = await this.instance.sock?.profilePictureUrl(
            this.getWhatsAppId(of),
            'image'
        )
        return ppUrl
    }

    // get user or group object from db by id
    async getUserOrGroupById(id) {
        try {
            let Chats = await this.getChat()
            const group = Chats.find((c) => c.id === this.getWhatsAppId(id))
            if (!group)
                throw new Error(
                    'unable to get group, check if the group exists'
                )
            return group
        } catch (e) {
            logger.error(`Error get group failed:: ${e}`)
        }
    }

    // Group Methods
    parseParticipants(users) {
        return users.map((users) => this.getWhatsAppId(users))
    }

    async updateDbGroupsParticipants() {
        try {
            let groups = await this.groupFetchAllParticipating()
            let Chats = await this.getChat()
            if (groups && Chats) {
                for (const [key, value] of Object.entries(groups)) {
                    let group = Chats.find((c) => c.id === value.id)
                    if (group) {
                        let participants = []
                        for (const [
                            key_participant,
                            participant,
                        ] of Object.entries(value.participants)) {
                            participants.push(participant)
                        }
                        group.participant = participants
                        if (value.creation) {
                            group.creation = value.creation
                        }
                        if (value.subjectOwner) {
                            group.subjectOwner = value.subjectOwner
                        }
                        Chats.filter((c) => c.id === value.id)[0] = group
                    }
                }
                await this.updateDb(Chats)
            }
        } catch (e) {
            logger.error(`Error updating groups failed:: ${e}`)
        }
    }

    async createNewGroup(name, users) {
        try {
            const group = await this.instance.sock?.groupCreate(
                name,
                users.map(this.getWhatsAppId)
            )
            return group
        } catch (e) {
            logger.error(`Error create new group failed:: ${e}`)
        }
    }

    async addNewParticipant(id, users) {
        try {
            const res = await this.instance.sock?.groupAdd(
                this.getWhatsAppId(id),
                this.parseParticipants(users)
            )
            return res
        } catch {
            return {
                error: true,
                message:
                    'Unable to add participant, you must be an admin in this group',
            }
        }
    }

    async makeAdmin(id, users) {
        try {
            const res = await this.instance.sock?.groupMakeAdmin(
                this.getWhatsAppId(id),
                this.parseParticipants(users)
            )
            return res
        } catch {
            return {
                error: true,
                message:
                    'unable to promote some participants, check if you are admin in group or participants exists',
            }
        }
    }

    async demoteAdmin(id, users) {
        try {
            const res = await this.instance.sock?.groupDemoteAdmin(
                this.getWhatsAppId(id),
                this.parseParticipants(users)
            )
            return res
        } catch {
            return {
                error: true,
                message:
                    'unable to demote some participants, check if you are admin in group or participants exists',
            }
        }
    }

    async getAllGroups() {
        let Chats = await this.getChat()
        return Chats.filter((c) => c.id.includes('@g.us')).map((data, i) => {
            return {
                index: i,
                name: data.name,
                jid: data.id,
                participant: data.participant,
                creation: data.creation,
                subjectOwner: data.subjectOwner,
            }
        })
    }

    async leaveGroup(id) {
        try {
            let Chats = await this.getChat()
            const group = Chats.find((c) => c.id === id)
            if (!group) throw new Error('no group exists')
            return await this.instance.sock?.groupLeave(id)
        } catch (e) {
            logger.error(`Error leave group failed:: ${e}`)
        }
    }

    async getInviteCodeGroup(id) {
        try {
            let Chats = await this.getChat()
            const group = Chats.find((c) => c.id === id)
            if (!group)
                throw new Error(
                    'unable to get invite code, check if the group exists'
                )
            return await this.instance.sock?.groupInviteCode(id)
        } catch (e) {
            logger.error(`Error get invite group failed:: ${e}`)
        }
    }

    async getInstanceInviteCodeGroup(id) {
        try {
            return await this.instance.sock?.groupInviteCode(id)
        } catch (e) {
            logger.error(`Error get invite group failed:: ${e}`)
        }
    }

    // get Chat object from db
    // async getChat(key = this.key) {
    //     let dbResult = await Chat.findOne({ key: key }).exec()
    //     let ChatObj = dbResult.chat
    //     return ChatObj
    // }
    async getChat(key = this.key) {
        const collection = await getCollection()

        const dbResult = await collection.findOne({
            key,
        })

        return dbResult?.chat || []
    }

    // create new group by application
    async createGroupByApp(newChat) {
        try {
            let Chats = await this.getChat()
            let group = {
                id: newChat[0].id,
                name: newChat[0].subject,
                participant: newChat[0].participants,
                messages: [],
                creation: newChat[0].creation,
                subjectOwner: newChat[0].subjectOwner,
            }
            Chats.push(group)
            await this.updateDb(Chats)
        } catch (e) {
            logger.error(`Error updating document failed:: ${e}`)
        }
    }

    async updateGroupSubjectByApp(newChat) {
        try {
            if (newChat[0] && newChat[0].subject) {
                let Chats = await this.getChat()
                Chats.find((c) => c.id === newChat[0].id).name =
                    newChat[0].subject
                await this.updateDb(Chats)
            }
        } catch (e) {
            logger.error(`Error updating document failed:: ${e}`)
        }
    }

    async updateGroupParticipantsByApp(newChat) {
        try {
            if (newChat && newChat.id) {
                let Chats = await this.getChat()
                let chat = Chats.find((c) => c.id === newChat.id)
                let is_owner = false
                if (chat) {
                    if (chat.participant == undefined) {
                        chat.participant = []
                    }
                    if (chat.participant && newChat.action == 'add') {
                        for (const participant of newChat.participants) {
                            chat.participant.push({
                                id: participant,
                                admin: null,
                            })
                        }
                    }
                    if (chat.participant && newChat.action == 'remove') {
                        for (const participant of newChat.participants) {
                            // remove group if they are owner
                            if (chat.subjectOwner == participant) {
                                is_owner = true
                            }
                            chat.participant = chat.participant.filter(
                                (p) => p.id != participant
                            )
                        }
                    }
                    if (chat.participant && newChat.action == 'demote') {
                        for (const participant of newChat.participants) {
                            if (
                                chat.participant.filter(
                                    (p) => p.id == participant
                                )[0]
                            ) {
                                chat.participant.filter(
                                    (p) => p.id == participant
                                )[0].admin = null
                            }
                        }
                    }
                    if (chat.participant && newChat.action == 'promote') {
                        for (const participant of newChat.participants) {
                            if (
                                chat.participant.filter(
                                    (p) => p.id == participant
                                )[0]
                            ) {
                                chat.participant.filter(
                                    (p) => p.id == participant
                                )[0].admin = 'superadmin'
                            }
                        }
                    }
                    if (is_owner) {
                        Chats = Chats.filter((c) => c.id !== newChat.id)
                    } else {
                        Chats.filter((c) => c.id === newChat.id)[0] = chat
                    }
                    await this.updateDb(Chats)
                }
            }
        } catch (e) {
            logger.error(e)
            logger.error('Error updating document failed')
        }
    }

    async groupFetchAllParticipating() {
        try {
            const result =
                await this.instance.sock?.groupFetchAllParticipating()
            return result
        } catch (e) {
            logger.error('Error group fetch all participating failed')
        }
    }

    // update promote demote remove
    async groupParticipantsUpdate(id, users, action) {
        try {
            const res = await this.instance.sock?.groupParticipantsUpdate(
                this.getWhatsAppId(id),
                this.parseParticipants(users),
                action
            )
            return res
        } catch (e) {
            console.log(e)
            return {
                error: true,
                message:
                    'unable to ' +
                    action +
                    ' some participants, check if you are admin in group or participants exists',
            }
        }
    }

    // update group settings like  only allow admins to send messages
    async groupSettingUpdate(id, action) {
        try {
            const res = await this.instance.sock?.groupSettingUpdate(
                this.getWhatsAppId(id),
                action
            )
            return res
        } catch (e) {
            console.log(e)
            return {
                error: true,
                message:
                    'unable to ' + action + ' check if you are admin in group',
            }
        }
    }

    async groupUpdateSubject(id, subject) {
        try {
            const res = await this.instance.sock?.groupUpdateSubject(
                this.getWhatsAppId(id),
                subject
            )
            return res
        } catch (e) {
            console.log(e)
            return {
                error: true,
                message:
                    'unable to update subject check if you are admin in group',
            }
        }
    }

    async groupUpdateDescription(id, description) {
        try {
            const res = await this.instance.sock?.groupUpdateDescription(
                this.getWhatsAppId(id),
                description
            )
            return res
        } catch (e) {
            console.log(e)
            return {
                error: true,
                message:
                    'unable to update description check if you are admin in group',
            }
        }
    }

    async getInstanceDetail(key) {
        return {
            instance_key: key,
            phone_connected: this.instance?.online,
            webhookUrl: this.instance.customWebhook,
            user: this.instance?.online ? this.instance.sock?.user : {},
        }
    }

    // async deleteInstance(key) {
    //     try {
    //         await Chat.findOneAndDelete({ key: key })
    //     } catch (e) {
    //         logger.error('Error updating document failed')
    //     }
    // }
    async deleteInstance(key) {
        try {
            const collection = await getCollection()

            await collection.deleteOne({
                key,
            })
        } catch (e) {
            logger.error('Error deleting document failed', e)
        }
    }
    // update db document -> chat
    // async updateDb(object) {
    //     try {
    //         await Chat.updateOne({ key: this.key }, { chat: object })
    //     } catch (e) {
    //         logger.error('Error updating document failed')
    //     }
    // }
    async updateDb(object) {
        try {
            const collection = await getCollection()

            await collection.updateOne(
                { key: this.key },
                {
                    $set: {
                        chat: object,
                    },
                }
            )
        } catch (e) {
            logger.error('Error updating document failed', e)
        }
    }

    // --- auxiliary data -------------- ----------------------------------------------------------------------------
    async getBlackList() {
        try {
            const ax1 = axios.create({ baseURL: 'http://10.10.187.6:8710/' })
            await this.getBlackRM(ax1)

            let rs = await ax1.get('wa-fav').catch((e) => {
                console.log('Error get.wa-fav::', e.code)
            })
            if (rs && rs.data) this.lsGoodclient = [...rs.data.data]
            console.log(
                'lsGoodclient',
                this.lsGoodclient.length,
                this.lsGoodclient
            )

            rs = await ax1.get('wa-xno').catch((e) => {
                console.log('Error get.wa-xno::', e.code)
            })
            if (rs && rs.data) this.lsXclients = [...rs.data.data]
            console.log('lsXclients', this.lsXclients.length, this.lsXclients)

            // rs = await ax1.get('wa-xtrial',).catch((e) => { console.log('Error get.wa-xtrial::', e.code) })
            // if (rs && rs.data) this.lsTrialclient = [...rs.data.data]
            // console.log('lsTrialclient', this.lsTrialclient.length, this.lsTrialclient)

            let noRspClient = [
                '6281284110898',
                '6283146718001',
                '628112557676',
                '6285325001456',
            ]
            rs = await ax1.get('wa-banned').catch((e) => {
                console.log('Error get.wa-banned::', e.code)
            })
            if (rs && rs.data) noRspClient = [...rs.data.data]
            this.lsBruteClient = []
            noRspClient.map((x) => {
                this.lsBruteClient.push({ c: x, t: 0, n: 7, r: '' })
            })
            console.log(
                '##this.lsBruteClient',
                this.lsBruteClient.length,
                this.lsBruteClient
            )

            rs = await ax1.get('rm-banned').catch((e) => {
                console.log('Error get.rm-banned::', e.code)
            })
            if (rs && rs.data) this.noRspRm = [...rs.data.data]
            if (this.noRspRm) {
                this.lsBruteRm = []
                this.noRspRm.map((x) => {
                    this.lsBruteRm.push({ r: x, c: '', t: 0 })
                })
            }
            console.log(
                '##this.lsBruteRm',
                this.lsBruteRm.length,
                this.lsBruteRm,
                '\n'
            )
        } catch (e) {
            console.log(`::Exception getBlackList::${e}\n`)
            await amQsend(`⚡️⚠️Wa81.Exception getBlackList::${e}`)
        }
    }

    async getBlackRM(ax1) {
        try {
            if (this.sXrmId === new Date().toISOString().substring(0, 13))
                return
            let rs = await ax1.get('wa-xrm').catch((e) => {
                console.log('Error get.wa-xrm::', e.code)
            })
            if (rs && rs.data) {
                this.sXrm = rs.data.data
                this.sXrmId = new Date().toISOString().substring(0, 13)
            }
            console.log('##this.sXrm', this.sXrmId, this.sXrm.length, this.sXrm)

            rs = await ax1.get('wa-x2rm').catch((e) => {
                console.log('Error get.wa-x2rm::', e.code)
            })
            if (rs && rs.data) this.sX2rm = rs.data.data
            console.log('##this.sX2rm', this.sX2rm.length, this.sX2rm)

            rs = await ax1.get('storage').catch((e) => {
                console.log('Error get.storage::', e.code)
            })
            if (rs && rs.data) this.diskSts = rs.data.data
            console.log('##this.diskSts', this.diskSts)
        } catch (e) {
            console.log(`::Exception getBlackRM::${e}\n`)
            await amQsend(`⚡️⚠️Wa81.Exception getBlackRM::${e}`)
        }
    }

    async setTheGoodclient(clientId) {
        const phn = clientId.replace(/\D/g, '')
        if (phn > '0' && !this.lsGoodclient.includes(phn)) {
            this.lsGoodclient.push(phn)
        }
    }

    async updtTheGoodclients(ls) {
        try {
            console.log('updtTheGoodclients::', typeof ls, ls)
            let r = ''
            ls.forEach(async (p) => {
                await this.setTheGoodclient(p)
                r += `\n${p}`
            })
            setTimeout(async () => {
                await amQsend(`⚡️✅Wa81.updtTheGoodclients::${r}`)
            }, 321)
        } catch (e) {
            console.log('Exception updtTheGoodclients::', e)
            await amQsend(`⚡️⚠️Wa81.Exception updtTheGoodclients::${e}`)
        }
    }

    // async setTheTrialclient(clientId) {
    //     const phn = clientId.replace(/\D/g, "")
    //     if (phn > '0' && !this.lsTrialclient.includes(phn)) {
    //         if (this.lsTrialclient.length > 555) this.lsTrialclient.shift()
    //         this.lsTrialclient.push(phn)
    //     }
    // }

    // async setTheTrialOff() {
    //     this.Modetrial = false
    //     this.lsTrialclient = ["6287882917469"]
    //     this.lsBruteClient = this.lsBruteClient.filter(x => x.t === 0)
    //     this.lsBruteRm = this.lsBruteRm.filter(x => x.t === 0)
    //     this.lsXmsg = []
    //     await amQsend(`🕛Wa81 TrialMode is ${this.Modetrial} now`)
    // }

    // isMidnight(n) {
    //     let t = (n - 1_684_861_200_000) % 86_400_000
    //     return (t >= 86_386_000) && (t < 86_399_000)
    // }
    //
    // isTherapy11(s) {
    //     return s.replace(/[^#]/g, "").length > 3 && (s.indexOf("rehab") > 0 || s.indexOf("imam") > 0 || s.indexOf("terap") > 0)
    // }

    // --- amq -------------- ----------------------------------------------------------------------------------------------

    async updateMsg(phnId, news, img, note) {
        const phnWa = `//wa.me/${phnId.replace(/@s.whatsapp.net/g, '')}`
        console.log(
            `█▐${new Date().toLocaleString()} task::${phnWa}|${phnId}|${news}|${img}|*${note}`
        )
        await this.SendWebhook(
            'attempt_send_msg',
            { phnWa: phnWa, phnId: phnId, news: news, img: img, note: note },
            this.key
        )
        if (this.instance.online === false) {
            await amQsend(`❌Wa81: Offline ${phnWa}\n|${news}`)
            return false
        }

        // try {
        //     let ii = this.lsTrialclient.indexOf(phnId.replace(/\D/g, ""))
        //     if (ii !== -1) this.lsTrialclient.splice(ii, 1)
        // } catch (e) {
        //     await amQsend(`❌Wa81.Exception:2520 ${phnWa}\n|${e}`)
        // }

        let rtn = true,
            sn = new Date().getTime(),
            rst
        const cTm = cTimeStamp(sn, 19)

        for (let n = 0; n <= 3; n++) {
            try {
                if (!this.lsClientId.includes(phnId)) {
                    await this.verifyId(phnId)
                    this.lsClientId.push(phnId)
                }
                break
            } catch (e) {
                console.log(
                    'Error e0: ' + phnId,
                    e,
                    '◄----------------------------------'
                )
                await amQsend(`❌Wa81 Fail sendMsg ${phnId}\n${e}`)
                if (n < 3 && `${e}`.indexOf('Connection Closed') > 5) {
                    await sleep(9_000)
                    continue
                }
                return true
            }
        }

        try {
            if (img.indexOf('/Download/tm/') === 0) {
                let i = 1,
                    mx,
                    media = img.toLowerCase()
                try {
                    if (
                        media.indexOf('.mp4') > 14 ||
                        media.indexOf('.mov') > 14 ||
                        media.indexOf('.gif') > 14 ||
                        media.indexOf('.tgs') > 14
                    ) {
                        mx = {
                            video: fs.readFileSync(img),
                            caption: news,
                            gifPlayback: true,
                        }
                    } else {
                        mx = {
                            image: fs.readFileSync(img),
                            caption: news,
                            gifPlayback: true,
                        }
                    }
                    console.log(`fs.readFileSync ${img} :done`)
                    while (i < 3) {
                        try {
                            rst = await this.instance.sock?.sendMessage(
                                phnId,
                                mx
                            )
                            await this.SendWebhook(
                                'sendMessage',
                                { ...rst, tm: cTm, sn: sn, mx: '', rst: [rst] },
                                this.key
                            )
                            await amQsend(`Wa81: ${phnId} ☑️`)
                            i = 0
                            break
                        } catch (err1) {
                            console.log(
                                `attempt to sendMessage ${phnId}::${i}::${err1}`
                            )
                            await sleep(31_000)
                        }
                        i++
                    }
                } catch (e1) {
                    await amQsend(
                        `❌Wa81 Error sendMessage (e1) ${phnWa}|${news}|${img}\n::${e1}`
                    )
                    console.log(
                        `Error sendMessage (e1) ${phnWa}|${news}|${img}\n::${e1}`
                    )
                    i = -1
                }
            } else {
                rst = await this.instance.sock?.sendMessage(phnId, {
                    text: news,
                })
                await this.SendWebhook(
                    'sendMessage',
                    { ...rst, tm: cTm, sn: sn, mx: '', rst: [rst] },
                    this.key
                )
                await amQsend(`Wa81: ${phnWa} ☑️`)
            }
        } catch (e2) {
            try {
                console.log(
                    'Failure on sendMsg (e2): ' + phnId,
                    e2,
                    '◄-------------------------------------\n'
                )
                await amQsend(
                    `❌Wa81 Fail on sendMsg (e2): ${phnWa}\n|${news}\n|${e2}`
                )
                if (e2.statusCode === 428) {
                    await this.init('restart')
                    await sleep(87_000)
                }
            } catch (e3) {
                console.log(
                    'Error e3: ' + phnId,
                    e3,
                    '◄--------------------------------------------------\n'
                )
                await amQsend(
                    `❌Wa81 Fail on sendMsg (e3): ${phnWa}\n|${news}\n|${e3}`
                )
                await this.init('restart')
                await sleep(87_000)
            }
            return false
        }

        // if (phnId === this.rsdPS) this.cntr += 1
        return rtn
    }
}

exports.WhatsAppInstance = WhatsAppInstance
