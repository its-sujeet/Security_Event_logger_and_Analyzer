import React, { useEffect, useState } from 'react';
import { Container, Typography, Table, TableHead, TableRow, TableCell, TableBody, CircularProgress, Button, Grid, Paper } from '@mui/material';
import { io } from 'socket.io-client';
import { Bar, Pie } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

const socket = io('http://localhost:5000');

const App = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [showCharts, setShowCharts] = useState(false);

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

  const getSeverityData = () => {
    const severityCount = { Critical: 0, Warning: 0, Normal: 0 };
    logs.forEach(log => {
      severityCount[log.severity]++;
    });
    return {
      labels: ['Critical', 'Warning', 'Normal'],
      datasets: [{
        data: [severityCount.Critical, severityCount.Warning, severityCount.Normal],
        backgroundColor: ['#FF4C4C', '#FFD700', '#4CAF50'],
      }]
    };
  };

  const getCategoryData = () => {
    const categoryCount = { Application: 0, Security: 0, System: 0 };
    logs.forEach(log => {
      categoryCount[log.category]++;
    });
    return {
      labels: ['Application', 'Security', 'System'],
      datasets: [{
        data: [categoryCount.Application, categoryCount.Security, categoryCount.System],
        backgroundColor: ['#1E90FF', '#FF6347', '#32CD32'],
      }]
    };
  };

  const getTimeTrendData = () => {
    const timeSeries = {};
    logs.forEach(log => {
      const time = new Date(log.time_generated).toLocaleDateString();
      timeSeries[time] = (timeSeries[time] || 0) + 1;
    });

    const labels = Object.keys(timeSeries);
    const data = Object.values(timeSeries);

    return {
      labels,
      datasets: [{
        label: 'Logs per Day',
        data,
        backgroundColor: '#6A5ACD',
      }]
    };
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

      <Button
        onClick={() => setShowCharts((prev) => !prev)}
        style={{ marginBottom: '20px', backgroundColor: '#4CAF50', color: 'white' }}
      >
        {showCharts ? 'Hide Charts' : 'Show Charts'}
      </Button>

      {loading ? (
        <CircularProgress />
      ) : (
        <>
          {showCharts && (
            <Paper style={{ padding: '20px', marginBottom: '20px' }}>
              <Typography variant="h5" gutterBottom>
                Data Visualizations
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Typography variant="h6">Severity Distribution</Typography>
                  <Pie data={getSeverityData()} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Typography variant="h6">Category Distribution</Typography>
                  <Pie data={getCategoryData()} />
                </Grid>
              </Grid>

              <Grid container spacing={3} style={{ marginTop: '20px' }}>
                <Grid item xs={12}>
                  <Typography variant="h6">Log Trend Over Time</Typography>
                  <Bar data={getTimeTrendData()} />
                </Grid>
              </Grid>
            </Paper>
          )}

          <Table>
            <TableHead style={{ backgroundColor: '#f5f5f5' }}>
              <TableRow>
                <TableCell style={{ fontWeight: 'bold', color: '#000' }}>Event ID</TableCell>
                <TableCell style={{ fontWeight: 'bold', color: '#000' }}>Category</TableCell>
                <TableCell style={{ fontWeight: 'bold', color: '#000' }}>Source</TableCell>
                <TableCell style={{ fontWeight: 'bold', color: '#000' }}>Time Generated</TableCell>
                <TableCell style={{ fontWeight: 'bold', color: '#000' }}>Severity</TableCell>
                <TableCell style={{ fontWeight: 'bold', color: '#000' }}>Message</TableCell>
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
        </>
      )}
    </Container>
  );
};

export default App;
