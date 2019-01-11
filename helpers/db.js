const MongoClient = require('mongodb').MongoClient
const connectionString = 'mongodb://localhost:27017/wyr'

let _db

async function getDb () {
  if (!_db) {
    let client = await MongoClient.connect(
      connectionString,
      { useNewUrlParser: true }
    )
    _db = client.db('wyr')
    console.log(`Connected to Database: ${connectionString}`)
  }
  return _db
}

module.exports = getDb
