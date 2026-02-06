// const mongoose = require('mongoose')

// const chatSchema = new mongoose.Schema({
//     key: {
//         type: String,
//         required: [true, 'key is missing'],
//         unique: true,
//     },
//     chat: {
//         type: Array,
//     },
// })

// const Chat = mongoose.model('Chat', chatSchema)

// module.exports = Chat

const { MongoClient } = require('mongodb')
const config = require('../../config/config')

const uri = config.mongoose.url // sesuaikan

let client
let db

async function connectDB() {
    if (!db) {
        client = new MongoClient(uri)
        await client.connect()
        db = client.db('wa81-a_test')

        // pastikan index unique untuk key
        await db.collection('chats').createIndex(
            { key: 1 },
            { unique: true }
        )
    }
    return db
}

async function getChatCollection() {
    const db = await connectDB()
    return db.collection('chats')
}

module.exports = {
    async insertChat(key, chat = []) {
        const col = await getChatCollection()
        return col.insertOne({ key, chat })
    },

    async findByKey(key) {
        const col = await getChatCollection()
        return col.findOne({ key })
    },

    async updateChat(key, chat) {
        const col = await getChatCollection()
        return col.updateOne(
            { key },
            { $set: { chat } }
        )
    },

    async pushChat(key, newChat) {
        const col = await getChatCollection()
        return col.updateOne(
            { key },
            { $push: { chat: newChat } }
        )
    },

    async deleteByKey(key) {
        const col = await getChatCollection()
        return col.deleteOne({ key })
    }
}
