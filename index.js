const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const app = express();
const getTransaction = require("./getTransaction");
const cluster = require("cluster");

let workers = [];

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const setupWorkerProcesses = () => {
  // to read number of cores on system
  let numCores = require("os").cpus().length;
  console.log("Master cluster setting up " + numCores + " workers");

  // iterate on number of cores need to be utilized by an application
  // current example will utilize all of them
  for (let i = 0; i < numCores; i++) {
    // creating workers and pushing reference in an array
    // these references can be used to receive messages from workers
    workers.push(cluster.fork());

    // to receive messages from worker process
    workers[i].on("message", function(message) {
      console.log(message);
    });
  }

  // process is clustered on a core and process id is assigned
  cluster.on("online", function(worker) {
    console.log("Worker " + worker.process.pid + " is listening");
  });

  // if any of the worker process dies then start a new one by simply forking another one
  cluster.on("exit", function(worker, code, signal) {
    console.log(
      "Worker " +
        worker.process.pid +
        " died with code: " +
        code +
        ", and signal: " +
        signal
    );
    console.log("Starting a new worker");
    cluster.fork();
    workers.push(cluster.fork());
    // to receive messages from worker process
    workers[workers.length - 1].on("message", function(message) {
      console.log(message);
    });
  });
};

const setUpExpress = () => {
  app.get("/eth/api/v1/transaction/:id", async (req, res) => {
    try {
      const tx = req.params.id;
      const result = await getTransaction(tx);

      res.status(200).send({
        result,
        error: null
      });
    } catch (err) {
      res.status(404).send({
        result: null,
        error: err.message
      });
    }
  });

  process
    .on("unhandledRejection", (reason, p) => {
      console.error(reason, "Unhandled Rejection at Promise", p);
    })
    .on("uncaughtException", err => {
      console.error(err, "Uncaught Exception thrown");
      //process.exit(1);
    });

  const port = 5000;
  app.listen(port, () => {
    console.log("node server running at ", port);
  });
};
const setupServer = isClusterRequired => {
  // if it is a master process then call setting up worker process
  if (isClusterRequired && cluster.isMaster) {
    setupWorkerProcesses();
  } else {
    // to setup server configurations and share port address for incoming requests
    setUpExpress();
  }
};

setupServer(true);
