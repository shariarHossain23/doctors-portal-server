const express = require('express')
const cors = require('cors')
const { MongoClient, ServerApiVersion } = require('mongodb');
require ('dotenv').config()
const app = express();
const port = process.env.PORT || 5000;


// middleware
app.use(cors())
app.use(express.json())




const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.boaje.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
  try{
    await client.connect();
    const doctorService = client.db("doctors_portal").collection("services");
    const bookingCollection = client.db("doctors_portal").collection("booking");


    // get services data
    app.get("/services",async(req,res)=>{
      const query = {}
      const cursor = doctorService.find(query)
      const result = await cursor.toArray()
      res.send(result)
    })

    app.get('/available',async(req,res)=>{
      const date = req.query.date

      // step 1 get all services
      const services = await doctorService.find().toArray();

      // step 2 get the booking of the day
      const query = {date:date}
      const bookings = await bookingCollection.find(query).toArray()
      // for each service ,find booking for that service
      services.forEach(service =>{
        const serviceBooking = bookings.filter(b=> b.treatment === service.name )
        const booked = serviceBooking.map(s => s.slot)
        const available = service.slots.filter(slot => !booked.includes(slot))
        service.slots = available;
        // service.booked = booked;
      })
      res.send(services)
    })
    //  get booking data

    app.get('/booking',async(req,res)=>{
      const patient = req.query.patient
      const query = {patient:patient}
      const cursor = bookingCollection.find(query)
      const result = await cursor.toArray()
      res.send(result)
    })
    // post booking
   app.post("/booking",async(req,res)=>{
     const booking = req.body;
     const query = {treatment:booking.treatment,date:booking.date, patient:booking.patient}
     const exist = await bookingCollection.findOne(query)
     if(exist){
       return res.send({success:false,booking:exist})
     }
     const result = await bookingCollection.insertOne(booking)
     return res.send({success:true,result})
   })


   
  }
  finally{}
}

run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('Doctors portal')
  })
  
  app.listen(port, () => {
    console.log(`Doctors portal ${port}`)
  })
