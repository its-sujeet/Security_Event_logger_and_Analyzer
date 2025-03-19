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
  const [isLogsShiftedUp, setIsLogsShiftedUp] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState(null);
  const lastScrollY = useRef(0);

  const severityChartRef = useRef(null);
  const categoryChartRef = useRef(null);

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
        return updatedLogs.slice(0, 100);
      });
      setLoading(false);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('log_update');
    };
  }, []);

  const filteredLogs = logs.filter(
    (log) =>
      (filterSeverity === 'All' || log.severity === filterSeverity) &&
      (filterCategory === 'All' || log.category === filterCategory)
  );

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

  const handleSort = (column) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getRowStyle = (severity, isExpanded) => {
    const baseStyle = {
      transition: 'all 0.3s ease',
      cursor: 'pointer',
      height: isExpanded ? 'auto' : '60px',
      minHeight: isExpanded ? '100px' : '60px',
    };
    switch (severity) {
      case 'Critical':
        return { ...baseStyle, background: '#FF4C4C', color: '#1a1a1a', boxShadow: '0 4px 10px rgba(255, 76, 76, 0.5)', fontWeight: 'bold' };
      case 'Warning':
        return { ...baseStyle, background: 'rgba(255, 76, 76, 0.5)', color: '#fff', boxShadow: '0 4px 10px rgba(255, 76, 76, 0.2)' };
      case 'Normal':
        return { ...baseStyle, background: 'rgba(255, 76, 76, 0.1)', color: '#fff' };
      default:
        return { ...baseStyle, background: '#2d2d2d', color: '#fff' };
    }
  };

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

  const getCategoryData = () => ({
    labels: ['Application', 'Security', 'System'],
    datasets: [
      {
        data: [
          logs.filter((l) => l.category === 'Application').length,
          logs.filter((l) => l.category === 'Security').length,
          logs.filter((l) => l.category === 'System').length,
        ],
        backgroundColor: ['#FF4C4C', 'rgba(255, 76, 56, 0.5)', 'rgba(255, 76, 76, 0.2)'],
        borderWidth: 0,
      },
    ],
  });

  const getTimeTrendData = () => {
    const timeSeries = {};
    logs.forEach((log) => {
      const time = new Date(log.time_generated).toLocaleDateString();
      timeSeries[time] = (timeSeries[time] || 0) + 1;
    });

    // Sort dates chronologically
    const sortedDates = Object.keys(timeSeries).sort((a, b) => new Date(a) - new Date(b));
    const sortedCounts = sortedDates.map(date => timeSeries[date]);

    return {
      labels: sortedDates,
      datasets: [
        {
          label: 'Logs per Day',
          data: sortedCounts,
          backgroundColor: 'rgba(255, 76, 76, 0.7)',
          borderColor: '#FF4C4C',
          borderWidth: 2,
        },
      ],
    };
  };

  const truncateText = (text, maxLength = 20) => {
    if (text.length <= maxLength) return text;
    return `${text.substring(0, maxLength)}...`;
  };

  const handleRowClick = (logId) => {
    setExpandedLogId(expandedLogId === logId ? null : logId);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', width: '100%', maxWidth: '100vw', marginLeft: 5, marginRight: 95, padding: 0, background: '#1a1a1a', overflowX: 'hidden' }}>
      <div style={{ width: '100%', maxWidth: '1400px', marginLeft: 'auto', marginRight: 'auto', paddingLeft: '10px', paddingRight: '25px', boxSizing: 'border-box' }}>
        {/* Top Section: Charts */}
        <div style={{ height: '40vh', display: 'flex', flexDirection: 'row', padding: '10px', background: '#2d2d2d', gap: '10px', transform: isLogsShiftedUp ? 'translateY(-100%)' : 'translateY(0)', transition: 'transform 0.5s ease', position: 'relative', zIndex: 1, width: '100%', overflowX: 'hidden', flexWrap: 'nowrap' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
            <Typography variant="h6" style={{ color: '#FF4C4C', textAlign: 'center', marginBottom: '5px', fontSize: '0.9rem' }}>Severity Distribution</Typography>
            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
              <Pie
                ref={severityChartRef}
                data={getSeverityData()}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { labels: { color: '#FF4C4C', font: { size: 10 } } } },
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
              />
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
            <Typography variant="h6" style={{ color: '#FF4C4C', textAlign: 'center', marginBottom: '5px', fontSize: '0.9rem' }}>Category Distribution</Typography>
            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
              <Pie
                ref={categoryChartRef}
                data={getCategoryData()}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { labels: { color: '#FF4C4C', font: { size: 10 } } } },
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
              />
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', minWidth: 0 }}>
            <Typography variant="h6" style={{ color: '#FF4C4C', textAlign: 'center', marginBottom: '5px', fontSize: '0.9rem' }}>Log Trend Over Time</Typography>
            <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
              <Bar
                data={getTimeTrendData()}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { labels: { color: '#FF4C4C', font: { size: 10 } } } },
                  scales: {
                    x: { ticks: { color: '#FF4C4C', autoSkip: true, maxRotation: 45, minRotation: 45, font: { size: 10 } } },
                    y: { ticks: { color: '#FF4C4C', font: { size: 10 } } },
                  },
                }}
              />
            </div>
          </div>
        </div>

        {/* Bottom Section: Logs (unchanged) */}
        <div style={{ minHeight: isLogsShiftedUp ? '100vh' : '75vh', display: 'flex', flexDirection: 'column', padding: '20px', background: '#1a1a1a', transform: isLogsShiftedUp ? 'translateY(-25vh)' : 'translateY(0)', transition: 'transform 0.5s ease', position: 'relative', zIndex: 2, width: '100%', overflowX: 'hidden' }}>
          <Typography variant="h4" style={{ color: '#FF4C4C', textAlign: 'center', marginBottom: '20px' }}>OS Security Logs</Typography>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px', flexWrap: 'wrap', gap: '10px' }}>
            <Typography variant="h6" style={{ color: '#FF4C4C', marginRight: '10px' }}>Category:</Typography>
            {['All', 'Application', 'Security', 'System'].map((cat) => (
              <Chip key={cat} label={cat} onClick={() => setFilterCategory(cat)} color={cat === filterCategory ? 'primary' : 'default'} style={{ margin: '0 5px', color: '#fff', backgroundColor: cat === filterCategory ? '#1976d2' : '#424242' }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
            <Typography variant="h6" style={{ color: '#FF4C4C', marginRight: '10px' }}>Severity:</Typography>
            {['All', 'Critical', 'Warning', 'Normal'].map((sev) => (
              <Chip key={sev} label={sev} onClick={() => setFilterSeverity(sev)} color={sev === filterSeverity ? 'primary' : 'default'} style={{ margin: '0 5px', color: '#fff', backgroundColor: sev === filterSeverity ? '#1976d2' : '#424242' }} />
            ))}
          </div>
          {!connected && (
            <Typography style={{ color: '#FF4C4C', textAlign: 'center', marginBottom: '10px' }}>Disconnected from server. Trying to reconnect...</Typography>
          )}
          {loading ? (
            <CircularProgress style={{ color: '#FF4C4C', margin: 'auto', flexGrow: 1 }} />
          ) : (
            <TableContainer style={{ maxHeight: isLogsShiftedUp ? 'calc(200vh - 150px)' : 'calc(175vh - 150px)', background: '#2d2d2d' }}>
              <Table stickyHeader style={{ tableLayout: 'fixed', width: '100%' }}>
                <TableHead>
                  <TableRow>
                    {[
                      { id: 'event_id', label: 'Event ID', width: '10%' },
                      { id: 'category', label: 'Category', width: '15%' },
                      { id: 'source', label: 'Source', width: '20%' },
                      { id: 'time_generated', label: 'Time Generated', width: '25%' },
                      { id: 'severity', label: 'Severity', width: '10%' },
                      { id: 'message', label: 'Message', width: '20%' },
                    ].map((column) => (
                      <TableCell
                        key={column.id}
                        onClick={() => handleSort(column.id)}
                        style={{ cursor: 'pointer', fontWeight: 'bold', color: '#1a1a1a', background: '#FF4C4C', fontSize: '1rem', width: column.width, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
                      >
                        {column.label} {sortColumn === column.id && (sortDirection === 'asc' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />)}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {sortedLogs.map((log, index) => {
                    const logId = `${log.event_id}-${index}`;
                    const isExpanded = expandedLogId === logId;
                    return (
                      <TableRow
                        key={index}
                        style={getRowStyle(log.severity, isExpanded)}
                        onClick={() => handleRowClick(logId)}
                        onMouseOver={(e) => { if (!isExpanded) { e.currentTarget.style.transform = 'scale(1.02)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(255, 76, 76, 0.5)'; } }}
                        onMouseOut={(e) => { if (!isExpanded) { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; } }}
                      >
                        <TableCell style={{ fontSize: isExpanded ? '0.9rem' : '0.9rem', whiteSpace: isExpanded ? 'normal' : 'nowrap', overflow: isExpanded ? 'visible' : 'hidden', textOverflow: isExpanded ? 'clip' : 'ellipsis', padding: isExpanded ? '16px' : '8px' }}>{log.event_id}</TableCell>
                        <TableCell style={{ fontSize: isExpanded ? '0.9rem' : '0.9rem', whiteSpace: isExpanded ? 'normal' : 'nowrap', overflow: isExpanded ? 'visible' : 'hidden', textOverflow: isExpanded ? 'clip' : 'ellipsis', padding: isExpanded ? '16px' : '8px' }}>{log.category}</TableCell>
                        <TableCell style={{ fontSize: isExpanded ? '0.9rem' : '0.9rem', whiteSpace: isExpanded ? 'normal' : 'nowrap', overflow: isExpanded ? 'visible' : 'hidden', textOverflow: isExpanded ? 'clip' : 'ellipsis', padding: isExpanded ? '16px' : '8px' }}>{isExpanded ? log.source : truncateText(log.source)}</TableCell>
                        <TableCell style={{ fontSize: isExpanded ? '0.9rem' : '0.9rem', whiteSpace: isExpanded ? 'normal' : 'nowrap', overflow: isExpanded ? 'visible' : 'hidden', textOverflow: isExpanded ? 'clip' : 'ellipsis', padding: isExpanded ? '16px' : '8px' }}>{isExpanded ? log.time_generated : truncateText(log.time_generated)}</TableCell>
                        <TableCell style={{ fontSize: isExpanded ? '0.9rem' : '0.9rem', whiteSpace: isExpanded ? 'normal' : 'nowrap', overflow: isExpanded ? 'visible' : 'hidden', textOverflow: isExpanded ? 'clip' : 'ellipsis', padding: isExpanded ? '16px' : '8px' }}>{log.severity}</TableCell>
                        <TableCell style={{ fontSize: isExpanded ? '0.9rem' : '0.9rem', whiteSpace: isExpanded ? 'normal' : 'nowrap', overflow: isExpanded ? 'visible' : 'hidden', textOverflow: isExpanded ? 'clip' : 'ellipsis', wordBreak: isExpanded ? 'break-word' : 'normal', padding: isExpanded ? '16px' : '8px' }}>{isExpanded ? log.message : truncateText(log.message)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;