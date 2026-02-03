/* eslint-disable no-unsafe-optional-chaining */
const QRCode = require('qrcode')
const pino = require('pino')
const {
    default: makeWASocket,
    DisconnectReason,
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
    nTryReCon = 0
    ID_myPhn = "6208112637570@s.whatsapp.net"
    ID_rsdPS = "6281904000707@s.whatsapp.net"
    ID_rsdGw = "6289510778377@s.whatsapp.net"
    cnt01 = 0


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
        this.key = key ? key : uuidv4()
        this.instance.customWebhook = this.webhook ? this.webhook : webhook
        this.allowWebhook = config.webhookEnabled ? config.webhookEnabled : allowWebhook
        if (this.allowWebhook && this.instance.customWebhook !== null) {
            this.allowWebhook = true
            this.instance.customWebhook = webhook
            this.axiosInstance = axios.create({ baseURL: webhook, })
        }
    }

    async SendWebhook(type, body, key) {
        if (!this.allowWebhook) return
        setTimeout(async () => {
            await this.axiosInstance.post('', { type, body, instanceKey: key, }).catch(() => { })
        }, 2)
    }

    async init() {
        this.collection = mongoClient.db('wa-humas').collection(this.key)
        const { state, saveCreds } = await useMongoDBAuthState(this.collection)
        this.authState = { state: state, saveCreds: saveCreds }
        this.socketConfig.auth = this.authState.state
        this.socketConfig.browser = Object.values(config.browser)
        this.instance.sock = makeWASocket(this.socketConfig)
        this.setHandler()
        console.log(`Init WhatsAppInstance ☑️`)
        return this
    }

    setHandler() {
        logger.info('Info: setHandler...')
        tm_notif1('Wa.Informasi.setHandler', "Wa-Informasi", '')
        const sock = this.instance.sock
        // on credentials update save state
        sock?.ev.on('creds.update', this.authState.saveCreds)

        // on socket closed, opened, connecting
        sock?.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update

            console.log(`connection state : ${connection}`)

            if (connection === 'connecting') return

            if (connection === 'close') {
                this.instance.online = false
                console.log('connection closed::', lastDisconnect?.error?.output)
                if (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
                    this.cnt01++
                    await amQsend(`⛑WA-Informasi disconnected #${this.cnt01}\n${JSON.stringify(lastDisconnect?.error?.output?.payload)}`)
                    await sleep(19000)
                    if (this.cnt01 > 19) process.exit(-1)
                    await this.init()
                } else {
                    logger.info('STATE: Connection loggedOut')
                    logger.info(lastDisconnect?.error?.output)
                    let mx = `🔴 WA-Informasi loggedOut\n${JSON.stringify(lastDisconnect?.error?.output?.payload)}`
                    await amQsend(`🔴${mx}`)
                    if (this.nTryReCon < 5) {
                        this.nTryReCon++
                        await sleep(90_000 * this.nTryReCon)
                        await this.init()
                    }
                    await this.collection.drop().then((r) => {
                        logger.info('STATE: Droped collection')
                        logger.info('STATE: Connection status is Droped & loggedOut')
                        tm_notif1(mx, this.ID_myPhn)
                    })
                }

                if (['all', 'connection', 'connection.update', 'connection:close',].some((e) => config.webhookAllowedEvents.includes(e)))
                    await this.SendWebhook('connection', { connection: connection, }, this.key)

            } else if (connection === 'open') {
                this.nTryReCon = 0
                console.log('connection is now open')
                if (config.mongoose.enabled) {
                    let alreadyThere = await Chat.findOne({ key: this.key, }).exec()
                    if (!alreadyThere) {
                        const saveChat = new Chat({ key: this.key })
                        await saveChat.save()
                    }
                }
                this.instance.online = true
                this.cnt01 = 0
                if (['all', 'connection', 'connection.update', 'connection:open',].some((e) => config.webhookAllowedEvents.includes(e)))
                    await this.SendWebhook('connection', { connection: connection, }, this.key)
                await amQsend('🟢WA-Informasi connection up')
                console.log('\n')
            }

            if (connection === 'undefined' && this.instance.online) {
                // await this.chkTheWA81('cek')
                return
            }


            if (qr) {
                console.log(`doing QR  @${connection}`);
                await amQsend('🔘WA-Informasi requesting QRcode!')
                QRCode.toDataURL(qr).then((url) => {
                    this.instance.qr = url
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
            if (m.type === 'prepend')
                this.instance.messages.unshift(...m.messages)
            if (m.type !== 'notify' && m.type !== 'append') {
				console.log(`DEBUG [?] ${new Date().toLocaleString()} excl-messages ${m.type}`, m)
                await this.SendWebhook(`excl-messages ${m.type}`, m, this.key)
                return
            }

            this.instance.messages.unshift(...m.messages)

            m.messages.map(async (msg) => {
                const clientId = msg.key.remoteJid
                if (msg.key.fromMe) {
                    await this.SendWebhook('m.fromMe', { ...msg, }, this.key)
                    try {
                        if (msg.message.imageMessage) await this.dlImageMessage(msg)
                    } catch (e) {
                        await amQsend(`⚡️Wa.I Err-195 ${e}`)
                    }
                    return
                } else if (clientId !== 'status@broadcast') {
                    if (msg.message) {
                        console.log(`DEBUG [0] ${new Date().toLocaleString()} clientId: ${clientId}|${JSON.stringify(msg.message)}`)
                    }
                }
                // if (clientId === 'status@broadcast' && clientId !== "6285643071890-1436494376@g.us") {
                if (clientId === 'status@broadcast' || !msg.message) {
                    return
                }

                let messageType = Object.keys(msg.message)[0]

                console.log(`DEBUG [1] ${new Date().toLocaleString()} messageType: ${messageType}`)
                if (['protocolMessage', 'senderKeyDistributionMessage',].includes(messageType)) {
                    console.log(`SKIP [1.a] ${new Date().toLocaleString()} ${messageType}\n${JSON.stringify(msg.message)}`)
                    return
                }

                try {
                    if (messageType === "messageContextInfo") {
                        if (msg.message.ephemeralMessage) {
                            msg = msg.message.ephemeralMessage
                            messageType = Object.keys(msg.message)[0]
                        } else {
                            console.log(`DEBUG [1.b] ${new Date().toLocaleString()}|${JSON.stringify(msg.message)}`)
                            await amQsend(`⚡️Wa.I Unhandle messageContextInfo`)
                            messageType = Object.keys(msg.message)[1]
                        }
                    }
                } catch (e) {
                    let xErr1 = `Err-messageContextInfo ${e}`
                    console.log('::', xErr1)
                    await amQsend(`⚡️Wa.I ${xErr1}`)
                }

                let mx = '', cFile = ''
                console.log(`DEBUG [2] ${new Date().toLocaleString()} messageType: ${messageType}\n${JSON.stringify(msg.message)}`)

                try {
                    [mx, cFile] = await this.getTextMessage(clientId, messageType, msg)
                } catch (e) {
                    console.log('::ERROR getTextMessage::', e)
                    await amQsend(`⚡️Wa.I Err.getTextMessage ${e}`)
                }
                console.log(`DEBUG  [3] ${new Date().toLocaleString()} cFile:${cFile}|mx: ${mx}`)

                if (cFile > " " || mx > " ") {
                    mx = `⚡️Wa.I: ${mx}\n🔥//wa.me/${clientId.replace(/\D/g, "")}`
                    await tm_notif1(mx, "Wa-Informasi", cFile)
                }

                if (['all', 'messages', 'messages.upsert'].some((e) => config.webhookAllowedEvents.includes(e))) {
                    const webhookData = { messageType: messageType, messageText: mx, fileContent: cFile, ...msg }
                    await this.SendWebhook('message', webhookData, this.key)
                }
            })
        })

        sock?.ev.on('messages.update', async (messages) => {
            // await this.SendWebhook('messages.update', messages, this.key)
        })

        // on receive all chats
        sock?.ev.on('chats.set', async ({ chats }) => {
            this.instance.chats = []
            const recivedChats = chats.map((chat) => { return { ...chat, messages: [], } })
            this.instance.chats.push(...recivedChats)
            await this.updateDb(this.instance.chats)
            await this.updateDbGroupsParticipants()
            await this.SendWebhook('chats.set', chats, this.key)
        })

        // on recive new chat
        sock?.ev.on('chats.upsert', async (newChat) => {
            await this.SendWebhook('chats.upsert', newChat, this.key)
            const chats = newChat.map((chat) => { return { ...chat, messages: [], } })
            this.instance.chats.push(...chats)
        })

        // on chat change
        sock?.ev.on('chats.update', async (changedChat) => {
            // await this.SendWebhook('chats.update', changedChat, this.key)
        })

        // on chat delete
        sock?.ev.on('chats.delete', async (deletedChats) => {
            await this.SendWebhook('chats.delete', deletedChats, this.key)
            deletedChats.map((chat) => {
                const index = this.instance.chats.findIndex((c) => c.id === chat)
                this.instance.chats.splice(index, 1)
            })
        })

        sock?.ev.on('groups.upsert', async (newChat) => {
            console.log('groups.upsert', newChat)
            this.createGroupByApp(newChat)
            if (['all', 'groups', 'groups.upsert'].some((e) => config.webhookAllowedEvents.includes(e)))
                await this.SendWebhook('group_created', { data: newChat, }, this.key)
        })

        sock?.ev.on('groups.update', async (newChat) => {
            console.log('groups.update', newChat)
            this.updateGroupSubjectByApp(newChat)
            if (['all', 'groups', 'groups.update'].some((e) => config.webhookAllowedEvents.includes(e)))
                await this.SendWebhook('group_updated', { data: newChat, }, this.key)
        })

        sock?.ev.on('group-participants.update', async (newChat) => {
            console.log('group-participants.update', newChat)
            this.updateGroupParticipantsByApp(newChat)
            if (['all', 'groups', 'group_participants', 'group-participants.update',].some((e) => config.webhookAllowedEvents.includes(e)))
                await this.SendWebhook('group_participants_updated', { data: newChat, }, this.key)
        })


        /*
        sock?.ws.on('CB:call', async (data) => {
            if (data.content) {
                if (data.content.find((e) => e.tag === 'offer')) {
                    const content = data.content.find((e) => e.tag === 'offer')
                    if (['all', 'call', 'CB:call', 'call:offer'].some((e) => config.webhookAllowedEvents.includes(e)))
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
                    // await this.callNotAvl(data.attrs.from, 1)

                } else if (data.content.find((e) => e.tag === 'terminate')) {
                    const content = data.content.find((e) => e.tag === 'terminate')
                    if (['all', 'call', 'call:terminate'].some((e) => config.webhookAllowedEvents.includes(e)))
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
                    // await this.callNotAvl(data.attrs.from, 1567)
                }
            }
        })
        */
    }


    async dlImageMessage(msg) {
        try {
            let buffer = await downloadMessage(msg.message.imageMessage, 'image', 1)
            let cFile = '/Download/i/wa_' + msg.key.id + '.jpeg', mx = ''
            await fsp.writeFile(cFile, buffer)
            try {
                mx = msg.message.imageMessage.caption
            } catch (e1) {
                console.log('Error caption@imageMessage: ' + e1)
            }
            console.log(`>> from.me imageMessage saved as ${cFile}\n${mx}\n`)
            await tm_notif1(`⚡️Wa.I: ${mx}\n🔥self`, "Wa-Informasi", cFile)
        } catch (err) {
            console.log('Error dlImageMessage ', err)
            await amQsend(`⚡️Wa.I Error dlImageMessage(()\n${err}`)
        }
    }


    async getTextMessage(clientId, messageType, msg) {
        let mx = "", cFile = "", fnm, buffer
        try {
            switch (messageType) {
                case 'conversation':
                    mx = msg.message.conversation
                    break
                case 'extendedTextMessage':
                    mx = msg.message.extendedTextMessage.text
                    break
                case 'highlyStructuredMessage':
                    const hsm = msg.message.highlyStructuredMessage.hydratedHsm.hydratedTemplate
                    mx = hsm.hydratedContentText
                    break
                case 'stickerMessage':
                    buffer = await downloadMessage(msg.message.stickerMessage, 'image', 1)
                    cFile = '/Download/i/wa-' + msg.key.id + '.webp'
                    await fsp.writeFile(cFile, buffer)
                    console.log(`The ${messageType} saved as ${cFile}`)
                    break
                case 'reactionMessage':
                    mx = `⚡️Wa.I reactionMessage: ${msg.message.reactionMessage.text}`
                    // setTimeout(async () => {
                    //     await this.reactMessage(clientId, msg.message.reactionMessage.key, '🙏🏻')
                    // }, 3)
                    break
                case 'imageMessage':
                    buffer = await downloadMessage(msg.message.imageMessage, 'image', 1)
                    cFile = '/Download/i/wa-' + msg.key.id + '.jpeg'
                    await fsp.writeFile(cFile, buffer)
                    try {
                        mx = msg.message.imageMessage.caption
                    } catch (e1) {
                        console.log('Error caption@imageMessage: ' + e1)
                    }
                    console.log(`The ${messageType} saved as ${cFile}`)
                    break
                case 'videoMessage':
                    buffer = await downloadMessage(msg.message.videoMessage, 'video', 1)
                    cFile = '/Download/i/wa-' + msg.key.id + '.mp4'
                    await fsp.writeFile(cFile, buffer)
                    try {
                        mx = msg.message.videoMessage.caption
                    } catch (e1) {
                        console.log('Error caption@videoMessage' + e1)
                    }
                    console.log(`The ${messageType} saved as ${cFile}`)
                    break
                case 'audioMessage':
                    buffer = await downloadMessage(msg.message.audioMessage, 'audio', 1)
                    cFile = '/Download/i/wa-' + msg.key.id + '.mp3'
                    await fsp.writeFile(cFile, buffer)
                    console.log(`The ${messageType} saved as ${cFile}`)
                    break
                case 'documentMessage':
                    buffer = await downloadMessage(msg.message.documentMessage, 'document', 1)
                    fnm = '_.x'
                    try {
                        fnm = msg.message.documentMessage.fileName
                    } catch (e1) {
                        console.log('Error get fileName documentMessage: ' + e1)
                    }
                    cFile = '/Download/i/wa-' + msg.key.id + fnm
                    await fsp.writeFile(cFile, buffer)
                    mx = 'documentMessage ' + fnm
                    console.log(`The ${messageType} saved as ${cFile}`)
                    break
                case 'documentWithCaptionMessage':
                    fnm = '_.x'
                    try {
                        mx = msg.message.documentWithCaptionMessage.caption
                        fnm = msg.message.documentWithCaptionMessage.fileName
                        buffer = await downloadMessage(msg.message.documentWithCaptionMessage, 'document', 1)
                        cFile = '/Download/i/wa-' + msg.key.id + fnm
                        await fsp.writeFile(cFile, buffer)
                    } catch (e1) {
                        console.log('Error get .. @documentWithCaptionMessage' + e1)
                    }
                    break
                case 'editedMessage':
                    if (msg.message.editedMessage) {
                        let _m = msg.message.editedMessage.message.protocolMessage.editedMessage
                        if (_m.extendedTextMessage)
                            mx = _m.extendedTextMessage.text
                        else
                            mx = _m.conversation
                    } else mx = msg.message.protocolMessage.editedMessage.conversation
                    break
                case 'contactMessage':
                    break
                case 'groupInviteMessage':
                    break
                case 'productMessage':
                    break
                default:
                    console.log('::Unknown process to ' + messageType)
                    await amQsend(`⚡️Wa.I unHandle::${messageType}\n${JSON.stringify(msg)}`)
                    break
            }
        } catch (er2) {
            let xErr2 = `Err-${messageType}: ${er2}`
            console.log(xErr2, mx)
            await amQsend(`⚡️Wa.I xErr2::${xErr2}\n${JSON.stringify(msg)}`)
        }
        return [mx, cFile]
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
        const id = `${uuidv4()}`.replace(/-/g, "").substring(0, 16).toUpperCase()
        const sn = `${new Date().getTime()}`.substring(0, 10)
        let r1 = { key: { remoteJid: to, fromMe: true, id: id } }
        let r2 = { message: { extendedTextMessage: { text: msg } } }
        return { ...r1, ...r2, messageTimestamp: sn, status: "PENDING" }
    }

    async sendTextMessage(phn, message, knownId = true) {
        let to, data	// = await this.reffResult(to, message)
        try {
            to = validPhnNumber(phn)
            console.log(`::phn:${phn}|to:${to}|knownId:${knownId}|message:${message}`)
            if (to && message) {
                if (!knownId) await this.verifyId(this.getWhatsAppId(to))
                data = await this.instance.sock?.sendMessage(this.getWhatsAppId(to), { text: message })
                // await this.SendWebhook(`sendTextMessage`, data, this.key)
                await this.SendWebhook(`sendTextMessage`, data, "Humas-2024")
                // setTimeout(async () => {
                // }, 2)
            }
        } catch (e) {
            data = { fail: `${e}`, id: phn }
            console.log(`::Fail phn:${phn}|to:${to}|knownId:${knownId}|message:${message}`)
            setTimeout(async () => {
                await amQsend(`⚡️Wa.I Err.sendTextMessage:\n${phn}\n${e}`)
            }, 2)
        }
        return data
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
            const res = await this.instance.sock?.sendMessage(this.getWhatsAppId(id), reactionMessage)
            return res
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
                [type]: { url: url, },
                caption: caption,
                mimetype: mimeType,
            }
        )
        return data
    }

    async DownloadProfile(of) {
        await this.verifyId(this.getWhatsAppId(of))
        const ppUrl = await this.instance.sock?.profilePictureUrl(this.getWhatsAppId(of), 'image')
        return ppUrl
    }

    async getUserStatus(of) {
        await this.verifyId(this.getWhatsAppId(of))
        const status = await this.instance.sock?.fetchStatus(this.getWhatsAppId(of))
        return status
    }

    async blockUnblock(to, data) {
        await this.verifyId(this.getWhatsAppId(to))
        const status = await this.instance.sock?.updateBlockStatus(this.getWhatsAppId(to), data)
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
                [data.mediaType]: { url: data.image, },
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
            const res = await this.instance.sock?.updateProfilePicture(id, img.data)
            return res
        } catch (e) {
            console.log(e)
            return { error: true, message: 'Unable to update profile picture', }
        }
    }

    // get user or group object from db by id
    async getUserOrGroupById(id) {
        try {
            let Chats = await this.getChat()
            const group = Chats.find((c) => c.id === this.getWhatsAppId(id))
            if (!group) throw new Error('unable to get group, check if the group exists')
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
                        for (const [key_participant, participant,] of Object.entries(value.participants)) {
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
            const group = await this.instance.sock?.groupCreate(name, users.map(this.getWhatsAppId))
            return group
        } catch (e) {
            logger.error(`Error create new group failed: ${e}`)
        }
    }

    async addNewParticipant(id, users) {
        try {
            const res = await this.instance.sock?.groupAdd(this.getWhatsAppId(id), this.parseParticipants(users))
            return res
        } catch {
            return { error: true, message: 'Unable to add participant, you must be an admin in this group', }
        }
    }

    async makeAdmin(id, users) {
        try {
            const res = await this.instance.sock?.groupMakeAdmin(this.getWhatsAppId(id), this.parseParticipants(users))
            return res
        } catch {
            return { error: true, message: 'unable to promote some participants, check if you are admin in group or participants exists', }
        }
    }

    async demoteAdmin(id, users) {
        try {
            const res = await this.instance.sock?.groupDemoteAdmin(this.getWhatsAppId(id), this.parseParticipants(users))
            return res
        } catch {
            return { error: true, message: 'unable to demote some participants, check if you are admin in group or participants exists', }
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
                throw new Error('unable to get invite code, check if the group exists')
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
        try {
            if (newChat[0] && newChat[0].subject) {
                let Chats = await this.getChat()
                Chats.find((c) => c.id === newChat[0].id).name = newChat[0].subject
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
                            chat.participant.push({ id: participant, admin: null, })
                        }
                    }
                    if (chat.participant && newChat.action == 'remove') {
                        for (const participant of newChat.participants) {
                            // remove group if they are owner
                            if (chat.subjectOwner == participant) {
                                is_owner = true
                            }
                            chat.participant = chat.participant.filter((p) => p.id != participant)
                        }
                    }
                    if (chat.participant && newChat.action == 'demote') {
                        for (const participant of newChat.participants) {
                            if (chat.participant.filter((p) => p.id == participant)[0]) {
                                chat.participant.filter((p) => p.id == participant)[0].admin = null
                            }
                        }
                    }
                    if (chat.participant && newChat.action == 'promote') {
                        for (const participant of newChat.participants) {
                            if (chat.participant.filter((p) => p.id == participant)[0]) {
                                chat.participant.filter((p) => p.id == participant)[0].admin = 'superadmin'
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
            const result = await this.instance.sock?.groupFetchAllParticipating()
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
                message: 'unable to ' + action + ' some participants, check if you are admin in group or participants exists',
            }
        }
    }

    // update group settings like  only allow admins to send messages
    async groupSettingUpdate(id, action) {
        try {
            const res = await this.instance.sock?.groupSettingUpdate(this.getWhatsAppId(id), action)
            return res
        } catch (e) {
            return { error: true, message: 'unable to ' + action + ' check if you are admin in group', }
        }
    }

    async groupUpdateSubject(id, subject) {
        try {
            const res = await this.instance.sock?.groupUpdateSubject(this.getWhatsAppId(id), subject)
            return res
        } catch (e) {
            return { error: true, message: 'unable to update subject check if you are admin in group', }
        }
    }

    async groupUpdateDescription(id, description) {
        try {
            const res = await this.instance.sock?.groupUpdateDescription(this.getWhatsAppId(id), description)
            return res
        } catch (e) {
            return { error: true, message: 'unable to update description check if you are admin in group', }
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
        console.log(`█▐${new Date().toLocaleString()} task::${phnId}|${img}|${news}|*${note}`)
        let rtn = true
        try {
            if (img > 'A') {
                let mx = { image: fs.readFileSync("Media/" + img), caption: news, gifPlayback: true }
                if (img === 'happybday.jpg') await tm_notif1('', phnId, '')

                const [result] = await this.instance.sock?.onWhatsApp(phnId)
                if (result?.exists) {
                    await this.instance.sock?.sendMessage(phnId, mx)
                    await amQsend(`WA-Informasi: ${phnId}☑️`)
                } else {
                    await amQsend(`WA-Informasi: ${phnId}❌`)
                    // throw new Error('no account exists')
                    return true
                }


            } else if (img.indexOf('/Download/tm/') === 0) {
                let i = 1, mx, media = img.toLowerCase()
                try {
                    if (media.indexOf('.mp4') > 14 || media.indexOf('.mov') > 14 || media.indexOf('.gif') > 14 || media.indexOf('.tgs') > 14) {
                        mx = { video: fs.readFileSync(img), caption: news, gifPlayback: true }
                    } else {
                        mx = { image: fs.readFileSync(img), caption: news, gifPlayback: true }
                    }
                    console.log(`fs.readFileSync ${img} :done`)
                    while (i < 3) {
                        try {
                            await this.instance.sock?.sendMessage(phnId, mx)
                            await amQsend(`WA-Informasi: ${phnId} ☑️`)
                            i = 0
                            break
                        } catch (err1) {
                            console.log(`attempt to sendMessage ${phnId}::${i}::${err1}`)
                            await sleep(1800)
                        }
                        i++
                    }
                } catch (e1) {
                    await amQsend(`⛑ WA-Informasi Error sendMessage (e1) ${phnId}|${img}|${news}\n::${e1}`)
                    console.log(`Error sendMessage (e1) ${phnId}|${img}|${news}\n::${e1}`)
                    i = -1
                }

            } else {
                await this.instance.sock?.sendMessage(phnId, { text: news })
                await amQsend(`WA-Informasi: ${phnId} ☑️`)
            }

        } catch (e2) {
            try {
                console.log('Failure on sendMsg (e2): ' + phnId, e2, '◄-------------------------------------\n')
                await amQsend(`⛑ WA-Informasi Fail on sendMsg (e2): ${phnId}|${e2}`)
                // await db.insertData(4, 'Fail', `Failure on sendMessage to ${phnId}|${e2}`)
                if (e2.statusCode === 428) {
                    await this.init()    // await this.__startSock()
                    await sleep(7_000)
                }
            } catch (e3) {
                console.log('Error e3: ' + phnId, e3, '◄--------------------------------------------------\n')
                await amQsend(`⛑ WA-Informasi Error sendMsg (e3): ${phnId}|${e3}`)
                await this.init()
                await sleep(7_000)
            }
            return false
        }

        try {
            if (note > ' ') await this.instance.sock?.sendMessage(phnId, { text: note })
            // await db.insertData(3, 'sent', `:: ${phnId}|${news}`)
        } catch (e4) {
            try {
                console.log('Failure on sendMsg (e4): ' + phnId, e4, '◄-------------------------------------\n')
                await amQsend(`⛑ WA-Informasi Fail sendMsg (e4): ${phnId} :${e4}`)
                // await db.insertData(4, 'Fail', `Failure on sendMessage (b) to ${phnId}|${e22}`)
            } catch (e5) {
                console.log('Error e5: ' + phnId, e5, '◄--------------------------------------------------\n')
            }
        }

        // if (phnId === this.rsdPS) this.cntr += 1
        return rtn
    }

}

exports.WhatsAppInstance = WhatsAppInstance