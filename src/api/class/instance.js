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
const Chat = require('../models/chat.model')
const axios = require('axios')
const config = require('../../config/config')
const downloadMessage = require('../helper/downloadMsg')
const logger = require('pino')()
const useMongoDBAuthState = require('../helper/mongoAuthState')
const fs = require('fs')
const fsp = require('fs').promises
const amQsend = require('../helper/amQsend')
const tm_notif1 = require('../helper/mqTmNotif1')
const validPhnNumber = require('../helper/validPhnNumber')

class WhatsAppInstance {
    socketConfig = {
        defaultQueryTimeoutMs: undefined,
        printQRInTerminal: false,
        logger: pino({
            level: config.log.level,
        }),
    }
    key = ''
    authState
    allowWebhook = undefined
    webhook = undefined
    xConnState = true
    nTryReCon = 0
    ID_rsdPS = '6281904000707@s.whatsapp.net'
    ID_rsdPS_lid = '169874680737794@lid'
    ID_rsdGw = '6289510778377@s.whatsapp.net'
    // ID_yh = "628121549688@s.whatsapp.net"
    ID_yh = '6285172020817@s.whatsapp.net'
    // ID_yh = "168930190569626@lid"
    ID_restu = '6285172020817@s.whatsapp.net'
    lsMuteResp = ['6281904000707', '628999800123']
    lsUnreadChats = []
    lsUnrespMsg = []
    rsdPSlastResp = 0
    cUnrespMsg = ''
    lastUrC = ''
    PING81 = true
    p1_busy = false
    p2busy = false
    t2busy = 0
    r2Time = 0
    m81_cntr = 0
    cnt01 = 0
    last_rsp = new Date()
    last_req = new Date()
    last_bc = new Date()
    testRead = true

    instance = {
        key: this.key,
        chats: [],
        qr: '',
        messages: [],
        qrRetry: 0,
        customWebhook: '',
    }

    axiosInstance = axios.create({
        baseURL: config.webhookUrl,
    })

    constructor(key, allowWebhook, webhook) {
        // this.key = key ? key : uuidv4()
        this.key = key ? key : 'wa-187-gw'
        this.instance.customWebhook = this.webhook ? this.webhook : webhook
        this.allowWebhook = config.webhookEnabled
            ? config.webhookEnabled
            : allowWebhook
        if (this.allowWebhook && this.instance.customWebhook !== null) {
            this.allowWebhook = true
            this.instance.customWebhook = webhook
            this.axiosInstance = axios.create({ baseURL: webhook })
        }
    }

    async SendWebhook(type, body, key) {
        if (!this.allowWebhook) return
        setTimeout(async () => {
            await this.axiosInstance
                .post('', { type, body, instanceKey: key })
                .catch(() => {})
        }, 88)
    }

    async init() {
        this.collection = mongoClient.db('whatsapp-api').collection(this.key)
        // const { state, saveCreds } = await useMongoDBAuthState(this.collection)
        const { state, saveCreds } = await useMultiFileAuthState(
            './session' + this.key
        )
        this.authState = { state: state, saveCreds: saveCreds }
        this.socketConfig.auth = this.authState.state
        this.socketConfig.browser = Object.values(config.browser)
        this.instance.sock = makeWASocket(this.socketConfig)
        this.setHandler()
        console.log(`Init WhatsAppInstance ☑️`)
        await amQsend(`⚡️ WaGw: Init WhatsAppInstance ☑️`)
        return this
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
                `${new Date().toLocaleString()} connection state : ${connection} || xsts:${
                    lastDisconnect?.error?.output
                }`
            )
            await this.SendWebhook(
                'connection',
                {
                    messageType: `conn.status`,
                    message: {
                        conversation: `${new Date().toLocaleString()} ::connection:${connection} #${
                            this.cnt01
                        }|| ${JSON.stringify(
                            lastDisconnect?.error?.output?.payload
                        )}`,
                    },
                },
                this.key
            )

            if (connection === 'connecting') return

