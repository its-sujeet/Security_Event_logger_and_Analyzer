import React, { useEffect, useState } from 'react';
import { Container, Typography, Table, TableHead, TableRow, TableCell, TableBody, CircularProgress } from '@mui/material';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');

const App = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch initial logs from the backend
  useEffect(() => {
    // fetch('/logs')
    //   .then((response) => response.json())
    //   .then((data) => {
    //     console.log(JSON.stringify(data));
    //     setLogs(data);
    //     setLoading(false);
    //   });

    // Listen for real-time log updates
    socket.on('log_update', (newLogs) => {
      setLogs((prevLogs) => [...newLogs, ...prevLogs]);
      setLoading(false);
    });
  }, []);

  return (
    <Container>
      <Typography variant="h3" gutterBottom>
        OS Security Log Dashboard
      </Typography>
      {loading ? (
        <CircularProgress />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Event ID</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Time Generated</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Event Type</TableCell>
              <TableCell>Message</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((log, index) => (
              <TableRow key={index}>
                <TableCell>{log.event_id}</TableCell>
                <TableCell>{log.source}</TableCell>
                <TableCell>{log.time_generated}</TableCell>
                <TableCell>{log.category}</TableCell>
                <TableCell>{log.event_type}</TableCell>
                <TableCell>{log.message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Container>
  );
};

export default App;
