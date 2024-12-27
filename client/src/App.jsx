import { useState, useEffect } from "react";
import axios from "axios";
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  CircularProgress,
  Card,
  CardContent,
  Alert,
  Skeleton,
} from "@mui/material";
import { Box } from "@mui/system";
import Grid from "@mui/material/Grid";

function App() {
  const [jobList, setJobList] = useState([]);
  const [newJobId, setNewJobId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const ws = new WebSocket("ws://localhost:3000");

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === "jobResolved" || message.type === "jobFailed") {
        setJobList((prevJobs) =>
          prevJobs.map((job) =>
            job.id === message.job.id ? { ...job, ...message.job } : job
          )
        );
      } else if (message.type === "newJobCreated") {
        setJobList((prevJobs) => [...prevJobs, message.job]);
      }
    };

    fetchJobs();

    return () => {
      ws.close();
    };
  }, []);

  const retryRequest = async (requestFn, retries = 3, delay = 1000) => {
    try {
      return await requestFn();
    } catch (error) {
      if (retries > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        return retryRequest(requestFn, retries - 1, delay * 2);
      } else {
        throw error;
      }
    }
  };

  const fetchJobs = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await retryRequest(() => axios.get("http://localhost:3000/jobs"));
      setJobList(response.data);
    } catch (error) {
      setError("Network error. Retrying...");
    } finally {
      setIsLoading(false);
    }
  };

  const createJob = async () => {
    setIsLoading(true);
    setError("");
    try {
      const response = await retryRequest(() => axios.post("http://localhost:3000/jobs"));
      setNewJobId(response.data.id);
      fetchJobs();
    } catch (error) {
      setError("Network error. Retrying...");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Box
      sx={{
        width: "100%",
        minHeight: "100vh",
        bgcolor: "#f5f5f5",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <AppBar position="static">
        <Toolbar>
          <Typography
            variant="h6"
            component="div"
            sx={{
              flexGrow: 1,
              textAlign: "center",
              fontWeight: "bold",
              fontSize: "1.5rem",
            }}
          >
            Calo Task
          </Typography>
        </Toolbar>
      </AppBar>

      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 4,
        }}
      >
        <Button
          variant="contained"
          color="primary"
          onClick={createJob}
          sx={{ marginBottom: 2 }}
        >
          Create New Job
        </Button>
        {newJobId && (
          <Typography variant="body1" color="textSecondary" sx={{ marginBottom: 2 }}>
            New Job Created with ID: {newJobId}
          </Typography>
        )}

        {isLoading && (
          <Box marginBottom={2}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Box marginBottom={2} sx={{ width: "100%", maxWidth: "600px" }}>
            <Alert severity="error">{error}</Alert>
          </Box>
        )}

        {jobList.length === 0 && !isLoading && !error && (
          <Typography variant="body1" color="textSecondary" sx={{ marginTop: 4 }}>
            No jobs available. Create a new job to get started.
          </Typography>
        )}

        <Grid container spacing={2} sx={{ justifyContent: "center", marginTop: 4 }}>
          {jobList.map((job) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={job.id}>
              <Card sx={{ height: "100%" }}>
                <CardContent>
                  <Typography variant="h6">Job ID: {job.id}</Typography>
                  <Typography variant="body1">Status: {job.status}</Typography>

                  <Box
                    sx={{
                      marginTop: 2,
                      height: 150,
                      display: "flex",
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    {job.status === "resolved" && job.result ? (
                      <img
                        src={job.result}
                        alt="Job Result"
                        style={{
                          maxWidth: "100%",
                          maxHeight: "100%",
                          borderRadius: "4px",
                        }}
                      />
                    ) : (
                      <Skeleton variant="rectangular" width="100%" height="100%" />
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Box>
  );
}

export default App;
