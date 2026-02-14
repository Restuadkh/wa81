const { MongoClient } = require('mongodb')
const logger = require('pino')()

module.exports = async function connectNotes(uri) {
    try {
        const client = new MongoClient(uri)
        await client.connect()
        const db = await client.db()
        logger.info('STATE: Successfully connected NotesDB')
        return db
    } catch (error) {
        logger.error('STATE: Connection NotesDB failed!', error)
        process.exit()
    }
}

