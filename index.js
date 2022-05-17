const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, Admin } = require("mongodb");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.boaje.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});

function verifyJwt(req, res, next) {
  const authHeader = req.headers.authorization;
  // console.log(authHeader);
  if (!authHeader) {
    return res.status(401).send({ message: "unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  // console.log(token);
  jwt.verify(token, process.env.DB_TOKEN, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    await client.connect();
    const doctorService = client.db("doctors_portal").collection("services");
    const bookingCollection = client.db("doctors_portal").collection("booking");
    const userCollection = client.db("doctors_portal").collection("user");
    const doctorCollection = client.db("doctors_portal").collection("doctors");

    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({
        email: requester,
      });
      if (requesterAccount.role === "admin") {
        next();
      } else {
        res.status(403).send({ message: "forbidden" });
      }
    };

    // post doctor
    app.post("/doctor", verifyJwt, verifyAdmin, async (req, res) => {
      const doctors = req.body;
      const result = await doctorCollection.insertOne(doctors);
      res.send(result);
    });

    // get doctor
    app.get("/doctor", verifyJwt, verifyAdmin, async (req, res) => {
      const doctors = await doctorCollection.find().toArray();
      res.send(doctors)
    });
    // delete doctor
    app.delete("/doctor/:email", verifyJwt, verifyAdmin, async (req, res) => {
      const email= req.params.email;
      const query= {email:email};
      const result = await doctorCollection.deleteOne(query);
      res.send(result)
    });

    // put all  user
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };

      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign({ email: email }, process.env.DB_TOKEN, {
        expiresIn: "1h",
      });
      res.send({ result, token });
    });

    // make admin
    app.put("/user/admin/:email", verifyJwt, verifyAdmin,async (req, res) => {
      const email = req.params.email;

      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };

      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // admin
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });
    // all user
    app.get("/user", verifyJwt, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });
    // get services data
    app.get("/services", async (req, res) => {
      const query = {};
      const cursor = doctorService.find(query).project({ name: 1 });
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/available", async (req, res) => {
      const date = req.query.date;

      // step 1 get all services
      const services = await doctorService.find().toArray();

      // step 2 get the booking of the day
      const query = { date: date };
      const bookings = await bookingCollection.find(query).toArray();
      // for each service ,find booking for that service
      services.forEach((service) => {
        const serviceBooking = bookings.filter(
          (b) => b.treatment === service.name
        );
        const booked = serviceBooking.map((s) => s.slot);
        const available = service.slots.filter(
          (slot) => !booked.includes(slot)
        );
        service.slots = available;
      });
      res.send(services);
    });
    //  get booking data
    app.get("/booking", verifyJwt, async (req, res) => {
      const patient = req.query.patient;
      const decodedEmail = req.decoded.email;

      if (patient === decodedEmail) {
        const query = { patient: patient };
        const cursor = bookingCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
      } else {
        return res.status(403).send({ message: "forbidden access" });
      }
    });
    // post booking
    app.post("/booking", async (req, res) => {
      const query = {
        treatment: booking.treatment,
        date: booking.date,
        patient: booking.patient,
      };
      const exist = await bookingCollection.findOne(query);
      if (exist) {
        return res.send({ success: false, booking: exist });
      }
      const result = await bookingCollection.insertOne(booking);
      return res.send({ success: true, result });
    });
  } finally {
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Doctors portal");
});

app.listen(port, () => {
  console.log(`Doctors portal ${port}`);
});
