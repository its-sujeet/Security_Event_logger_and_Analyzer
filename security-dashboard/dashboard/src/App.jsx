import React, { useEffect, useState, useRef } from 'react';
import {
  Typography,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  CircularProgress,
  Chip,
  TableContainer,
  Tooltip,
} from '@mui/material';
import { io } from 'socket.io-client';
import { Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, ChartTooltip, Legend, ArcElement);

const socket = io('http://localhost:5000');

const App = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterSeverity, setFilterSeverity] = useState('All');
  const [filterCategory, setFilterCategory] = useState('All');
  const [sortColumn, setSortColumn] = useState('time_generated');
  const [sortDirection, setSortDirection] = useState('desc');
  const [connected, setConnected] = useState(true);
  const [isLogsShiftedUp, setIsLogsShiftedUp] = useState(false); // State for logs shifting up
  const lastScrollY = useRef(0); // Track last scroll position

  const severityChartRef = useRef(null);
  const categoryChartRef = useRef(null);

  // WebSocket connection and real-time log updates
  useEffect(() => {
    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('log_update', (newLogs) => {
      setLogs((prevLogs) => {
        const existingEventIds = new Set(prevLogs.map((log) => `${log.event_id}-${log.category}`));
        const uniqueNewLogs = newLogs.filter(
          (newLog) => !existingEventIds.has(`${newLog.event_id}-${newLog.category}`)
        );
        const updatedLogs = [...uniqueNewLogs, ...prevLogs].sort(
          (a, b) => new Date(b.time_generated) - new Date(a.time_generated)
        );
        return updatedLogs.slice(0, 100); // Limit to latest 100 logs for performance
      });
      setLoading(false);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('log_update');
    };
  }, []);

  // Handle scroll behavior (inverted logic) and scroll to logs section after transition
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const threshold = 100; // Adjust this value for sensitivity

      if (currentScrollY > lastScrollY.current && currentScrollY > threshold) {
        // Scrolling down beyond threshold
        if (!isLogsShiftedUp) {
          setIsLogsShiftedUp(true);
          // Wait for the transition to complete (0.5s) before scrolling
          setTimeout(() => {
            const vh = window.innerHeight * 0.4; // 40vh in pixels (charts height)
            const paddingOffset = 20; // Account for padding of logs section
            window.scrollTo({ top: vh - paddingOffset, behavior: 'smooth' });
          }, 500); // Match the transition duration
        }
      } else if (currentScrollY < lastScrollY.current && currentScrollY <= threshold) {
        // Scrolling up and within threshold
        setIsLogsShiftedUp(false);
      }

      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isLogsShiftedUp]); // Add isLogsShiftedUp as a dependency to prevent unnecessary re-renders

  // Filter logs based on severity and category
  const filteredLogs = logs.filter(
    (log) =>
      (filterSeverity === 'All' || log.severity === filterSeverity) &&
      (filterCategory === 'All' || log.category === filterCategory)
  );

  // Sort filtered logs based on selected column and direction
  const sortedLogs = [...filteredLogs].sort((a, b) => {
    const compare = (a, b, column) => {
      if (column === 'time_generated') {
        return new Date(a.time_generated) - new Date(b.time_generated);
      } else if (typeof a[column] === 'string') {
        return a[column].localeCompare(b[column]);
      } else {
        return a[column] - b[column];
      }
    };
    return sortDirection === 'asc' ? compare(a, b, sortColumn) : compare(b, a, sortColumn);
  });

  // Handle sorting when a column header is clicked
  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Style table rows based on severity
  const getRowStyle = (severity) => {
    switch (severity) {
      case 'Critical':
        return {
          background: '#FF4C4C',
          color: '#1a1a1a',
          boxShadow: '0 4px 10px rgba(255, 76, 76, 0.5)',
          transition: 'all 0.3s ease',
          fontWeight: 'bold',
        };
      case 'Warning':
        return {
          background: 'rgba(255, 76, 76, 0.5)',
          color: '#fff',
          boxShadow: '0 4px 10px rgba(255, 76, 76, 0.2)',
          transition: 'all 0.3s ease',
        };
      case 'Normal':
        return {
          background: 'rgba(255, 76, 76, 0.1)',
          color: '#fff',
          transition: 'all 0.3s ease',
        };
      default:
        return { background: '#2d2d2d', color: '#fff' };
    }
  };

  // Data for severity distribution Pie chart
  const getSeverityData = () => ({
    labels: ['Critical', 'Warning', 'Normal'],
    datasets: [
      {
        data: [
          logs.filter((l) => l.severity === 'Critical').length,
          logs.filter((l) => l.severity === 'Warning').length,
          logs.filter((l) => l.severity === 'Normal').length,
        ],
        backgroundColor: ['#FF4C4C', 'rgba(255, 76, 76, 0.5)', 'rgba(255, 76, 76, 0.2)'],
        borderWidth: 0,
      },
    ],
  });

  // Data for category distribution Pie chart
  const getCategoryData = () => ({
    labels: ['Application', 'Security', 'System'],
    datasets: [
      {
        data: [
          logs.filter((l) => l.category === 'Application').length,
          logs.filter((l) => l.category === 'Security').length,
          logs.filter((l) => l.category === 'System').length,
        ],
        backgroundColor: ['#FF4C4C', 'rgba(255, 76, 76, 0.5)', 'rgba(255, 76, 76, 0.2)'],
        borderWidth: 0,
      },
    ],
  });

  // Data for time trend Bar chart
  const getTimeTrendData = () => {
    const timeSeries = {};
    logs.forEach((log) => {
      const time = new Date(log.time_generated).toLocaleDateString();
      timeSeries[time] = (timeSeries[time] || 0) + 1;
    });
    return {
      labels: Object.keys(timeSeries),
      datasets: [
        {
          label: 'Logs per Day',
          data: Object.values(timeSeries),
          backgroundColor: 'rgba(255, 76, 76, 0.7)',
          borderColor: '#FF4C4C',
          borderWidth: 2,
        },
      ],
    };
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh', // Allow content to expand beyond viewport
        width: '100vw',
        margin: 0,
        padding: 0,
        background: '#1a1a1a',
        overflowY: 'auto', // Enable scrolling
      }}
    >
      {/* Top Section: Charts */}
      <div
        style={{
          height: '40vh',
          display: 'flex',
          flexDirection: 'row',
          padding: '20px',
          background: '#2d2d2d',
          gap: '20px',
          overflow: 'hidden',
          transform: isLogsShiftedUp ? 'translateY(-100%)' : 'translateY(0)', // Slide up out of view
          transition: 'transform 0.5s ease', // Smooth slide animation
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* Severity Distribution Chart */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            width: '100%',
          }}
        >
          <Typography
            variant="h6"
            style={{
              color: '#FF4C4C',
              fontFamily: 'Roboto, sans-serif',
              textAlign: 'center',
              marginBottom: '10px',
            }}
          >
            Severity Distribution
          </Typography>
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <Pie
              ref={severityChartRef}
              data={getSeverityData()}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { labels: { color: '#FF4C4C' } },
                  tooltip: { backgroundColor: '#2d2d2d', titleColor: '#FF4C4C', bodyColor: '#fff' },
                },
                animation: { duration: 1000, easing: 'easeOutBounce' },
                onClick: (event) => {
                  const chart = severityChartRef.current;
                  const elements = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, false);
                  if (elements.length > 0) {
                    const index = elements[0].index;
                    const severity = ['Critical', 'Warning', 'Normal'][index];
                    setFilterSeverity(severity);
                  }
                },
              }}
              style={{ height: '100%', width: '100%' }}
            />
          </div>
        </div>

        {/* Category Distribution Chart */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            width: '100%',
          }}
        >
          <Typography
            variant="h6"
            style={{
              color: '#FF4C4C',
              fontFamily: 'Roboto, sans-serif',
              textAlign: 'center',
              marginBottom: '10px',
            }}
          >
            Category Distribution
          </Typography>
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <Pie
              ref={categoryChartRef}
              data={getCategoryData()}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { labels: { color: '#FF4C4C' } },
                  tooltip: { backgroundColor: '#2d2d2d', titleColor: '#FF4C4C', bodyColor: '#fff' },
                },
                animation: { duration: 1000, easing: 'easeOutBounce' },
                onClick: (event) => {
                  const chart = categoryChartRef.current;
                  const elements = chart.getElementsAtEventForMode(event, 'nearest', { intersect: true }, false);
                  if (elements.length > 0) {
                    const index = elements[0].index;
                    const category = ['Application', 'Security', 'System'][index];
                    setFilterCategory(category);
                  }
                },
              }}
              style={{ height: '100%', width: '100%' }}
            />
          </div>
        </div>

        {/* Log Trend Over Time Chart */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            width: '100%',
          }}
        >
          <Typography
            variant="h6"
            style={{
              color: '#FF4C4C',
              fontFamily: 'Roboto, sans-serif',
              textAlign: 'center',
              marginBottom: '10px',
            }}
          >
            Log Trend Over Time
          </Typography>
          <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
            <Bar
              data={getTimeTrendData()}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { labels: { color: '#FF4C4C' } },
                  tooltip: { backgroundColor: '#2d2d2d', titleColor: '#FF4C4C', bodyColor: '#fff' },
                },
                scales: {
                  x: { ticks: { color: '#FF4C4C' } },
                  y: { ticks: { color: '#FF4C4C' } },
                },
                animation: { duration: 1000, easing: 'easeOutBounce' },
              }}
              style={{ height: '100%', width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* Bottom Section: Logs */}
      <div
        style={{
          minHeight: isLogsShiftedUp ? '100vh' : '60vh', // Adjust height based on mode
          display: 'flex',
          flexDirection: 'column',
          padding: '20px',
          background: '#1a1a1a',
          transform: isLogsShiftedUp ? 'translateY(-40vh)' : 'translateY(0)', // Slide up to cover charts
          transition: 'transform 0.5s ease', // Smooth slide animation
          position: 'relative',
          zIndex: 2,
        }}
      >
        <Typography
          variant="h4"
          style={{
            color: '#FF4C4C',
            fontFamily: 'Orbitron, sans-serif',
            textShadow: '0 0 10px #FF4C4C',
            textAlign: 'center',
            marginBottom: '20px',
          }}
        >
          OS Security Logs
        </Typography>

        {/* Category Filters */}
        <div
          style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '10px' }}
        >
          <Typography variant="h6" style={{ color: '#FF4C4C', marginRight: '10px' }}>
            Category:
          </Typography>
          {['All', 'Application', 'Security', 'System'].map((cat) => (
            <Chip
              key={cat}
              label={cat}
              onClick={() => setFilterCategory(cat)}
              color={cat === filterCategory ? 'primary' : 'default'}
              style={{
                margin: '0 5px',
                color: cat === filterCategory ? '#fff' : '#fff',
                backgroundColor: cat === filterCategory ? '#1976d2' : '#424242',
              }}
            />
          ))}
        </div>

        {/* Severity Filters */}
        <div
          style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '20px' }}
        >
          <Typography variant="h6" style={{ color: '#FF4C4C', marginRight: '10px' }}>
            Severity:
          </Typography>
          {['All', 'Critical', 'Warning', 'Normal'].map((sev) => (
            <Chip
              key={sev}
              label={sev}
              onClick={() => setFilterSeverity(sev)}
              color={sev === filterSeverity ? 'primary' : 'default'}
              style={{
                margin: '0 5px',
                color: sev === filterSeverity ? '#fff' : '#fff',
                backgroundColor: sev === filterSeverity ? '#1976d2' : '#424242',
              }}
            />
          ))}
        </div>

        {/* Connection Status */}
        {!connected && (
          <Typography
            style={{ color: '#FF4C4C', textAlign: 'center', marginBottom: '10px' }}
          >
            Disconnected from server. Trying to reconnect...
          </Typography>
        )}

        {loading ? (
          <CircularProgress
            style={{
              color: '#FF4C4C',
              margin: 'auto',
              flexGrow: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          />
        ) : (
          <TableContainer
            style={{
              maxHeight: isLogsShiftedUp ? 'calc(100vh - 140px)' : 'calc(60vh - 140px)', // Adjust height based on mode
              overflow: 'auto',
              background: '#2d2d2d',
            }}
          >
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  {['event_id', 'category', 'source', 'time_generated', 'severity', 'message'].map((column) => (
                    <TableCell
                      key={column}
                      onClick={() => handleSort(column)}
                      style={{
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        color: '#1a1a1a',
                        fontFamily: 'Orbitron, sans-serif',
                        textShadow: '0 0 5px #FF4C4C',
                        background: '#FF4C4C',
                        fontSize: '1.1rem', // Slightly larger for clarity
                      }}
                    >
                      {column.replace('_', ' ')}{' '}
                      {sortColumn === column &&
                        (sortDirection === 'asc' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {sortedLogs.map((log, index) => (
                  <TableRow
                    key={index}
                    style={{
                      ...getRowStyle(log.severity),
                      cursor: 'pointer',
                      height: '60px', // Increase row height for better visibility
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.transform = 'scale(1.02)';
                      e.currentTarget.style.boxShadow = '0 4px 10px rgba(255, 76, 76, 0.5)';
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.transform = 'scale(1)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <TableCell style={{ fontSize: '1rem' }}>{log.event_id}</TableCell>
                    <TableCell style={{ fontSize: '1rem' }}>{log.category}</TableCell>
                    <TableCell style={{ fontSize: '1rem' }}>{log.source}</TableCell>
                    <TableCell style={{ fontSize: '1rem' }}>{log.time_generated}</TableCell>
                    <TableCell style={{ fontSize: '1rem' }}>{log.severity}</TableCell>
                    <TableCell>
                      <Tooltip title={log.message} arrow>
                        <span
                          style={{
                            display: 'block',
                            maxWidth: '500px', // Wider for full-screen mode
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            fontSize: '1rem', // Larger text for clarity
                          }}
                        >
                          {log.message}
                        </span>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </div>
    </div>
  );
};

export default App;
