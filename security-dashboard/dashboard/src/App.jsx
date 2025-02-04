import React, { useEffect, useState } from 'react';
import { Container, Typography, Table, TableHead, TableRow, TableCell, TableBody, CircularProgress, Button } from '@mui/material';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');

const App = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');

  useEffect(() => {
    socket.on('log_update', (newLogs) => {
      setLogs((prevLogs) => {
        const existingEventIds = new Set(prevLogs.map((log) => log.event_id));
        const uniqueNewLogs = newLogs.filter((newLog) => !existingEventIds.has(newLog.event_id));
        return [...uniqueNewLogs, ...prevLogs].sort((a, b) => new Date(b.time_generated) - new Date(a.time_generated));
      });
      setLoading(false);
    });

    return () => {
      socket.off('log_update');
    };
  }, []);

  const filteredLogs = filter === 'All' ? logs : logs.filter(log => log.severity === filter);

  const getRowStyle = (severity) => {
    switch (severity) {
      case 'Critical': return { backgroundColor: '#FF4C4C', color: 'white' };
      case 'Warning': return { backgroundColor: '#FFD700', color: 'black' };
      case 'Normal': return { backgroundColor: '#4CAF50', color: 'white' };
      default: return {};
    }
  };

  return (
    <Container>
      <Typography variant="h3" gutterBottom>
        OS Security Log Dashboard
      </Typography>

      <Button onClick={() => setFilter('All')}>All</Button>
      <Button onClick={() => setFilter('Critical')} style={{ color: 'red' }}>Critical</Button>
      <Button onClick={() => setFilter('Warning')} style={{ color: 'orange' }}>Warning</Button>
      <Button onClick={() => setFilter('Normal')} style={{ color: 'green' }}>Normal</Button>

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
              <TableCell>Severity</TableCell>
              <TableCell>Message</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredLogs.map((log, index) => (
              <TableRow key={index} style={getRowStyle(log.severity)}>
                <TableCell>{log.event_id}</TableCell>
                <TableCell>{log.source}</TableCell>
                <TableCell>{log.time_generated}</TableCell>
                <TableCell>{log.category}</TableCell>
                <TableCell>{log.severity}</TableCell>
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
