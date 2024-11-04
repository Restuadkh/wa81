const dotenv = require('dotenv')
const mongoose = require('mongoose')
const logger = require('pino')()
dotenv.config()

const app = require('./config/express')
const config = require('./config/config')

const { Session } = require('./api/class/session')
const connectToCluster = require('./api/helper/connectMongoClient')
const { amQsend, gw_notif2 } = require('./api/helper/amQsend')


let server

if (config.mongoose.enabled) {
    mongoose.set('strictQuery', true);
    mongoose.connect(config.mongoose.url, config.mongoose.options).then(() => {
        logger.info('Connected to MongoDB')
    })
}

server = app.listen(config.port, async () => {
    console.log('\n\n»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»»')
    console.log(new Date().toLocaleString())
    logger.info(`Listening on port ${config.port}`)
    global.mongoClient = await connectToCluster(config.mongoose.url)
    if (config.restoreSessionsOnStartup) {
        logger.info(`Restoring Sessions...`)
        const session = new Session()
        let restoreSessions = await session.restoreSessions()
        logger.info(`${restoreSessions.length} Session(s) Restored`)
        amQsend(`⚠️WA.81 Restarting...🤔⚠️\nSession Restored: ${restoreSessions.length}`)
    }
})

const exitHandler = () => {
    if (server) {
        server.close(() => {
            logger.info('Server closed')
            console.log('\nServer closed\n')
            try {
                amQsend(`⚠️🥵WA.81 Server closed !!!`)
                new Promise((resolve) => {
                    setTimeout(resolve, 210)
                })
            } catch (e) {
                console.log(e)
            }
            process.exit(1)
        })
    } else {
        process.exit(1)
    }
}

const unexpectedErrorHandler = (error) => {
    logger.error(error)
    try {
        console.log('\nunexpectedErrorHandler\n', error)
        amQsend(`⚠️🥵WA.81 unexpectedErrorHandler\n${error}`)
        new Promise((resolve) => {
            setTimeout(resolve, 321)
        })
    } catch (e) {
        console.log(e)
    }
    console.log(`${error}\n------------------------------------------------------------------------------------------`)
    exitHandler()
}

process.on('uncaughtException', unexpectedErrorHandler)
process.on('unhandledRejection', unexpectedErrorHandler)

process.on('SIGTERM', () => {
    logger.info('SIGTERM received')
    if (server) {
        server.close()
    }
})

module.exports = server