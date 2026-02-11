import { MongoClient } from 'mongodb'
import { get } from 'mongoose'

let client
let db

export async function getDB() {
    if (!client) {
        client = new MongoClient("mongodb://10.10.187.6:27017")
        await client.connect()
        db = client.db("wa81-a_test")
        console.log('Mongo connected')

        // TEST CRUD
        let data = await db.collection('wa-81-adm').find().toArray()
        console.log(data)

        await db.collection('wa-81-adm').deleteMany()
        // await db.collection('test').insertOne({
        //     name: 'Restu',
        //     email: 'restu@mail.com',
        //     createdAt: new Date()
        // })
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