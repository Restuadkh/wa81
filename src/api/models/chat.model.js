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
const dotenv = require('dotenv')
dotenv.config()
const config = require('../../config/config')
const uri = config.mongoose.url /// || 'mongodb://localhost:27017'

const client = new MongoClient(uri)

let db

async function connectDB() {
    if (!db) {
        await client.connect()
        db = client.db('wa_81a_') // ganti nama database
        console.log('MongoDB connected')
    }
    
    return db
}
async function getCollection() {
    const db = await connectDB()
    await db.collection('chats').createIndex({ key: 1 }, { unique: true })
    return db.collection('chats')
}

module.exports = { connectDB, getCollection }