            if (connection === 'close') {
                this.instance.online = false
                console.log(
                    'connection closed::',
                    lastDisconnect?.error?.output
                )
                if (
                    lastDisconnect?.error?.output?.payload.message.includes(
                        'restart required'
                    )
                ) {
                    logger.info('STATE: Connection restart required')
                    logger.info(lastDisconnect?.error?.output)
                    process.exit(-1)
                }
                if (
                    lastDisconnect?.error?.output?.statusCode !==
                    DisconnectReason.loggedOut
                ) {
                    // reconnect if not logged out
                    this.cnt01++
                    let mx = `⚡️⛑WaGw disconnected #${
                        this.cnt01
                    }\n${JSON.stringify(
                        lastDisconnect?.error?.output?.payload
                    )}`
                    await amQsend(mx)
                    if (this.cnt01 === 2) {
                        this.xConnState = false
                        tm_notif1(mx, this.ID_rsdGw)
                    }
                    if (/Method Not Allowed/is.test(mx) && this.cnt01 > 2) {
                        await sleep(600_000)
                    }
                    if (
                        /restart required|stream errored|440/is.test(mx) ||
                        this.cnt01 > 19
                    ) {
                        await sleep(33_000)
                        process.exit(-1)
                    }
                    await sleep(33_000)
                    setTimeout(async () => {
                        await this.init()
                    }, 651)
                } else {
                    logger.info('STATE: Connection loggedOut')
                    logger.info(lastDisconnect?.error?.output)
                    let mx = `🔴 WaGw loggedOut\n${JSON.stringify(
                        lastDisconnect?.error?.output?.payload
                    )}`
                    await amQsend(`🔴${mx}`)
                    if (this.nTryReCon < 5) {
                        this.nTryReCon++
                        await sleep(90_000 * this.nTryReCon)
                        await this.init()
                    }
                    await this.collection.drop().then((r) => {
                        logger.info('STATE: Droped collection')
                        logger.info(
                            'STATE: Connection status is Droped & loggedOut'
                        )
                        tm_notif1(mx, this.ID_rsdGw)
                        this.xConnState = false
                    })
                }

                if (
                    [
                        'all',
                        'connection',
                        'connection.update',
                        'connection:close',
                    ].some((e) => config.webhookAllowedEvents.includes(e))
                )
                    await this.SendWebhook(
                        'connection',
                        { connection: connection },
                        this.key
                    )
            } else if (connection === 'open') {
                this.nTryReCon = 0
                console.log('connection is now open')
                if (config.mongoose.enabled) {
                    let alreadyThere = await Chat.findOne({
                        key: this.key,
                    }).exec()
                    if (!alreadyThere) {
                        const saveChat = new Chat({ key: this.key })
                        await saveChat.save()
                    }
                }
                this.instance.online = true
                this.cnt01 = 0
                if (
                    [
                        'all',
                        'connection',
                        'connection.update',
                        'connection:open',
                    ].some((e) => config.webhookAllowedEvents.includes(e))
                )
                    await this.SendWebhook(
                        'connection',
                        { connection: connection },
                        this.key
                    )
                await amQsend('🟢WaGw connection up')
                // if (nStat < 0) tm_notif1('🟢WaGw connection up', this.ID_rsdGw)
                if (!this.xConnState) {
                    this.xConnState = true
                    console.log('🟢WAGw is now Online')
                    // await amQsend('🟢WAGw is now Online', 'group')
                    tm_notif1('🟢WaGw connection up', this.ID_rsdGw)
                    await amQsend('🟢WaGw restart app...')
                    await sleep(1_579)
                    process.exit(1)
                }
                await this.chkTheWA81('Assalamualaikum🙏🏻')
                console.log('\n')

                // test --------------------------------------------------------------------------------------------
                if (this.testRead === true) {
                    this.testRead = false
                    // console.log('--> test blocking <---')
                    // setTimeout(async () => {
                    //     // let x = await sock.updateBlockStatus("628121549688@s.whatsapp.net", "block") // Block user
                    //     let x = await sock.updateBlockStatus("628121549688@s.whatsapp.net", "unblock") // Unblock user
                    //     console.log('--> test updateBlockStatus :::', x)
                    // }, 888)
                }
            }

            if (connection === 'undefined' && this.instance.online) {
                await this.chkTheWA81('cek')
                return
            }

