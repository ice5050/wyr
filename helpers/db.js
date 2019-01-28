const MongoClient = require('mongodb').MongoClient
const mongoConnectionString = process.env.MONGO_CONNECTION || 'mongodb://localhost:27017/wyr'

let _db

async function getDb () {
  if (!_db) {
    let client = await MongoClient.connect(
      mongoConnectionString,
      { useNewUrlParser: true }
    )
    _db = client.db('wyr')
    console.log(`Connected to Database: ${mongoConnectionString}`)
  }
  return _db
}

module.exports = getDb
