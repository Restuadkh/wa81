/* eslint-disable no-unsafe-optional-chaining */
const { WhatsAppInstance } = require('../class/instance')
const { MsgQueue } = require('./mqWa81')
const logger = require('pino')()
const config = require('../../config/config')

class Session {
    async restoreSessions() {
        let restoredSessions = new Array()
        // let allCollections = []
        // try {
        //     const db = mongoClient.db('wa81-a')
        //     const result = await db.listCollections().toArray()
        //     console.log(result)
        //     result.forEach((collection) => {
        //         allCollections.push(collection.name)
        //         console.log(collection.name)
        //     })

        //     allCollections.map((key) => {
        //         const query = {}
        //         db.collection(key)
        //             .find(query)
        //             .toArray(async (err, result) => {
        //                 if (err) throw err
        //                 const webhook = !config.webhookEnabled ? undefined : config.webhookEnabled
        //                 const webhookUrl = !config.webhookUrl ? undefined : config.webhookUrl
        //                 const instance = new WhatsAppInstance(key, webhook, webhookUrl)
        //                 await instance.init()
        //                 WhatsAppInstances[key] = instance
        //                 const msgQueue = new MsgQueue(instance)
        //             })
        //         restoredSessions.push(key)
        //     })
        // } catch (e) {
        //     logger.error('Error restoring sessions')
        //     logger.error(e)
        // }
        let key = 'wa-81-adm'
        try {
            const webhook = !config.webhookEnabled ? undefined : config.webhookEnabled
            const webhookUrl = !config.webhookUrl ? undefined : config.webhookUrl
            const instance = new WhatsAppInstance(key, webhook, webhookUrl)
            await instance.init()
            WhatsAppInstances[key] = instance
            // const msgQueue = new MsgQueue(instance)
            setTimeout(() => { const msgQueue = new MsgQueue(instance) }, 88_000)
            restoredSessions.push(key)
            logger.info('Restored session:', key)
        } catch (e) {
            logger.error('Error restoring session:', key)
            logger.error(e)
        }
        return restoredSessions
    }
}

exports.Session = Session
