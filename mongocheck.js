import { MongoClient } from 'mongodb'
import { get } from 'mongoose'

let client
let db

export async function getDB() {
    if (!client) {
        client = new MongoClient("mongodb://10.10.187.33:27017")
        await client.connect()
        db = client.db(process.env.MONGO_DB)
        console.log('Mongo connected')

        // TEST CRUD
        let data = await db.collection('wa-81-adm').find().toArray()
        console.log(data)

        // await db.collection('wa-81-adm').deleteMany()
        // db.collection.deleteMany({})
        // await db.collection('notes').insertOne({
        //     _id: 'wa-81-adm',
        //     data: "{ conn_close: '⚡️🔴WA81.disconnected\nundefined' }",
        //     createdAt: new Date()
        // })
        // data = await db.collection('notes').find().toArray()
        // console.log(data)
        // data = await db.collection('test').find().toArray()
        // console.log(data)
        // await db.collection('test').updateOne(
        //     { email: 'restu@mail.com' },   // filter
        //     { $set: { name: 'Restu', updatedAt: new Date() } },
        //     { upsert: true }
        // )

        // data = await db.collection('test').find().toArray()
        // console.log(data)
    }
    return db
}

getDB();