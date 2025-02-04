import React, { useEffect, useState } from 'react';
import { Container, Typography, Table, TableHead, TableRow, TableCell, TableBody, CircularProgress } from '@mui/material';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');

const App = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  // Listen for real-time log updates
  useEffect(() => {
    socket.on('log_update', (newLogs) => {
      setLogs((prevLogs) => {
        // Create a set of existing event IDs
        const existingEventIds = new Set(prevLogs.map((log) => log.event_id));

        // Filter out logs whose event ID already exists in the state
        const uniqueNewLogs = newLogs.filter((newLog) => !existingEventIds.has(newLog.event_id));

        // Add only unique logs based on event ID and sort by timestamp (latest first)
        return [...uniqueNewLogs, ...prevLogs].sort((a, b) => new Date(b.time_generated) - new Date(a.time_generated));
      });
      setLoading(false);
    });

    return () => {
      socket.off('log_update'); // Clean up the socket listener when component unmounts
    };
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