            if (qr) {
                console.log(`doing QR  @${connection}`)
                await amQsend('🔘WaGw requesting QRcode!')
                QRCode.toDataURL(qr).then((url) => {
                    this.instance.qr = url
                    this.xConnState = false
                    this.instance.qrRetry++
                    if (this.instance.qrRetry >= config.instance.maxRetryQr) {
                        // close WebSocket connection
                        this.instance.sock.ws.close()
                        // remove all events
                        this.instance.sock.ev.removeAllListeners()
                        this.instance.qr = ''
                        logger.info('socket connection terminated')
                    }
                })
            }
        })

        // on new mssage
        sock?.ev.on('messages.upsert', async (m) => {
            // const _mx = m.messages[0]
            // if (_mx.key.remoteJid === "status@broadcast" || _mx.key.remoteJid.indexOf('@g.us') > 0) {
            //     return
            // }

            // if (this.PING81 && this.m81_cntr > 1) {
            //     await this.pingWa81()
            // }

            if (m.type === 'prepend')
                this.instance.messages.unshift(...m.messages)
            if (m.type !== 'notify' && m.type !== 'append') {
                console.log(
                    `${new Date().toLocaleString()} Exclude messages.upsert: ${m}`
                )
                await this.SendWebhook(`excl-messages ${m.type}`, m, this.key)
                return
            }

            this.instance.messages.unshift(...m.messages)

            m.messages.map(async (msg) => {
                let clientId = msg.key.remoteJid
                if (msg.key.remoteJid === 'status@broadcast') return
                if (msg.key.remoteJid.indexOf('@g.us') > 0) return

                if (msg.key.remoteJid.includes('s.whatsapp.net'))
                    clientId = msg.key.remoteJid
                else if (msg.key.remoteJidAlt?.includes('s.whatsapp.net'))
                    clientId = msg.key.remoteJidAlt
                else if (msg.key.participant?.includes('s.whatsapp.net'))
                    clientId = msg.key.participant
                else if (msg.key.participantAlt?.includes('s.whatsapp.net'))
                    clientId = msg.key.participantAlt

                // console.log('msg ::=> ', msg)
                console.log('Number/clientId ::=> ', clientId)
                if (
                    clientId === 'status@broadcast' ||
                    msg.key.fromMe ||
                    !msg.message
                ) {
                    if (!msg.key.fromMe && this.PING81)
                        setTimeout(async () => {
                            await this.pingWa81()
                        }, 0)
                    return
                }

                let messageType = Object.keys(msg.message)[0]
                if (
                    [
                        'protocolMessage',
                        'senderKeyDistributionMessage',
                    ].includes(messageType)
                )
                    return

                let mx = '',
                    buffer = '',
                    cFile = '',
                    xErr1 = '',
                    xErr2 = ''

                try {
                    if (messageType === 'messageContextInfo') {
                        messageType = Object.keys(msg.message)[1]
                    }
                } catch (e) {
                    xErr1 = `Err-messageContextInfo ${e}`
                    console.log(xErr1)
                    await amQsend(`⚡️WaGw ${xErr1}`)
                }

                const webhookData = { key: this.key, ...msg }

                if (messageType === 'conversation') {
                    webhookData['text'] = m
                }

                try {
                    mx = `(${msg.pushName}: ${clientId})`
                    if (msg.message.hasOwnProperty('conversation')) {
                        mx = msg.message.conversation + '\n' + mx
                        webhookData['messageText'] = mx
                    }
                } catch (e) {
                    xErr1 = `Err-conversation ${e}`
                    console.log(
                        `🗒️ERROR-225 ↑↑↑ message.conversation error: ${e}\n`
                    )
                    await amQsend(`⚡️WaGw ${xErr1}`)
                }

                webhookData['messageType'] = messageType
                webhookData['msgContent'] = ''
                const downloadDir = path.join(__dirname, 'Download')
                try {
                    switch (messageType) {
                        case 'extendedTextMessage':
                            mx =
                                msg.message.extendedTextMessage.text + '\n' + mx
                            webhookData['messageText'] = mx
                            break
                        case 'highlyStructuredMessage':
                            const hsm =
                                msg.message.highlyStructuredMessage.hydratedHsm
                                    .hydratedTemplate
                            mx = hsm.hydratedContentText + '\n' + mx
                            webhookData['messageText'] = mx
                            break
                        case 'stickerMessage':
                            buffer = await downloadMessage(
                                msg.message.stickerMessage,
                                'image',
                                1
                            )
                            cFile = '/Download/wa-' + msg.key.id + '.webp'
                            await fsp.writeFile(cFile, buffer)
                            webhookData['fileContent'] = cFile
                            console.log(`The ${messageType} saved as ${cFile}`)
                            break
                        case 'reactionMessage':
                            mx = `reactionMessage: ${msg.message.reactionMessage.text}\n${mx}`
                            setTimeout(async () => {
                                await this.reactMessage(
                                    clientId,
                                    msg.message.reactionMessage.key,
                                    '🙏🏻'
                                )
                            }, 1)
                            break
                        case 'editedMessage':
                            try {
                                let mse =
                                    msg.message.editedMessage.message
                                        .protocolMessage.editedMessage
                                if (mse.hasOwnProperty('imageMessage'))
                                    mx = mse.imageMessage.caption + '\n' + mx
                                else if (mse.hasOwnProperty('videoMessage'))
                                    mx = mse.videoMessage.caption + '\n' + mx
                                else mx = mse.conversation + '\n' + mx
                            } catch (e1) {
                                let err_e = 'Error caption@editedMessage: ' + e1
                                console.log(err_e)
                                try {
                                    mx =
                                        msg.message.editedMessage.message
                                            .protocolMessage.editedMessage
                                            .conversation +
                                        '\n' +
                                        mx
                                    err_e = ''
                                } catch (e2) {
                                    err_e =
                                        'Error conversation@editedMessage: ' +
                                        e2
                                    console.log(
                                        'Error conversation@editedMessage: ' +
                                            err_e
                                    )
                                }
                                if (err_e > ' ')
                                    await amQsend(
                                        `🤔WaGw:: Error ${messageType}\n${clientId}\n:\n${err_e}\n${JSON.stringify(
                                            msg
                                        )}`
                                    )
                            }
                            break
                        case 'imageMessage':
                            buffer = await downloadMessage(
                                msg.message.imageMessage,
                                'image',
                                1
                            )
                            if (buffer) {
                                // cFile = path.join(
                                //     downloadDir,
                                //     `wa-${msg.key.id}.jpeg`
                                // )
                                // cFile = '/Download/wa-' + msg.key.id + '.jpeg'
                                cFile =
                                    'downloadDir' +
                                    '/Download/wa-' +
                                    msg.key.id +
                                    '.jpeg'
                                await fsp.mkdir(downloadDir, {
                                    recursive: true,
                                })
                                await fsp.writeFile(cFile, buffer)
                                webhookData['fileContent'] = cFile
                                try {
                                    mx =
                                        msg.message.imageMessage.caption +
                                        '\n' +
                                        mx
                                } catch (e1) {
                                    console.log(
                                        'Error caption@imageMessage: ' + e1
                                    )
                                }
                                webhookData['messageText'] = mx
                                console.log(
                                    `The ${messageType} saved as ${cFile}`
                                )
                            } else {
                                console.log(
                                    `FAIL downloadMessage ${messageType} xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
                                )
                                console.log(JSON.stringify(msg))
                                await amQsend(
                                    `🤔WaGw::\nFAIL downloadMessage ${messageType}\n${clientId}\n:\n${JSON.stringify(
                                        msg
                                    )}`
                                )
                            }
                            break
                        case 'videoMessage':
                            buffer = await downloadMessage(
                                msg.message.videoMessage,
                                'video',
                                1
                            )
                            if (buffer) {
                                cFile = './Download/wa-' + msg.key.id + '.mp4'
                                await fsp.writeFile(cFile, buffer)
                                webhookData['fileContent'] = cFile
                                try {
                                    mx =
                                        msg.message.videoMessage.caption +
                                        '\n' +
                                        mx
                                } catch (e1) {
                                    console.log(
                                        'Error caption@videoMessage' + e1
                                    )
                                }
                                webhookData['messageText'] = mx
                                console.log(
                                    `The ${messageType} saved as ${cFile}`
                                )
                            } else {
                                console.log(
                                    `FAIL downloadMessage ${messageType} xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
                                )
                                console.log(JSON.stringify(msg))
                                await amQsend(
                                    `🤔WaGw::\nFAIL downloadMessage ${messageType}\n${clientId}\n:\n${JSON.stringify(
                                        msg
                                    )}`
                                )
                            }
                            break
                        case 'audioMessage':
                            buffer = await downloadMessage(
                                msg.message.audioMessage,
                                'audio',
                                1
                            )
                            cFile = '/Download/wa-' + msg.key.id + '.mp3'
                            await fsp.writeFile(cFile, buffer)
                            webhookData['fileContent'] = cFile
                            console.log(`The ${messageType} saved as ${cFile}`)
                            break
                        case 'documentMessage':
                            buffer = await downloadMessage(
                                msg.message.documentMessage,
                                'document',
                                1
                            )
                            let fnm = `-${new Date().getTime()}.x`
                            try {
                                fnm = msg.message.documentMessage.fileName
                            } catch (e1) {
                                console.log(
                                    'Error get fileName documentMessage: ' + e1
                                )
                            }
                            cFile = '/Download/wa-' + msg.key.id + fnm
                            await fsp.writeFile(cFile, buffer)
                            mx = 'documentMessage ' + fnm + '\n' + mx
                            webhookData['fileContent'] = cFile
                            console.log(`The ${messageType} saved as ${cFile}`)
                            break
                        case 'listMessage':
                            mx = ''
                            break
                        default:
                            if (messageType !== 'conversation') {
                                console.log('Unknown process to ' + messageType)
                                await amQsend(
                                    `⚡️WaGw unHandle::${messageType}\n${JSON.stringify(
                                        msg
                                    )}`
                                )
                            }
                            break
                    }
                } catch (er2) {
                    xErr2 = `Err-${messageType}: ${er2}`
                    mx += `\nError get ${messageType} !\n${er2}`
                    console.log(xErr2, mx)
                }

                try {
                    if (
                        clientId !== this.ID_rsdPS &&
                        clientId !== this.ID_rsdPS_lid &&
                        clientId !== this.ID_yh &&
                        clientId !== this.ID_restu
                    ) {
                        if (
                            this.lsMuteResp.includes(
                                clientId.replace(/\D/g, '')
                            )
                        )
                            await amQsend(
                                `🧐WaGw::\n${mx}\n${cFile}\n${clientId}`
                            )
                        else if (
                            mx.replace(/[^#]/g, '').length < 3 &&
                            xErr2 === ''
                        )
                            await tm_notif1(mx, clientId, cFile)
                        //// selalu masuk sini Chat WA Hotline
                        else
                            await amQsend(
                                `🤔WaGw::\n${mx}\n${cFile}\n${clientId}`
                            )
                    } else {
                        if (this.m81_cntr > 0) this.m81_cntr--
                        this.last_rsp = new Date()
                        await amQsend(`⚡️Rx from Wa81:\n${mx}`)
                        console.log(`::${mx}_________`)
                        if (
                            mx
                                .replace(/^(\s|\u00A0)+|(\s|\u00A0)+$/g, '')
                                .substring(0, 8) === '/svc.rst'
                        ) {
                            // await amQsend(`⚠️WaGw Attempt to Restart`)
                            console.log(
                                `\n${new Date().toLocaleString()} RESTARTING SEVICE_____________________________________________\n`
                            )
                            // setTimeout(async () => {
                            //     process.exit(1)
                            // }, 321)
                        }
                    }
                } catch (e) {
                    console.log(`Error mQ: ${e}`)
                    await amQsend(`⚡️WaGw Error mQ:\n${mx}\n${e}`)
                }

                // if (!config.markMessagesRead) {
                await this.readMessage({
                    remoteJid: clientId,
                    id: msg.key.id,
                    participant: msg.key?.participant,
                })
                // }

                if (
                    ['all', 'messages', 'messages.upsert'].some((e) =>
                        config.webhookAllowedEvents.includes(e)
                    )
                )
                    await this.SendWebhook('message', webhookData, this.key)

                // if (clientId === this.ID_rsdPS) return
                if (this.lsMuteResp.includes(clientId.replace(/\D/g, '')))
                    return

                try {
                    const ntag = mx.replace(/[^#]/g, '').length
                    if (
                        mx.indexOf('#') >= 0 &&
                        (ntag > 2 || mx.indexOf('#') < 33)
                    ) {
                        if (xErr1 !== '' && xErr2 !== '')
                            await this.sendTextMessage(
                                clientId,
                                'Maaf pesan tidak terbaca, mohon diulang🙏🏻',
                                true
                            )
                        else if (
                            ntag > 2 &&
                            mx.toLowerCase().indexOf('daftar') >= 0
                        )
                            await this.sendTextMessage(
                                clientId,
                                '🙏🏻Untuk daftar-online,\nsilakan ke WA: 0819 0400 0707\nhttps://wa.me/6281904000707',
                                true
                            )
                        else
                            await this.sendTextMessage(
                                clientId,
                                '🙏🏻Pesan akan diteruskan ke SIMRS',
                                true
                            )
                    } else if (xErr1 === '' && xErr2 === '') {
                        // await sock.sendTextMessage(clientId, '🙂🙏🏻', true)
                        await sock.sendMessage(
                            clientId, // tujuan: otomatis @s.whatsapp.net atau @lid
                            { text: '🙂🙏🏻' }
                        )
                        return 0
                        if (clientId === this.ID_yh) {
                            console.log(r)
                            setTimeout(async () => {
                                // await amQsend(`⚡️WaGw:\n${JSON.stringify(r)}`)
                                // await this.hapusMessageFme(r.key.remoteJid, r.key.id, false, r.messageTimestamp)
                                await sock.sendMessage(clientId, {
                                    delete: r.key,
                                })
                            }, 60_123)
                        }
                    }
                } catch (e) {
                    console.log('Error auto-response: ' + e)
                    await amQsend(`⚡️WaGw Error auto-response:\n${mx}\n${e}`)
                }
            })
        })

        sock?.ev.on('messages.update', async (messages) => {
            var err = '',
                rsps = -1,
                nrc = 0
            messages.map(async (m) => {
                try {
                    if (m.key.fromMe) {
                        // ---watching wa81 activity---
                        if (m.key.remoteJid === this.ID_rsdPS) {
                            rsps = m.update.status ?? 0
                        }
                    } else {
                        // ---get incoming-msg status---
                        if (m.update.status > 3) {
                            this.lsUnrespMsg = this.lsUnrespMsg.filter(
                                (v) => v !== m.key.remoteJid
                            )
                            nrc++
                        } else if (
                            !this.lsUnrespMsg.includes(m.key.remoteJid) &&
                            !m.update.key
                        ) {
                            this.lsUnrespMsg.push(m.key.remoteJid)
                            nrc++
                        } else if (m.update.key) {
                            this.cUnrespMsg = '#'
                            nrc++
                        }
                    }
                } catch (e) {
                    console.log('\nException @messages.update:', e)
                    err += `\n${e}`
                }
            })

            if (nrc) {
                this.r2Time = new Date().getTime()
                setTimeout(() => {
                    this.infoUnrespM()
                }, 3333)
            }
            if (err > '')
                await amQsend(`🤔WaGw Exception @messages.update:${err}`)
            if (rsps >= 0 && this.rsdPSlastResp !== rsps) {
                this.rsdPSlastResp = rsps
                await amQsend(
                    `WaGw: WA-81 status is ${rsps === 4 ? 'Ok.' : '?pending'}`
                )
            }
        })

        // sending presence
        // sock?.ev.on('presence.update', async (json) => {
        //     if (['all', 'presence', 'presence.update'].some((e) => config.webhookAllowedEvents.includes(e)))
        //         await this.SendWebhook('presence', json, this.key)
        // })

        // on receive all chats
        sock?.ev.on('chats.set', async ({ chats }) => {
            this.instance.chats = []
            const recivedChats = chats.map((chat) => {
                return { ...chat, messages: [] }
            })
            this.instance.chats.push(...recivedChats)
            await this.updateDb(this.instance.chats)
            await this.updateDbGroupsParticipants()
            await this.SendWebhook('chats.set', chats, this.key)
        })

        // on recive new chat
        sock?.ev.on('chats.upsert', async (newChat) => {
            await this.SendWebhook('chats.upsert', newChat, this.key)
            const chats = newChat.map((chat) => {
                return { ...chat, messages: [] }
            })
            this.instance.chats.push(...chats)
        })

        // on chat change
        sock?.ev.on('chats.update', async (changedChat) => {
            // await this.SendWebhook('chats.update', changedChat, this.key)
            changedChat.map(async (chat) => {
                let id = chat.id

                let text = ''
                const lastMsg = chat.messages?.[0]
                const msg = lastMsg?.message?.message
                text = this.getText(lastMsg?.message?.message)
                if (
                    lastMsg?.message?.key?.remoteJid?.includes('s.whatsapp.net')
                ) {
                    id = lastMsg.message.key.remoteJid
                } else if (
                    lastMsg?.message?.key?.remoteJidAlt?.includes(
                        's.whatsapp.net'
                    )
                ) {
                    id = lastMsg.message.key.remoteJidAlt
                }
                if (id === this.ID_rsdPS || id === 'status@broadcast') return

                console.log(
                    '============================= chats.update ==================================='
                )
                console.log('ID/Number :', id)
                console.log('Message   :', text)
                console.log('Data      :', JSON.stringify(chat, null, 2))
                console.log(new Date())

                if (id === 'status@broadcast') return
                const index = this.instance.chats.findIndex(
                    (pc) => pc.id === id
                )
                const PrevChat = this.instance.chats[index]
                this.instance.chats[index] = { ...PrevChat, ...chat }
                try {
                    if (chat.unreadCount > 0) {
                        if (this.lsUnreadChats.includes(id)) {
                            await amQsend(`⚡️⚠️WaGw unreadC*: ${id}`)
                            await this.SendWebhook(
                                'chats.update:unreadCount',
                                this.lsUnreadChats,
                                this.key
                            )
                            this.lastUrC += '*'
                        } else {
                            if (this.lsUnreadChats.length > 0) {
                                setTimeout(async () => {
                                    this.infoUnreadC()
                                }, 8000)
                            }
                            if (id !== this.ID_rsdPS)
                                this.lsUnreadChats.push(id)
                        }
                    } else {
                        this.lsUnreadChats = this.lsUnreadChats.filter(
                            (v) => v !== id
                        )
                        if (
                            this.lsUnreadChats.length < 1 &&
                            this.lastUrC.length > 1
                        ) {
                            this.lastUrC = ''
                            this.p1_busy = false
                            await amQsend(`⚡️☕️WaGw unreadC is Empty`)
                        }
                    }
                } catch (e) {
                    console.log('\n\n::::ERROR chats.update', e)
                }
            })
        })

        // on chat delete
        sock?.ev.on('chats.delete', async (deletedChats) => {
            await this.SendWebhook('chats.delete', deletedChats, this.key)
            deletedChats.map((chat) => {
                const index = this.instance.chats.findIndex(
                    (c) => c.id === chat
                )
                this.instance.chats.splice(index, 1)
                this.lsUnreadChats = this.lsUnreadChats.filter(
                    (v) => v !== chat
                )
            })
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

        sock?.ws.on('CB:call', async (data) => {
            if (data.content) {
                if (data.content.find((e) => e.tag === 'offer')) {
                    const content = data.content.find((e) => e.tag === 'offer')
                    if (
                        ['all', 'call', 'CB:call', 'call:offer'].some((e) =>
                            config.webhookAllowedEvents.includes(e)
                        )
                    )
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
                    this.sendTextMessage(
                        data.attrs.from,
                        'Maaf tidak dapat menerima tlp🙏🏻',
                        true
                    )
                } else if (data.content.find((e) => e.tag === 'terminate')) {
                    const content = data.content.find(
                        (e) => e.tag === 'terminate'
                    )
                    if (
                        ['all', 'call', 'call:terminate'].some((e) =>
                            config.webhookAllowedEvents.includes(e)
                        )
                    )
                        await this.SendWebhook(
                            'call_terminate',
                            {
                                id: content.attrs['call-id'],
                                user: {
                                    id: data.attrs.from,
                                },
                                timestamp: parseInt(data.attrs.t),
                                reason: data.content[0].attrs.reason,
                            },
                            this.key
                        )
                    this.sendTextMessage(
                        data.attrs.from,
                        'Maaf tidak dapat menerima tlp🙏🏻',
                        true
                    )
                }
            }
        })
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

    async infoUnrespM() {
        let ii = 1_000
        console.log(
            `:: infoUnresp() start :: ${this.p2busy}|${this.t2busy} < ${this.r2Time}`
        )
        while (this.p2busy && ii) {
            if (this.t2busy >= this.r2Time) return
            await sleep(3)
            ii--
        }
        if (this.p2busy) {
            console.log(`:: infoUnresp() abort!`)
            return
        }
        if (this.t2busy >= this.r2Time) {
            console.log(`:: infoUnresp() skip..`)
            return
        }
        this.p2busy = true
        this.t2busy = this.r2Time
        await new Promise(async (resolve) => {
            if (this.lsUnrespMsg.length > 0) {
                const cl = this.lsUnrespMsg
                    .join('\n: ')
                    .replace(/@s.whatsapp.net/g, '')
                if (cl !== this.cUnrespMsg) {
                    this.cUnrespMsg = cl
                    await amQsend(
                        `💡WaGw has UnrespMsg #${this.lsUnrespMsg.length}:\n${cl}`
                    )
                }
            } else {
                if (this.cUnrespMsg !== '') {
                    this.cUnrespMsg = ''
                    await amQsend(`💡WaGw UnrespMsg is empty`)
                }
            }
            resolve(false)
        })
        this.p2busy = false
    }

    async infoUnreadC() {
        if (this.p1_busy) return
        this.p1_busy = true
        if (this.lsUnreadChats.length > 0) {
            const cl = this.lsUnreadChats.join('\n: ')
            if (cl !== this.lastUrC) {
                this.lastUrC = cl
                await amQsend(
                    `⚡️WaGw unreadC #${this.lsUnreadChats.length}\n: ${cl}`
                )
            }
        }
        this.p1_busy = false
    }

    async pingWa81() {
        let nowTime = new Date()
        var timeDiff = (nowTime.valueOf() - this.last_bc.valueOf()) / 1000 // in sec
        if (Math.round(timeDiff / 60) > 7) {
            if (this.m81_cntr > 1) {
                await amQsend(
                    `WAGw get WA81 #${
                        this.m81_cntr
                    } ${this.last_rsp.toLocaleString()}`
                )
            }
            await this.chkTheWA81(`/🔔`)
        }
        this.last_bc = new Date()
    }

    async chkTheWA81(mx) {
        await this.instance.sock?.sendMessage(this.ID_rsdPS, { text: mx })
        this.last_req = new Date()
        this.m81_cntr++
    }

    getWhatsAppId(id) {
        if (id.includes('@g.us') || id.includes('@s.whatsapp.net')) return id
        return id.includes('-') ? `${id}@g.us` : `${id}@s.whatsapp.net`
    }

    async verifyId(id) {
        if (id.includes('@g.us')) return true
        const [result] = await this.instance.sock?.onWhatsApp(id)
        if (result?.exists) return true
        throw new Error(`account ${id} not exists!`)
    }

    async reffResult(to, msg) {
        const id = `${uuidv4()}`
            .replace(/-/g, '')
            .substring(0, 16)
            .toUpperCase()
        const sn = `${new Date().getTime()}`.substring(0, 10)
        let r1 = { key: { remoteJid: to, fromMe: true, id: id } }
        let r2 = { message: { extendedTextMessage: { text: msg } } }
        return { ...r1, ...r2, messageTimestamp: sn, status: 'PENDING' }
    }

    async sendTextMessage(phn, message, knownId = false) {
        let to = validPhnNumber(phn),
            data = null
        // let data = await this.reffResult(to, message)
        try {
            to = validPhnNumber(phn)
            console.log(
                `::phn:${phn}|to:${to}|knownId:${knownId}|message:${message}`
            )
            if (to && message) {
                if (!knownId) await this.verifyId(this.getWhatsAppId(to))
                // setTimeout(async () => {
                data = await this.instance.sock?.sendMessage(
                    this.getWhatsAppId(to),
                    { text: message }
                )
                await this.SendWebhook(`sendTextMessage`, data, this.key)
                // }, 11)
            }
        } catch (e) {
            data = { fail: `${e}`, id: phn }
            console.log(
                `::Fail phn:${phn}|to:${to}|knownId:${knownId}|message:${message}`
            )
            setTimeout(async () => {
                await amQsend(`⚡️Wa.Gw Err.sendTextMessage:\n${phn}\n${e}`)
            }, 2)
        }
        return data
    }

    // async sendTextMessage(phn, message, knownId = false) {
    //     let data
    //     try {
    //         const to = validPhnNumber(phn)
    //         if (!knownId) await this.verifyId(this.getWhatsAppId(to))
    //         data = await this.instance.sock?.sendMessage(this.getWhatsAppId(to), { text: message })
    //     } catch (e) {
    //         data = null
    //         await amQsend(`⚠️WaGw Err.sendTextMessage:\n${phn}\n${e}`)
    //     }
    //     return data
    // }

    async hapusMessageFme(clientId, mId, fromMe, tmstamp) {
        setTimeout(async () => {
            try {
                const r = await this.instance.sock?.chatModify(
                    {
                        clear: {
                            messages: [
                                { id: mId, fromMe: fromMe, timestamp: tmstamp },
                            ],
                        },
                    },
                    clientId,
                    []
                )
                await amQsend(`⚡️WaGw delMsgFme:\n${r} ${clientId}`)
            } catch (e) {
                console.log('::ERROR hapusMessageFme::', e)
                await amQsend(`⚡️WaGw Err.hapusMessageFme ${e}`)
            }
        }, 531)
    }

    async readMessage(msgObj) {
        try {
            const key = {
                remoteJid: msgObj.remoteJid,
                id: msgObj.id,
                participant: msgObj?.participant, // required when reading a msg from group
            }
            return await this.instance.sock?.readMessages([key])
        } catch (e) {
            logger.error('Error read message failed')
        }
    }

    async reactMessage(id, key, emoji) {
        try {
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
            // return await this.instance.sock?.sendMessage(this.getWhatsAppId(id), reactionMessage)
        } catch (e) {
            console.log(`Error react message failed: ${e}`)
        }
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

    async DownloadProfile(of) {
        await this.verifyId(this.getWhatsAppId(of))
        const ppUrl = await this.instance.sock?.profilePictureUrl(
            this.getWhatsAppId(of),
            'image'
        )
        return ppUrl
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

    async setStatus(status, to) {
        await this.verifyId(this.getWhatsAppId(to))
        const result = await this.instance.sock?.sendPresenceUpdate(status, to)
        return result
    }

    // change your display picture or a group's
    async updateProfilePicture(id, url) {
        try {
            const img = await axios.get(url, { responseType: 'arraybuffer' })
            const res = await this.instance.sock?.updateProfilePicture(
                id,
                img.data
            )
            return res
        } catch (e) {
            console.log(e)
            return { error: true, message: 'Unable to update profile picture' }
        }
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
            logger.error(`Error get group failed: ${e}`)
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
            logger.error(`Error updating groups failed: ${e}`)
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
            logger.error(`Error create new group failed: ${e}`)
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
            logger.error(`Error leave group failed: ${e}`)
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
            logger.error(`Error get invite group failed: ${e}`)
        }
    }

    async getInstanceInviteCodeGroup(id) {
        try {
            return await this.instance.sock?.groupInviteCode(id)
        } catch (e) {
            logger.error(`Error get invite group failed: ${e}`)
        }
    }

    // get Chat object from db
    async getChat(key = this.key) {
        let dbResult = await Chat.findOne({ key: key }).exec()
        let ChatObj = dbResult.chat
        return ChatObj
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
            logger.error(`Error updating document failed ${e}`)
        }
    }

    async updateGroupSubjectByApp(newChat) {
        //console.log(newChat)
        try {
            if (newChat[0] && newChat[0].subject) {
                let Chats = await this.getChat()
                Chats.find((c) => c.id === newChat[0].id).name =
                    newChat[0].subject
                await this.updateDb(Chats)
            }
        } catch (e) {
            logger.error(`Error updating document failed: ${e}`)
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
            logger.error(`Error updating document failed: ${e}`)
        }
    }

    async groupFetchAllParticipating() {
        try {
            const result =
                await this.instance.sock?.groupFetchAllParticipating()
            return result
        } catch (e) {
            logger.error(`Error group fetch all participating failed: ${e}`)
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
            return {
                error: true,
                message:
                    'unable to update description check if you are admin in group',
            }
        }
    }

    // update db document -> chat
    async updateDb(object) {
        try {
            await Chat.updateOne({ key: this.key }, { chat: object })
        } catch (e) {
            logger.error(`Error updating document failed: ${e}`)
        }
    }

    async deleteInstance(key) {
        try {
            await Chat.findOneAndDelete({ key: key })
        } catch (e) {
            logger.error('Error updating document failed')
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

    // --- amq --------------

    async updateMsg(phnId, news, img, note) {
        console.log(
            `█▐${new Date().toLocaleString()} task::${phnId}|${img}|${news}|*${note}`
        )
        let rtn = true,
            dt
        try {
            if (img > 'A') {
                let mx = {
                    image: fs.readFileSync('Media/' + img),
                    caption: news,
                    gifPlayback: true,
                }
                if (img === 'happybday.jpg') await tm_notif1('', phnId, '')

                const [result] = await this.instance.sock?.onWhatsApp(phnId)
                if (result?.exists) {
                    dt = await this.instance.sock?.sendMessage(phnId, mx)
                    await amQsend(`WAGw: ${phnId}☑️`)
                    await this.SendWebhook(`sendTextMessage`, dt, this.key)
                } else {
                    await amQsend(`WAGw: ${phnId}❌`)
                    // throw new Error('no account exists')
                    return true
                }
            } else if (img.indexOf('/Download/tm/') === 0) {
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
                            dt = await this.instance.sock?.sendMessage(
                                phnId,
                                mx
                            )
                            await amQsend(`WAGw: ${phnId} ☑️`)
                            await this.SendWebhook(
                                `sendTextMessage`,
                                dt,
                                this.key
                            )
                            i = 0
                            break
                        } catch (err1) {
                            console.log(
                                `attempt to sendMessage ${phnId}::${i}::${err1}`
                            )
                            await sleep(1800)
                        }
                        i++
                    }
                } catch (e1) {
                    await amQsend(
                        `⛑ WAGw Error sendMessage (e1) ${phnId}|${img}|${news}\n::${e1}`
                    )
                    console.log(
                        `Error sendMessage (e1) ${phnId}|${img}|${news}\n::${e1}`
                    )
                    i = -1
                }
            } else {
                // dt = await this.instance.sock?.sendMessage(phnId, {
                //     text: news,
                // })
                this.sendTextMessage(phnId, news, true)

                await amQsend(`WAGw: ${phnId} ☑️`)
                await this.SendWebhook(`sendTextMessage`, dt, this.key)
            }
        } catch (e2) {
            try {
                console.log(
                    'Failure on sendMsg (e2): ' + phnId,
                    e2,
                    '◄-------------------------------------\n'
                )
                await amQsend(`⛑ WAGw Fail on sendMsg (e2): ${phnId}|${e2}`)
                // await db.insertData(4, 'Fail', `Failure on sendMessage to ${phnId}|${e2}`)
                if (e2.statusCode === 428) {
                    await this.init() // await this.__startSock()
                    await sleep(7_000)
                }
            } catch (e3) {
                console.log(
                    'Error e3: ' + phnId,
                    e3,
                    '◄--------------------------------------------------\n'
                )
                await amQsend(`⛑ WAGw Error sendMsg (e3): ${phnId}|${e3}`)
                await this.init()
                await sleep(7_000)
            }
            return false
        }

        try {
            /*
            try {
                if (phnId === this.rsdPS) {
                    // pass
                } else if (await db.is_wa_exist(phnId)) {
                    await tm_notif81(`WAGw: ${phnId} ☑️`)
                } else {
                    let [rt] = await this.instance.sock?.onWhatsApp(phnId)
                    console.log(`is ${phnId} exists on WhatsApp ?:`, rt)
                    if (typeof rt === undefined) {
                        note = ''
                        await tm_notif81(`WAGw: ${phnId} undefined`)
                    } else {
                        await db.phn_insert(phnId)
                        await tm_notif81(`WAGw: ${phnId} present`)
                    }
                }
            } catch (e21) {
                console.log('Error onWhatsApp-check: ' + phnId, e21, '◄-------------------------------------\n')
            }
            */
            if (note > ' ') {
                dt = await this.instance.sock?.sendMessage(phnId, {
                    text: note,
                })
                await this.SendWebhook(`sendTextMessage`, dt, this.key)
            }
            // await db.insertData(3, 'sent', `:: ${phnId}|${news}`)
        } catch (e4) {
            try {
                console.log(
                    'Failure on sendMsg (e4): ' + phnId,
                    e4,
                    '◄-------------------------------------\n'
                )
                await amQsend(`⛑ WAGw Fail sendMsg (e4): ${phnId} :${e4}`)
                // await db.insertData(4, 'Fail', `Failure on sendMessage (b) to ${phnId}|${e22}`)
            } catch (e5) {
                console.log(
                    'Error e5: ' + phnId,
                    e5,
                    '◄--------------------------------------------------\n'
                )
            }
        }

        // if (phnId === this.rsdPS) this.cntr += 1
        return rtn
    }
}

exports.WhatsAppInstance = WhatsAppInstance
