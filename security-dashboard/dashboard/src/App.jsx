import React, { useEffect, useState } from 'react';
import { Container, Typography, Table, TableHead, TableRow, TableCell, TableBody, CircularProgress, Button } from '@mui/material';
import { io } from 'socket.io-client';

const socket = io('http://localhost:5000');

const App = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');

  useEffect(() => {
    socket.on('log_update', (newLogs) => {
      setLogs((prevLogs) => {
        const existingEventIds = new Set(prevLogs.map((log) => `${log.event_id}-${log.category}`));
        const uniqueNewLogs = newLogs.filter((newLog) => !existingEventIds.has(`${newLog.event_id}-${newLog.category}`));
        return [...uniqueNewLogs, ...prevLogs].sort((a, b) => new Date(b.time_generated) - new Date(a.time_generated));
      });
      setLoading(false);
    });

    return () => {
      socket.off('log_update');
    };
  }, []);

  const filteredLogs = logs.filter(log => 
    (filterSeverity === 'All' || log.severity === filterSeverity) &&
    (filterCategory === 'All' || log.category === filterCategory)
  );

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

      <div style={{ marginBottom: '10px' }}>
        <Button onClick={() => setFilterCategory('All')}>All Categories</Button>
        <Button onClick={() => setFilterCategory('Application')} style={{ color: 'blue' }}>Application</Button>
        <Button onClick={() => setFilterCategory('Security')} style={{ color: 'red' }}>Security</Button>
        <Button onClick={() => setFilterCategory('System')} style={{ color: 'green' }}>System</Button>
      </div>

      <div style={{ marginBottom: '10px' }}>
        <Button onClick={() => setFilterSeverity('All')}>All</Button>
        <Button onClick={() => setFilterSeverity('Critical')} style={{ color: 'red' }}>Critical</Button>
        <Button onClick={() => setFilterSeverity('Warning')} style={{ color: 'orange' }}>Warning</Button>
        <Button onClick={() => setFilterSeverity('Normal')} style={{ color: 'green' }}>Normal</Button>
      </div>

      {loading ? (
        <CircularProgress />
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Event ID</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Time Generated</TableCell>
              <TableCell>Severity</TableCell>
              <TableCell>Message</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredLogs.map((log, index) => (
              <TableRow key={index} style={getRowStyle(log.severity)}>
                <TableCell>{log.event_id}</TableCell>
                <TableCell>{log.category}</TableCell>
                <TableCell>{log.source}</TableCell>
                <TableCell>{log.time_generated}</TableCell>
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
