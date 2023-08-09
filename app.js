require('dotenv').config()

const path = require('path');

const express = require("express");
const mongoose = require("mongoose");
const cors = require('cors');
const bodyParser = require("body-parser");
const fileupload = require("express-fileupload");

const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);

const userRoutes = require('./routes/user');
const imageRoutes = require('./routes/image')

const multer = require('multer');
const upload = multer();

const app = express();
const store = new MongoDBStore({
  uri: process.env.MONGO_URL,
  collection: 'sessions'
});

mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})

//app.use(upload.any());
//app.use(fileupload())
app.use(cors())
//app.use(bodyParser.urlencoded({ extended: false }));
//app.use(bodyParser.json());
// app.use(bodyParser.json({ limit: '50mb' }));
// app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.json({limit: '5mb'}))
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: store
}));

// app.use((req, res, next) =>{
//   res.setHeader('Access-Control-Allow-Origin', '*');
//   res.setHeader('Access-Control-Allow-Headers', 'Origin', 'X-Requested-Width', 'Content-Type', 'Accept', 'Authorization')
//   res.setHeader('Access-Control-Allow-Methods', 'GET', 'POST', 'DELETE','PATCH')
//   next();
// })
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PATCH');
  next();
});

app.use('/api/users', userRoutes)
app.use('/api/image', imageRoutes)

app.use((error, req, res, next) => {
  console.log(error)
  if (res.headerSent) {
    return next(error);
  }
  res.status(error.code || 500);
  res.json({ message: error.message || "An unknown error occurred!" });
});

app.listen(process.env.SERVER_PORT, () => console.log("server is running on port "+process.env.SERVER_PORT));



