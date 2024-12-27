const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const dotenv = require("dotenv");
const axiosRetry = require("axios-retry").default;
const { WebSocketServer } = require("ws");

dotenv.config();

const app = express();
const PORT = 3000;

const corsOptions = {
  origin: "http://localhost:5173",
};
app.use(cors(corsOptions));

const jobFilePath = path.join(__dirname, "jobList.json");

axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  retryCondition: (error) => error.response?.status === 500,
});

const server = app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
const wss = new WebSocketServer({ server });

let connectedClients = [];

wss.on("connection", (ws) => {
  connectedClients.push(ws);

  ws.on("close", () => {
    connectedClients = connectedClients.filter((client) => client !== ws);
  });
});

const broadcast = (message) => {
  connectedClients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(JSON.stringify(message));
    }
  });
};

const readJobList = () => {
  if (!fs.existsSync(jobFilePath)) {
    return [];
  } else {
    const jobList = fs.readFileSync(jobFilePath, "utf-8");
    try {
      return JSON.parse(jobList);
    } catch (err) {
      console.error("Error reading job list:", err);
      return [];
    }
  }
};

const saveJobs = (jobs) => {
  fs.writeFileSync(jobFilePath, JSON.stringify(jobs, null, 2));
};

const processJob = async (job) => {
  const currentTime = Date.now();
  const startTime = job.startTime || currentTime;
  const elapsedTime = (currentTime - startTime) / 1000;
  const remainingTime = (job.executionTime || 0) - elapsedTime;

  if (remainingTime <= 0) {
    try {
      const imageResponse = await axios.get(
        `https://api.unsplash.com/photos/random?query=food&orientation=landscape&client_id=${process.env.UNSPLASH_ACCESS_KEY}`
      );
      const imageUrl = imageResponse.data.urls.small;

      const jobs = readJobList();
      const updatedJob = jobs.find((j) => j.id === job.id);
      if (updatedJob) {
        updatedJob.status = "resolved";
        updatedJob.result = imageUrl;
        saveJobs(jobs);
        broadcast({ type: "jobResolved", job: updatedJob });
      }
    } catch (error) {
      const jobs = readJobList();
      const updatedJob = jobs.find((j) => j.id === job.id);
      if (updatedJob) {
        updatedJob.status = "failed";
        saveJobs(jobs);
        broadcast({ type: "jobFailed", job: updatedJob });
      }
    }
  } else {
    setTimeout(async () => {
      await processJob(job);
    }, remainingTime * 1000);
  }
};

const processPendingJobs = () => {
  const jobs = readJobList();
  const pendingJobs = jobs.filter((job) => job.status === "pending");
  pendingJobs.forEach((job) => {
    processJob(job);
  });
};

app.get('/health', (req, res) => {
  res.status(200).send('Server is online');
});

app.get("/jobs", (req, res) => {
  const jobList = readJobList();
  res.json(jobList);
});

app.post("/jobs", (req, res) => {
  const jobId = Math.random().toString(36).substring(7);
  const executionTime = Math.floor(Math.random() * 60) * 5 + 5;
  const newJob = {
    id: jobId,
    status: "pending",
    result: null,
    executionTime,
    startTime: Date.now(),
  };

  const jobs = readJobList();
  jobs.push(newJob);
  saveJobs(jobs);

  processJob(newJob);

  broadcast({ type: "newJobCreated", job: newJob });

  res.json({ id: jobId });
});

app.get("/jobs/:id", (req, res) => {
  const jobId = req.params.id;
  const jobs = readJobList();
  const job = jobs.find((matchingJob) => matchingJob.id === jobId);
  if (job) {
    res.json(job);
  } else {
    res.status(404).json({ message: "Job not found" });
  }
});

processPendingJobs();
